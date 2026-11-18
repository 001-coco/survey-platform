export function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

/**
 * 判断题目当前是否应该显示（逻辑引擎的最小实现）
 *
 * 设计说明：
 * 编辑器里限制了只能依赖「排在前面的题」，因此按题目顺序单向求值，
 * 依赖图天然无环，不需要运行时的循环引用检测。
 * 如果放开顺序限制，就必须改成 DAG 拓扑排序 + 环检测（DFS 三色标记）。
 */
export function isVisible(question, model) {
  const condition = question.condition
  if (!condition || !condition.dependsOn) return true

  const actual = model[condition.dependsOn]
  switch (condition.operator) {
    case 'eq':
      return Array.isArray(actual) ? actual.includes(condition.value) : actual === condition.value
    case 'neq':
      return !(Array.isArray(actual) ? actual.includes(condition.value) : actual === condition.value)
    case 'empty':
      return isEmptyValue(actual)
    case 'notEmpty':
      return !isEmptyValue(actual)
    default:
      return true
  }
}

/**
 * 表单校验：只对「当前可见」的题目做必填校验，
 * 避免因为条件题隐藏了却仍然报错。
 * @returns {{valid: boolean, errors: Record<string, string>}}
 */
export function validateQuestions(questions, model) {
  const errors = {}
  for (const question of questions) {
    if (!isVisible(question, model)) continue

    const value = model[question.id]
    if (question.required && isEmptyValue(value)) {
      errors[question.id] = '此题为必填'
      continue
    }
    if (question.pattern && value && !new RegExp(question.pattern).test(String(value))) {
      errors[question.id] = '格式不正确'
    }
  }
  return { valid: Object.keys(errors).length === 0, errors }
}
