/**
 * 调度器：把同一个微任务里的多次更新合并成一次。
 *
 * 为什么需要：
 *   state.count++; state.count++ 会触发两次 trigger，
 *   如果不做批量处理，渲染函数就会执行两次，浪费性能。
 *   Vue 的 nextTick 正是基于这个机制。
 *
 * 为什么用微任务（Promise.then）而不是 setTimeout：
 *   微任务在本轮同步代码执行完后立即执行，早于浏览器渲染，
 *   既能合并更新，又能保证 DOM 更新尽快发生。
 */
const queue = new Set()                 // 任务队列；用 Set 是为了天然去重，同一个 job 只保留一份
let isFlushing = false                  // 是否已经安排过刷新；防止每加一个 job 就注册一个微任务
const resolvedPromise = Promise.resolve() // 一个已 resolve 的 Promise，用来创建微任务

export function queueJob(job) {         // 把一个更新任务加入队列
  queue.add(job)                        // 加入队列，重复的 job 会被 Set 自动去重
  if (!isFlushing) {                    // 只有还没安排刷新时才安排，保证一轮只注册一次微任务
    isFlushing = true                   // 打标记：已经安排了刷新，后续 job 只需入队
    resolvedPromise.then(() => {        // 注册微任务：等本轮所有同步代码执行完后才触发
      try {
        queue.forEach((j) => j())       // 遍历执行队列里的任务；此时数据已稳定，只更新一次
      } finally {
        queue.clear()                   // 清空队列，为下一轮更新腾出空间
        isFlushing = false              // 重置标记，允许下一轮再安排刷新
      }
    })
  }
}

export function nextTick(fn) {          // 导出 nextTick，让调用方能在 DOM 更新之后再做事情
  return fn ? resolvedPromise.then(fn) : resolvedPromise  // 传了回调就排到微任务；没传就返回 Promise 供 await
}
