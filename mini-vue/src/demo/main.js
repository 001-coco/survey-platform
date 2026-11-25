import { reactive, ref, computed, effect } from '../index.js'        // 从统一出口引入响应式 API
import { h } from '../runtime/h.js'                                  // 引入创建 VNode 的 h 函数
import { mount, patch } from '../runtime/renderer.js'                // 引入渲染器：首次挂载 mount 与更新 patch
import { queueJob } from '../scheduler.js'                           // 引入调度器：把多次更新合并成一次

/* ---------------- 状态 ---------------- */
const state = reactive({                                             // 创建响应式对象
  count: 0,                                                          // 计数器
  todos: ['实现 reactive', '实现 effect', '实现渲染器']                 // 任务列表（数组响应式）
})
const msg = ref('hello mini-vue')                                    // 创建 ref：让字符串也具备响应式
const double = computed(() => state.count * 2)                        // 创建 computed：依赖 count 的派生值

/* ---------------- 渲染函数 ---------------- */
function render() {                                                  // 渲染函数：返回一棵描述 UI 的 VNode 树
  return h('div', { class: 'app' }, [                                 // 根节点：div.app
    h('h2', null, 'mini-vue 演示'),                                   // 标题

    h('p', null, `count = ${state.count}，double = ${double.value}`), // 读 count 与 computed → 触发依赖收集
    h('p', { style: { color: '#409eff' } }, `ref msg = ${msg.value}`),// 读 ref.value → 触发依赖收集

    h('div', null, [                                                 // 按钮区域
      // 一次点击里改两次，用来验证调度器的批量更新（控制台只打印一次 render）
      h('button', { onClick: () => { state.count++; state.count++ } }, 'count +2（验证批量更新）'),
      h('button', { onClick: () => { msg.value = 'changed @ ' + new Date().toLocaleTimeString() } }, '修改 ref'),
      h('button', { onClick: () => state.todos.push('新任务 ' + (state.todos.length + 1)) }, '添加任务')
    ]),

    h('ul', null, state.todos.map((t) => h('li', null, t)))           // 列表：依赖 todos 及其 length
  ])
}                                                                    // 结束 render

/* ---------------- 挂载 / 更新 ---------------- */
const container = document.querySelector('#app')                      // 找到页面上的挂载容器 #app
let oldVNode = null                                                   // 保存上一次的 VNode，供 patch 做对比

function update() {                                                   // 执行一次完整的「渲染 + 打补丁」
  console.log('[render] 执行一次')                                     // 打印执行次数，用来验证批量更新是否生效
  const newVNode = render()                                           // 生成新的 VNode 树（读取数据时完成依赖收集）
  if (!oldVNode) mount(newVNode, container)                           // 第一次：直接挂载，无需对比
  else patch(oldVNode, newVNode, container)                           // 后续：新旧对比，只更新变化的部分
  oldVNode = newVNode                                                 // 把这次的 VNode 存为「旧的」，供下次对比
}                                                                     // 结束 update

// effect 内部调用 render()，读取响应式数据 -> 完成依赖收集
// 数据变化时走 scheduler -> queueJob -> 微任务批量合并后再 patch
effect(() => {                                                        // 用 effect 包住渲染逻辑，建立响应式联系
  render()                                                            // 这里只负责「读数据」完成收集，不负责挂载
}, {
  scheduler: () => queueJob(update)                                   // 数据变化时把 update 排进微任务队列，批量执行
})

update()                                                              // 手动执行一次，完成首次挂载（此时页面才有内容）
