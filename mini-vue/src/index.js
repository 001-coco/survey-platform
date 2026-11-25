// 统一出口：外部只需 import { xxx } from './index.js'，不必关心内部目录结构
export { reactive, isReactive } from './reactivity/reactive.js'                    // 响应式对象：reactive 与判断函数
export { effect, track, trigger, Effect, current } from './reactivity/effect.js'   // 依赖收集核心（Effect 原名 ReactiveEffect，current 原名 activeEffect）
export { ref, isRef } from './reactivity/ref.js'                                   // 基础类型响应式：ref 与判断函数
export { computed } from './reactivity/computed.js'                                // 计算属性：带缓存的派生值
export { h } from './runtime/h.js'                                                 // 创建虚拟节点 VNode
export { mount, patch } from './runtime/renderer.js'                               // 渲染器：首次挂载 mount 与更新 patch
export { queueJob, nextTick } from './scheduler.js'                                // 调度器：批量更新与 nextTick
