import { shallowRef, computed } from 'vue'
import { deepClone, createPrivateCounter } from '@/core'

/**
 * 撤销 / 重做：基于「快照」的历史栈
 *
 * 为什么用快照而不是命令模式：
 *   - 题目 Schema 是纯 JSON，深拷贝成本可控
 *   - 快照不会出现「反向操作写错」的 bug
 *   - 题目量级上千时应改成命令模式（记录 do / undo）
 *
 * 这一版把 JSON.parse(JSON.stringify) 换成了手写 deepClone：
 *   - WeakMap 记录已拷贝对象，正确处理循环引用
 *   - Date / RegExp / Map / Set / 原型链都能保留
 * 并用闭包私有计数器记录「一共存过多少快照」，外部拿不到这个变量。
 */
export function useHistory(getSnapshot, applySnapshot, limit = 50) {
  const past = shallowRef([])
  const future = shallowRef([])

  // 私有计数器：闭包维护，外部无法直接改写
  const snapshotCounter = createPrivateCounter(0)

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const totalSnapshots = computed(() => snapshotCounter.value())

  /** 修改之前调用：把当前状态压入历史 */
  function record() {
    past.value = [...past.value, deepClone(getSnapshot())].slice(-limit)
    future.value = [] // 产生新操作时，重做栈失效
    snapshotCounter.inc()
  }

  function undo() {
    if (!canUndo.value) return
    const prev = past.value[past.value.length - 1]
    future.value = [deepClone(getSnapshot()), ...future.value]
    past.value = past.value.slice(0, -1)
    applySnapshot(deepClone(prev))
  }

  function redo() {
    if (!canRedo.value) return
    const next = future.value[0]
    past.value = [...past.value, deepClone(getSnapshot())]
    future.value = future.value.slice(1)
    applySnapshot(deepClone(next))
  }

  function reset() {
    past.value = []
    future.value = []
  }

  return { past, future, canUndo, canRedo, totalSnapshots, record, undo, redo, reset }
}
