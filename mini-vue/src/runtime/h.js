/**
 * 创建虚拟 DOM 节点（VNode）
 * @param {string} tag 标签名
 * @param {object|null} props 属性 / 事件（on 开头视为事件）
 * @param {string|number|Array} children 子节点
 */
export function h(tag, props, children) {        // 导出 h 函数，用来创建虚拟节点
  return {                                        // 返回一个描述「想要什么 DOM」的普通对象，即 VNode
    tag,                                          // 标签名，例如 'div'、'button'、'ul'
    props: props || {},                            // 属性对象；没传就用空对象兜底，避免后面遍历时报错
    children,                                      // 子节点：可以是字符串/数字，也可以是 VNode 数组
    key: props && props.key,                       // 从 props 里取出 key（本实现是简化版，未做 key 级别复用）
    el: null                                       // 挂载后指向真实 DOM 节点，创建时先置为 null
  }                                                // 结束返回的 VNode 对象
}                                                  // 结束 h 函数
