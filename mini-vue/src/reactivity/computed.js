import { Effect } from './effect.js'                              // 引入 effect 类（原名 ReactiveEffect），computed 内部用它来执行 getter
import { track, trigger } from './effect.js'                      // 引入依赖收集与派发更新

/**
 * computed：带缓存的派生值。
 * 核心是 _dirty 脏标记：
 *   - 依赖变化时，不立即重新计算，只把 _dirty 置为 true
 *   - 下次读取 .value 时才真正计算（懒计算 lazy）
 *   - 依赖没变时直接返回缓存值
 */
class Computed {                                                  // computed 的实现类（原名 ComputedRefImpl）
  constructor(getter, setter) {                                    // 接收 getter 与可选的 setter
    this._value = undefined                                        // 缓存计算结果，初始还没算过
    this._dirty = true                                             // 脏标记：true 表示需要重新计算
    this.setter = setter                                           // 保存 setter，供外部赋值时调用

    this.effect = new Effect(getter, () => {                        // 用 Effect 包装 getter，并传入自定义调度器
      // 依赖变化时的调度：标记脏，并通知依赖 computed 的 effect
      if (!this._dirty) {                                          // 已经是脏的就不用重复标记（避免重复触发）
        this._dirty = true                                         // 标记脏：下次读取时才重新计算（懒计算）
        trigger(this, 'value', 'SET')                              // 通知「依赖这个 computed 的 effect」也要更新
      }
    })
  }                                                                // 结束构造函数

  get value() {                                                    // 读 computed.value 时触发
    track(this, 'value')                                           // computed 自身也要被收集（其他 effect 依赖它）
    if (this._dirty) {                                             // 如果是脏的，说明需要重新计算
      this._dirty = false                                          // 先置为干净，避免重复计算
      this._value = this.effect.run()                              // 真正执行 getter，并把结果缓存起来
    }
    return this._value                                             // 返回缓存值（没脏就直接返回，这正是缓存的意义）
  }                                                                // 结束 getter

  set value(newValue) {                                            // 写 computed.value 时触发
    this.setter(newValue)                                          // 调用用户传的 setter；只读模式下它会 warn
  }                                                                // 结束 setter
}                                                                  // 结束 Computed 类

export function computed(getterOrOptions) {                        // 对外暴露的 computed 函数
  let getter                                                       // 声明 getter 变量
  let setter                                                       // 声明 setter 变量

  if (typeof getterOrOptions === 'function') {                     // 只传了一个函数 → 表示只读 computed
    getter = getterOrOptions                                       // 这个函数就是 getter
    setter = () => {                                               // 没有 setter，给一个告警版本
      console.warn('[mini-vue] computed 是只读的')                  // 试图赋值时给出提示
    }
  } else {                                                         // 传的是 { get, set } 对象 → 可写 computed
    getter = getterOrOptions.get                                   // 取出 get 方法
    setter = getterOrOptions.set                                   // 取出 set 方法
  }

  return new Computed(getter, setter)                              // 创建实例并返回
}
