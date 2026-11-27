/**
 * 手写请求内核（替换 axios）
 *
 * 这一层把以前由 axios 提供的能力全部自己实现：
 *   1. 请求/响应拦截：统一 headers、统一拆 { code, data, message }
 *   2. 双 token 无感刷新：refreshPromise 单例 + 401 重放
 *   3. 重试：仅对网络错误 / 5xx 重试，4xx 不重试（重试也没用）
 *   4. 并发控制：runPool 限制「任务创建」而不是「已有 promise」
 *   5. Promise 静态方法：myAll / myAllSettled 用于批量操作
 */
import { ElMessage } from 'element-plus'
import { retry, runPool, myAll, myAllSettled, myRace, myAny } from '@/core'

const BASE_URL = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

/** refresh 单例：同一时刻 5 个请求 401，只发一次 /auth/refresh */
let refreshPromise = null

function refreshToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.code !== 0 || !body.data?.token) throw new Error('refresh failed')
        localStorage.setItem('token', body.data.token)
        return body.data.token
      })
      .finally(() => {
        // 必须复位，否则后续所有刷新都拿到这个已完成的旧 promise
        refreshPromise = null
      })
  }
  return refreshPromise
}

function clearLoginState() {
  ;['token', 'refreshToken', 'username', 'role'].forEach((key) => localStorage.removeItem(key))
  window.location.hash = '#/login'
}

/** 最底层的一次 fetch，不含重试与刷新 */
async function rawRequest({ path, method, params, body, auth, signal }) {
  let url = BASE_URL + path
  if (params && Object.keys(params).length) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, String(v))
    })
    const qs = query.toString()
    if (qs) url += `?${qs}`
  }

  const headers = {}
  if (auth) {
    const token = localStorage.getItem('token')
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('json') ? await response.json() : await response.text()

  if (!response.ok) {
    const error = new Error(payload?.message || `HTTP ${response.status}`)
    error.status = response.status
    error.response = payload
    throw error
  }
  if (payload && typeof payload === 'object' && payload.code !== undefined && payload.code !== 0) {
    const error = new Error(payload.message || '请求失败')
    error.code = payload.code
    throw error
  }
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
}

/** 401 → 刷新 → 重放一次；_retry 标记防止重放后再次 401 时死循环 */
async function withAuthRefresh(options, retried = false) {
  try {
    return await rawRequest(options)
  } catch (error) {
    const isAuthApi = options.path.includes('/auth/')
    if (error.status === 401 && !retried && !isAuthApi) {
      try {
        await refreshToken()
        return await rawRequest(options, true)
      } catch (refreshError) {
        clearLoginState()
        throw refreshError
      }
    }
    if (error.status === 401) clearLoginState()
    throw error
  }
}

function shouldRetry(error) {
  // 网络错误（status 为 undefined）和 5xx 值得重试；4xx 是请求本身有问题
  if (error.name === 'AbortError') return false
  if (error.status === undefined) return true
  return error.status >= 500
}

function createMethod(method) {
  return function request(path, config = {}) {
    const options = {
      path,
      method,
      params: config.params,
      body: config.data,
      auth: config.auth !== false,
      signal: config.signal
    }

    const exec = () => withAuthRefresh(options)

    if (method === 'GET' && config.retry !== false) {
      return retry(exec, { retries: 1, baseDelay: 220, shouldRetry })
    }
    return exec().catch((error) => {
      if (error.name !== 'AbortError' && !config.silent) {
        ElMessage.error(error.message || '请求失败')
      }
      throw error
    })
  }
}

const request = {
  get: createMethod('GET'),
  post: createMethod('POST'),
  put: createMethod('PUT'),
  delete: createMethod('DELETE'),

  /** 批量请求：全部成功才算成功，任一失败立即失败 */
  all: myAll,
  allSettled: myAllSettled,
  race: myRace,
  any: myAny,

  /**
   * 并发受限的批量请求。
   * 注意传进来的是「任务函数数组」而不是 promise 数组：
   * promise 一旦创建就已经在跑了，对已存在的 promise 做限流是自欺欺人。
   */
  pool: runPool
}

export default request
