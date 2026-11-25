/**
 * 渲染器：VNode -> 真实 DOM
 * 包含首次挂载 mount 与更新 patch 两个流程。
 */

/** 首次挂载 */
export function mount(vnode, container) {                                    // 首次挂载：把 VNode 变成真实 DOM 并插入容器
  const el = document.createElement(vnode.tag)                               // 按 tag 创建真实 DOM 元素
  vnode.el = el                                                              // 把真实 DOM 记回 VNode，后续 patch 时复用

  patchProps({}, vnode.props, el)                                            // 挂属性（旧 props 传空对象，表示全部都是新增）
  mountChildren(vnode.children, el)                                          // 递归挂载子节点

  container.appendChild(el)                                                 // 最后插入容器，元素才真正显示到页面上
}                                                                            // 结束 mount

function mountChildren(children, el) {                                       // 把子节点挂到父元素上
  if (children == null) return                                               // 没有子节点（null / undefined）直接返回
  if (typeof children === 'string' || typeof children === 'number') {        // 子节点是文本或数字
    el.textContent = String(children)                                        // 直接设置文本内容（会清空已有子节点）
    return                                                                   // 文本没有更深层，结束
  }
  if (Array.isArray(children)) {                                             // 子节点是数组（多个 VNode）
    children.forEach((child) => {                                            // 遍历每一个子节点
      if (child) mount(child, el)                                            // 跳过空值，递归挂载到父元素
    })
  }
}                                                                            // 结束 mountChildren

/** 更新：对比新旧 VNode，做最小化 DOM 操作 */
export function patch(n1, n2, container) {                                    // 更新：对比新旧 VNode，做最小化 DOM 操作
  if (n1 === n2) return                                                       // 完全是同一个对象（没变化），直接返回

  // 标签不同：直接整棵替换，没有复用价值
  if (n1.tag !== n2.tag) {                                                    // 标签都不一样，没有复用价值
    const parent = n1.el.parentNode || container                              // 找到旧节点所在的父容器
    parent.removeChild(n1.el)                                                 // 移除旧 DOM
    mount(n2, parent)                                                         // 挂载新节点
    return                                                                    // 结束
  }

  const el = (n2.el = n1.el)                                                  // 标签相同：复用同一个真实 DOM 节点
  patchProps(n1.props, n2.props, el)                                          // 对比并更新属性
  patchChildren(n1, n2, el)                                                   // 对比并更新子节点
}                                                                             // 结束 patch

function patchProps(oldProps, newProps, el) {                                 // 对比新旧属性并更新到 DOM
  // 新增 / 修改
  for (const key in newProps) {                                               // 遍历新属性
    const prev = oldProps[key]                                                // 取出旧值
    const next = newProps[key]                                                // 取出新值
    if (prev === next) continue                                               // 值没变就跳过，避免无意义的 DOM 操作
    setProp(el, key, prev, next)                                              // 把变化设置到真实 DOM 上
  }
  // 旧有新无：移除
  for (const key in oldProps) {                                               // 遍历旧属性
    if (!(key in newProps)) setProp(el, key, oldProps[key], null)             // 新属性里没有了，传 null 表示移除
  }
}                                                                             // 结束 patchProps

function setProp(el, key, prevValue, nextValue) {                              // 把单个属性设置到 DOM 上
  // 事件：onClick -> click
  if (key.startsWith('on')) {                                                  // on 开头视为事件
    const event = key.slice(2).toLowerCase()                                   // 'onClick' 去掉 on 再转小写 → 'click'
    if (prevValue) el.removeEventListener(event, prevValue)                    // 先解绑旧函数（每次渲染函数引用都是新的）
    if (nextValue) el.addEventListener(event, nextValue)                       // 再绑定新函数
    return                                                                     // 事件处理完直接返回
  }
  // 样式对象
  if (key === 'style' && typeof nextValue === 'object' && nextValue !== null) { // style 是对象的情况
    Object.assign(el.style, nextValue)                                         // 合并到 el.style 上
    return                                                                     // 处理完返回
  }
  if (nextValue == null || nextValue === false) el.removeAttribute(key)        // 值为 null / false 表示移除该属性
  else el.setAttribute(key, nextValue)                                         // 否则设置成字符串属性
}                                                                              // 结束 setProp

function patchChildren(n1, n2, el) {                                           // 对比并更新子节点
  const c1 = n1.children                                                       // 旧子节点
  const c2 = n2.children                                                       // 新子节点

  // 新子节点是文本
  if (typeof c2 === 'string' || typeof c2 === 'number') {                      // 新的子节点是文本或数字
    if (c1 !== c2) el.textContent = String(c2)                                 // 内容变了才更新（textContent 会清空旧子节点）
    return                                                                     // 结束
  }

  // 新子节点是数组
  if (Array.isArray(c2)) {                                                     // 新的子节点是 VNode 数组
    if (Array.isArray(c1)) {                                                   // 旧的也是数组 → 做 diff
      // 简化版 diff：按下标一一对比（Vue 真实实现用双端 + 最长递增子序列做 key 复用）
      const commonLength = Math.min(c1.length, c2.length)                      // 取两者中较短的长度
      for (let i = 0; i < commonLength; i++) patch(c1[i], c2[i], el)          // 按下标逐个递归 patch
      // 新增的节点
      if (c2.length > c1.length) {                                             // 新的更长 → 多出来的是新增
        c2.slice(c1.length).forEach((child) => mount(child, el))               // 挂载多出来的节点
      } else if (c2.length < c1.length) {                                      // 新的更短 → 多出来的要删除
        c1.slice(c2.length).forEach((child) => el.removeChild(child.el))       // 移除多余的 DOM
      }
    } else {
      // 原来是文本，清空后挂载
      el.textContent = ''                                                      // 清空原来的文本（文本节点没法做 diff）
      c2.forEach((child) => mount(child, el))                                  // 逐个挂载新节点
    }
  }
}                                                                              // 结束 patchChildren
