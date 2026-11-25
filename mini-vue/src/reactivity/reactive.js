import { track, trigger } from './effect.js'                     // 引入依赖收集与派发更新
import { isObject, ALL_KEYS } from '../shared.js'                // 引入判断对象的工具函数与遍历依赖 key（原名 ITERATE_KEY）

export const REACTIVE_FLAG = '__v_isReactive'                    // 响应式标记的「属性名」（原名 IS_REACTIVE）
                                                                 // 注意：右边那个字符串不能改，是 Vue 生态的约定

/** 缓存已代理过的对象，避免同一对象被重复代理 */
const reactiveMap = new WeakMap()                                 // 缓存表：原对象 -> 代理对象

/**
 * 为什么用 Proxy 而不是 Object.defineProperty：
 * 1. 能拦截「新增属性」「删除属性」，defineProperty 做不到
 * 2. 能拦截数组下标赋值与 length 变化，不需要重写数组方法
 * 3. 懒代理：只有真正访问到嵌套对象时才递归代理，初始化开销小
 */
const handlers = {                                                // Proxy 的拦截器集合（原名 baseHandlers）
  get(target, key, receiver) {                                    // 拦截属性读取：obj.a
    if (key === REACTIVE_FLAG) return true                        // 有人查询「你是不是响应式」，直接返回 true（不污染原对象）

    const res = Reflect.get(target, key, receiver)                // 用 Reflect 取值；receiver 保证 getter 里的 this 指向 proxy
    track(target, key)                                            // 收集依赖：记录「谁在读这个属性」

    // 懒代理（lazy reactive）：访问到才转成响应式
    return isObject(res) ? reactive(res) : res                    // 取到的是对象就递归代理；基础类型原样返回
  },                                                              // 结束 get

  set(target, key, value, receiver) {                             // 拦截属性写入：obj.a = 1
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)  // 写入前这个属性是否已存在
    const oldValue = target[key]                                  // 保存旧值，用于后面判断是否真的变化
    const result = Reflect.set(target, key, value, receiver)      // 用 Reflect 写入，返回布尔值表示成功与否

    if (!hadKey) {                                                // 之前没有这个属性 → 属于新增
      trigger(target, key, 'ADD')                                 // 以 ADD 类型派发（会影响遍历结果，需额外处理）
    } else if (!Object.is(oldValue, value)) {                     // 属性已存在，且值确实发生了变化
      // 值没变就不触发，避免无意义的更新
      trigger(target, key, 'SET')                                 // 以 SET 类型派发
    }
    return result                                                 // 返回 Reflect.set 的布尔结果（严格模式要求）
  },                                                              // 结束 set

  deleteProperty(target, key) {                                   // 拦截属性删除：delete obj.a
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)  // 删除前是否真的存在这个属性
    const result = Reflect.deleteProperty(target, key)            // 执行删除，返回是否成功
    if (hadKey && result) trigger(target, key, 'DELETE')          // 确实删掉了才派发更新
    return result                                                 // 返回删除结果
  },                                                              // 结束 deleteProperty

  // 拦截 `key in obj`
  has(target, key) {                                              // 拦截 in 操作符：'a' in obj
    track(target, key)                                            // 也要收集依赖（有人关心这个 key 是否存在）
    return Reflect.has(target, key)                               // 返回是否包含该属性
  },                                                              // 结束 has

  // 拦截 Object.keys / for...in
  ownKeys(target) {                                               // 拦截键名枚举：Object.keys(obj) / for...in
    track(target, ALL_KEYS)                                       // 用 ALL_KEYS 收集：遍历不针对某个具体 key
    return Reflect.ownKeys(target)                                // 返回所有自有键名
  }                                                               // 结束 ownKeys
}                                                                 // 结束 handlers

export function reactive(target) {                                // 对外暴露的 reactive 函数
  if (!isObject(target)) return target                            // 不是对象（数字、字符串等）直接原样返回
  if (target[REACTIVE_FLAG]) return target                        // 已经是响应式对象，直接返回（避免重复代理）

  const existing = reactiveMap.get(target)                        // 查缓存：这个原对象是不是已经代理过
  if (existing) return existing                                   // 代理过就返回同一个代理对象（保证 === 成立）

  const proxy = new Proxy(target, handlers)                       // 创建代理对象，套上上面那套拦截器
  reactiveMap.set(target, proxy)                                  // 存入缓存，下次访问直接复用
  return proxy                                                    // 返回代理对象
}

export function isReactive(value) {                               // 判断一个值是不是响应式对象
  return !!(value && value[REACTIVE_FLAG])                        // 读取标记（会命中 get 拦截器的特判分支）并转布尔
}
