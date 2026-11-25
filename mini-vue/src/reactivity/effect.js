import { ALL_KEYS } from '../shared.js'                       // 引入「遍历整个对象」对应的依赖 key（原名 ITERATE_KEY）

/**
 * 当前正在执行的 effect。
 * 为什么需要它：track() 是在 getter 里被调用的，它必须知道"现在是谁在读取我"。
 */
export let current = null                                      // 当前正在执行的 effect（原名 activeEffect）

/**
 * effect 栈：解决嵌套 effect 问题。
 * 组件渲染本身就是嵌套 effect（父组件渲染 -> 子组件渲染），
 * 如果只用一个变量保存 current，内层 effect 执行完会把外层的覆盖掉，
 * 导致外层组件后续的依赖收集丢失。用栈保存即可恢复现场。
 */
const stack = []                                               // 用栈保存 effect，解决嵌套时的覆盖问题（原名 effectStack）

/**
 * 依赖收集的核心数据结构：WeakMap -> Map -> Set
 *
 * WeakMap<target, Map<key, Set<Effect>>>
 *   WeakMap：key 是对象，且是弱引用 —— 响应式对象被销毁时能被 GC 回收，避免内存泄漏
 *   Map    ：每个属性的依赖集合
 *   Set    ：依赖去重，同一个 effect 读两次同一个属性只收集一次
 */
const targetMap = new WeakMap()                                // 全局依赖表：target -> key -> effects

export function getTargetMap() {                               // 导出依赖表，方便调试时查看当前依赖关系
  return targetMap                                             // 返回依赖表本身
}

export class Effect {                                          // 把一个副作用函数封装成对象（原名 ReactiveEffect）
  constructor(fn, scheduler = null) {                          // 接收执行函数与可选的调度器
    this.fn = fn                                               // 保存要执行的函数本体
    this.scheduler = scheduler                                 // 有调度器时，trigger 不再直接 run，而是交给调度器决定何时执行
    this.deps = []                                             // 反向记录：我订阅了哪些 dep，供 stop() 清理用
    this.active = true                                         // 是否处于可用状态；stop() 后变为 false
  }                                                            // 结束构造函数

  run() {                                                      // 执行这个 effect
    // 已 stop 的 effect 直接执行函数本体（不收集依赖）
    if (!this.active) return this.fn()                         // 已停止：只跑函数，不再建立依赖关系

    try {                                                      // 用 try/finally 保证即使函数抛错也一定出栈
      clearDeps(this)                                          // 执行前先清理旧依赖：处理 v-if 分支切换导致的依赖失效（原名 cleanupEffect）
      stack.push(this)                                         // 入栈：把当前这一层压进去
      current = this                                          // 把「当前 effect」指向自己，供 getter 里的 track 使用
      return this.fn()                                         // 真正执行函数；执行中读数据会自动完成依赖收集
    } finally {
      stack.pop()                                              // 出栈：本层执行完毕
      current = stack[stack.length - 1] || null                // 恢复上一层 effect；栈空了就置为 null
    }
  }                                                            // 结束 run

  stop() {                                                     // 停止这个 effect 的响应式能力
    if (this.active) {                                         // 只在还活跃时才需要清理
      clearDeps(this)                                          // 把自己从所有订阅过的 dep 里移除
      this.active = false                                      // 标记为已停止
    }
  }                                                            // 结束 stop
}                                                              // 结束 Effect 类

function clearDeps(effect) {                                   // 清理某个 effect 订阅的所有依赖（原名 cleanupEffect）
  const { deps } = effect                                      // 取出它订阅过的 dep 列表
  for (let i = 0; i < deps.length; i++) deps[i].delete(effect)  // 逐个把自己从 dep（Set）里删掉
  deps.length = 0                                              // 清空自己的记录，下次执行时重新收集
}                                                              // 结束 clearDeps

/**
 * @param {Function} fn
 * @param {{scheduler?: Function}} options
 * @returns {Function} runner，手动触发执行
 */
export function effect(fn, options = {}) {                     // 对外暴露的 effect 函数
  const _effect = new Effect(fn, options.scheduler || null)     // 包装成 Effect 实例
  _effect.run()                                                // 立即执行一次，触发首次依赖收集（不执行就收集不到依赖）
  const runner = _effect.run.bind(_effect)                     // 返回可手动调用的 runner，this 绑定为 _effect
  runner.effect = _effect                                      // 把实例挂到 runner 上，方便 runner.effect.stop()
  return runner                                                // 返回 runner
}

/** 依赖收集：在 getter 中调用 */
export function track(target, key) {                            // 收集依赖：记录「谁在读 target 的 key」
  if (!current) return                                          // 没有 effect 在运行时（普通读取），不需要收集

  let depsMap = targetMap.get(target)                           // 取出这个 target 对应的第二层 Map
  if (!depsMap) {                                               // 这个 target 第一次被访问
    depsMap = new Map()                                         // 新建第二层：key -> dep
    targetMap.set(target, depsMap)                              // 存进第一层 WeakMap
  }
  let dep = depsMap.get(key)                                    // 取出这个 key 对应的依赖集合
  if (!dep) {                                                   // 这个 key 第一次被访问
    dep = new Set()                                             // 新建 Set 存 effect（Set 自动去重）
    depsMap.set(key, dep)                                       // 存进第二层 Map
  }
  if (!dep.has(current)) {                                      // 避免重复收集：同一 effect 读两次同一属性只记一次
    dep.add(current)                                            // 正向记录：这个 key 被这个 effect 订阅了
    current.deps.push(dep)                                      // 反向记录：这个 effect 订阅了这个 dep（供 clearDeps 用）
  }
}                                                               // 结束 track

/** 派发更新：在 setter / deleteProperty 中调用 */
export function trigger(target, key, type) {                     // 派发更新：通知所有订阅了 target.key 的 effect
  const depsMap = targetMap.get(target)                          // 取出这个 target 的第二层 Map
  if (!depsMap) return                                           // 从未被收集过依赖，直接返回

  const effects = new Set()                                      // 临时集合：存放本轮要执行的 effect（顺便去重）

  const add = (dep) => {                                         // 内部函数：把一个 dep 里的 effect 加进待执行集合
    if (!dep) return                                             // dep 不存在就跳过
    dep.forEach((e) => {                                         // 遍历这个 dep 里的每个 effect
      // 避免自我递归：正在执行的 effect 不再触发自己
      if (e !== current) effects.add(e)                          // 排除正在执行的自己，防止死循环
    })
  }                                                              // 结束 add

  add(depsMap.get(key))                                          // 先加入当前 key 对应的依赖

  // 新增/删除属性会影响 for...in 与 Object.keys 的结果，
  // 数组则是 length 变化，需要额外触发对应的依赖
  if (type === 'ADD' || type === 'DELETE') {                     // 新增或删除属性时
    add(depsMap.get(Array.isArray(target) ? 'length' : ALL_KEYS))  // 数组额外触发 length，对象额外触发 ALL_KEYS
  }

  effects.forEach((e) => {                                       // 遍历所有待执行的 effect
    if (e.scheduler) e.scheduler()                               // 有调度器就交给调度器（例如批量更新）
    else e.run()                                                 // 没有调度器就直接重新执行
  })
}                                                                // 结束 trigger
