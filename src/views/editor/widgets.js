/** 物料区：支持的题型 */
export const WIDGET_TYPES = [
  { type: 'input', label: '单行文本' },
  { type: 'textarea', label: '多行文本' },
  { type: 'radio', label: '单选题' },
  { type: 'checkbox', label: '多选题' }
]

export const WIDGET_TYPE_LABEL = WIDGET_TYPES.reduce((map, item) => {
  map[item.type] = item.label
  return map
}, {})

let seed = 0
export function createId(prefix = 'q') {
  seed += 1
  return `${prefix}_${Date.now().toString(36)}${seed}`
}

/**
 * 一道题的 Schema（这就是整个项目的核心协议）
 * @typedef {Object} Question
 * @property {string} id
 * @property {'input'|'textarea'|'radio'|'checkbox'} type
 * @property {string} title
 * @property {boolean} required
 * @property {string} placeholder
 * @property {Array<{label: string, value: string}>} [options]
 * @property {{dependsOn: string, operator: string, value: string}|null} [condition]
 */
export function createQuestion(type) {
  const question = {
    id: createId(),
    type,
    title: '未命名题目',
    required: false,
    placeholder: '',
    condition: null
  }
  if (type === 'input' || type === 'textarea') {
    question.placeholder = '请输入'
  }
  if (type === 'radio' || type === 'checkbox') {
    question.options = [
      { label: '选项 1', value: createId('o') },
      { label: '选项 2', value: createId('o') }
    ]
  }
  return question
}

/** 新建问卷的默认 Schema */
export function createSurveySchema() {
  return {
    title: '未命名问卷',
    desc: '',
    questions: []
  }
}
