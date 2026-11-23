/**
 * 手写基础设施层（零第三方依赖）
 *
 * 这里的东西原本由第三方库或「现成 API」提供：
 *   deepClone  ← JSON.stringify 方案（丢 Date / Map / 循环引用）
 *   debounce   ← lodash / 手写 setTimeout
 *   Promise.*  ← 直接用原生（这里是自己的实现，可与原生对拍）
 *   retry/pool ← axios-retry / p-limit
 *   EventBus   ← mitt / Pinia
 *
 * 每个函数都能单独被 Node 跑通：npm run test:core
 */

/* ============================== 深拷贝 ============================== */
export function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)

  if (value instanceof Date) return new Date(value.getTime())
  if (value instanceof RegExp) {
    const reg = new RegExp(value.source, value.flags)
    reg.lastIndex = value.lastIndex
    return reg
  }
  if (value instanceof Map) {
    const map = new Map()
    seen.set(value, map)
    value.forEach((v, k) => map.set(deepClone(k, seen), deepClone(v, seen)))
    return map
  }
  if (value instanceof Set) {
    const set = new Set()
    seen.set(value, set)
    value.forEach((v) => set.add(deepClone(v, seen)))
    return set
  }
  if (Array.isArray(value)) {
    const arr = []
    seen.set(value, arr)
    value.forEach((item, i) => (arr[i] = deepClone(item, seen)))
    return arr
  }

  const cloned = Object.create(Object.getPrototypeOf(value))
  seen.set(value, cloned)
  Reflect.ownKeys(value).forEach((key) => {
    cloned[key] = deepClone(value[key], seen)
  })
  return cloned
}

/* ============================== 防抖 / 节流 ============================== */
export function debounce(fn, wait = 300) {
  let timer = null
  let lastArgs = null
  function debounced(...args) {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(null, lastArgs)
    }, wait)
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
      fn.apply(null, lastArgs)
    }
  }
  return debounced
}

export function throttle(fn, wait = 200) {
  let last = 0
  let timer = null
  return function throttled(...args) {
    const now = Date.now()
    const remaining = wait - (now - last)
    if (remaining <= 0) {
      if (timer) clearTimeout(timer)
      timer = null
      last = now
      fn.apply(this, args)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn.apply(this, args)
      }, remaining)
    }
  }
}

/* ============================== Promise 静态方法 ============================== */
export function myAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable)
    if (!items.length) return resolve([])
    const result = new Array(items.length)
    let count = 0
    items.forEach((item, i) => {
      Promise.resolve(item).then(
        (value) => {
          result[i] = value
          if (++count === items.length) resolve(result)
        },
        reject
      )
    })
  })
}

export function myAllSettled(iterable) {
  return new Promise((resolve) => {
    const items = Array.from(iterable)
    if (!items.length) return resolve([])
    const result = new Array(items.length)
    let count = 0
    items.forEach((item, i) => {
      Promise.resolve(item).then(
        (value) => {
          result[i] = { status: 'fulfilled', value }
          if (++count === items.length) resolve(result)
        },
        (reason) => {
          result[i] = { status: 'rejected', reason }
          if (++count === items.length) resolve(result)
        }
      )
    })
  })
}

export function myRace(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) Promise.resolve(item).then(resolve, reject)
  })
}

export function myAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable)
    if (!items.length) return reject(new AggregateError([], 'All promises were rejected'))
    const errors = new Array(items.length)
    let count = 0
    items.forEach((item, i) => {
      Promise.resolve(item).then(resolve, (reason) => {
        errors[i] = reason
        if (++count === items.length) reject(new AggregateError(errors, 'All promises were rejected'))
      })
    })
  })
}

/* ============================== 并发池 + 重试 ============================== */
/**
 * 注意：限流必须作用在「任务函数」上。
 * 对已经创建好的 promise 做限流是无效的 —— 它们早就在跑了。
 */
export async function runPool(taskFns, limit = 4) {
  const tasks = Array.from(taskFns)
  const results = new Array(tasks.length)
  let cursor = 0
  let active = 0
  let peak = 0
  const start = performance.now()

  const worker = async () => {
    while (cursor < tasks.length) {
      const index = cursor++
      active++
      peak = Math.max(peak, active)
      try {
        results[index] = { status: 'fulfilled', value: await tasks[index]() }
      } catch (error) {
        results[index] = { status: 'rejected', error }
      } finally {
        active--
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length || 1)) }, worker))
  return { results, stats: { peak, limit, duration: performance.now() - start } }
}

export async function retry(fn, { retries = 2, baseDelay = 200, factor = 2, jitter = true, shouldRetry = () => true } = {}) {
  let lastError
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn(i)
    } catch (error) {
      lastError = error
      if (i === retries || !shouldRetry(error)) break
      const raw = Math.min(baseDelay * factor ** i, 5000)
      await new Promise((r) => setTimeout(r, jitter ? Math.round(raw * (0.5 + Math.random())) : raw))
    }
  }
  lastError.attempts = retries + 1
  throw lastError
}

/* ============================== 事件总线 ============================== */
export class EventBus {
  constructor() {
    this.map = new Map()
  }
  on(event, handler) {
    if (!this.map.has(event)) this.map.set(event, new Set())
    this.map.get(event).add(handler)
    return () => this.off(event, handler)
  }
  off(event, handler) {
    this.map.get(event)?.delete(handler)
  }
  emit(event, ...args) {
    // 复制一份再遍历：回调里 off 自己不会破坏本次派发
    ;[...(this.map.get(event) || [])].forEach((fn) => fn(...args))
  }
}

/** 私有计数器：闭包维护状态，外部拿不到引用 */
export function createPrivateCounter(initial = 0) {
  let count = initial
  return {
    inc(step = 1) { count += step; return count },
    value: () => count
  }
}

/* ============================== 错误收口 ============================== */
const errors = []
const listeners = new Set()

export function getErrors() {
  return errors.slice()
}

export function onError(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function installErrorHooks(app) {
  window.addEventListener('error', (e) => {
    const target = e.target
    const record = target && target !== window && target.tagName
      ? { kind: 'resource', message: `${target.tagName} 加载失败: ${target.src || target.href || ''}` }
      : { kind: 'script', message: e.message }
    errors.push(record)
    listeners.forEach((fn) => fn(record))
  }, true)

  window.addEventListener('unhandledrejection', (e) => {
    const record = {
      kind: 'promise',
      message: e.reason?.message ? e.reason.message : String(e.reason)
    }
    errors.push(record)
    listeners.forEach((fn) => fn(record))
  })

  const prev = app.config.errorHandler
  app.config.errorHandler = (err, instance, info) => {
    const record = { kind: 'vue', message: String(err?.message || err), info }
    errors.push(record)
    listeners.forEach((fn) => fn(record))
    if (typeof prev === 'function') prev(err, instance, info)
  }
}
