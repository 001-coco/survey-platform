import { track, trigger } from './effect.js'    // 引入依赖收集与派发更新（ref 与 reactive 共用同一套体系）
import { reactive } from './reactive.js'        // 引入 reactive：ref 存对象时需要转成响应式
import { isObject } from '../shared.js'         // 引入判断是否为对象的工具函数

/**
 * ref 的身份标记名。
 * 常量名（左边的 REF_FLAG）可以随便改，右边的字符串不能改 —— 它是 Vue 生态的约定，
 * 模板自动解包、unref、第三方库识别一个值是不是 ref，全靠这个字符串。
 */
const REF_FLAG = '__v_isRef'

/**
 * ref：让基础类型（string / number / boolean）也能具备响应式。
 * 实现原理：包一层对象，用 .value 访问，在 .value 的 getter/setter 上做依赖收集。
 */
class Ref {                                                  // ref 的实现类（原名 RefImpl，Impl 是 implementation 的缩写）
  constructor(value) {                                        // 构造时接收初始值
    this[REF_FLAG] = true                                     // 身份标记：让 isRef() 能认出这是一个 ref
    this._rawValue = value                                    // 保存原始值，用于比较（避免对象被 reactive 包装后比不出来）
    this._value = isObject(value) ? reactive(value) : value   // 实际存储的值：对象就转 reactive，基础类型原样存
  }                                                            // 结束构造函数

  get value() {                                                // 读 ref.value 时触发
    track(this, 'value')                                       // 收集依赖；ref 只有一个值，所以 key 固定为 'value'
    return this._value                                         // 返回存储的值
  }                                                            // 结束 getter

  set value(newVal) {                                          // 写 ref.value 时触发
    if (Object.is(newVal, this._rawValue)) return               // 值没变就直接返回，避免无意义的更新
    this._rawValue = newVal                                    // 更新原始值，供下次比较用
    this._value = isObject(newVal) ? reactive(newVal) : newVal  // 更新存储的值（对象转 reactive）
    trigger(this, 'value', 'SET')                              // 派发更新：通知所有依赖这个 ref 的 effect 重新执行
  }                                                            // 结束 setter
}                                                              // 结束 Ref 类

export function ref(value) {                                   // 对外暴露的 ref 函数
  return new Ref(value)                                        // 创建一个 Ref 实例并返回
}

export function isRef(value) {                                 // 判断一个值是不是 ref
  return !!(value && value[REF_FLAG])                          // 读取身份标记并转成布尔值（!! 保证返回 true/false）
}
