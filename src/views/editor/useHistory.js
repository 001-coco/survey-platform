import { shallowRef, computed } from 'vue'

/**
 * 撤销 / 重做：基于「快照」的历史栈
 *
 * 为什么选快照而不是命令模式：
 *   - 题目 Schema 是纯 JSON，体积小，深拷贝成本可控
 *   - 快照实现简单、绝对不会出现「反向操作写错」的 bug
 *   - 代价：内存随题目数 × 历史步数线性增长
 * 面试可以补充：如果题目规模很大（比如上千题），应改为命令模式
 * （记录 { do, undo } 两个操作），内存只和操作粒度相关。
 *
 * @param {Function} getSnapshot    读取当前状态，需返回可 JSON 序列化的对象
 * @param {Function} applySnapshot  把某个快照写回状态
 * @param {number} limit            最多保留多少步历史
 */
export function useHistory(getSnapshot, applySnapshot, limit = 50) {
  // shallowRef：历史栈本身不需要深层响应式，避免大对象被 Proxy 递归代理带来的性能损耗
  const past = shallowRef([])
  const future = shallowRef([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  const clone = (value) => JSON.parse(JSON.stringify(value))

  /** 在「修改之前」调用，把当前状态压入历史 */
  function record() {
    past.value = [...past.value, clone(getSnapshot())].slice(-limit)
    future.value = [] // 产生新操作时，重做栈失效
  }

  function undo() {
    if (!canUndo.value) return
    const prev = past.value[past.value.length - 1]
    future.value = [clone(getSnapshot()), ...future.value]
    past.value = past.value.slice(0, -1)
    applySnapshot(clone(prev))
  }

  function redo() {
    if (!canRedo.value) return
    const next = future.value[0]
    past.value = [...past.value, clone(getSnapshot())]
    future.value = future.value.slice(1)
    applySnapshot(clone(next))
  }

  function reset() {
    past.value = []
    future.value = []
  }

  return { past, future, canUndo, canRedo, record, undo, redo, reset }
}
