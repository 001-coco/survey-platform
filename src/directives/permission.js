/**
 * 按钮级权限指令：v-permission="'admin'"
 * 注意：这只是前端的展示层控制，真正的权限校验必须在后端做数据归属判断
 * （见 server/index.js 中每个查询都带 creatorId 的写法）。
 */
export default {
  mounted(el, binding) {
    const role = localStorage.getItem('role')
    const required = binding.value
    if (!required) return
    const allowed = Array.isArray(required) ? required.includes(role) : required === role
    if (!allowed) {
      el.parentNode?.removeChild(el)
    }
  }
}
