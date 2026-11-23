/**
 * 手写 UI 组件层 —— 零 UI 库依赖
 *
 * 设计思路：
 *   保留模板里原有的 <el-xxx> 标签名，但组件全部用原生 render 函数 + 手写 CSS 实现。
 *   这样既能证明 HTML/CSS/JS 基本功，又不必把十几个页面模板全部重写一遍。
 *
 * 全部组件都用 h() 写，没有 template 字符串 —— 因为 Vite 默认用的是 Vue 的 runtime 版本，
 * 编译期不处理 template 选项。这也是一个可以在面试里讲清楚的细节。
 */
import {
  h,
  reactive,
  provide,
  inject,
  onMounted,
  onBeforeUnmount,
  Teleport,
  defineComponent,
  ref,
  toRef,
  Fragment
} from 'vue'
import { useRouter } from 'vue-router'
import './ui.css'

/* ============================== Button ============================== */
const ElButton = defineComponent({
  name: 'ElButton',
  props: {
    type: { type: String, default: '' },
    size: { type: String, default: '' },
    link: Boolean,
    loading: Boolean,
    disabled: Boolean
  },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: [
            'ui-btn',
            props.type && `ui-btn--${props.type}`,
            props.size === 'small' && 'ui-btn--sm',
            props.link && 'ui-btn--link'
          ],
          disabled: props.disabled || props.loading,
          onClick: (e) => emit('click', e)
        },
        props.loading
          ? [h('span', { class: 'ui-spinner', 'aria-hidden': 'true' }), slots.default?.()]
          : slots.default?.()
      )
  }
})

/* ============================== Input ============================== */
const ElInput = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    type: { type: String, default: 'text' },
    placeholder: String,
    rows: { type: Number, default: 3 },
    disabled: Boolean,
    showPassword: Boolean,
    clearable: Boolean
  },
  emits: ['update:modelValue', 'input', 'blur', 'keyup'],
  setup(props, { emit, attrs }) {
    const visible = ref(!props.showPassword)
    const onValue = (e) => {
      emit('update:modelValue', e.target.value)
      emit('input', e.target.value)
    }

    return () => {
      const isTextarea = props.type === 'textarea'
      const inputType = props.showPassword && !visible.value ? 'password' : props.type
      const common = {
        class: 'ui-input',
        value: props.modelValue ?? '',
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: onValue,
        onBlur: (e) => emit('blur', e),
        onKeyup: (e) => emit('keyup', e)
      }

      const control = isTextarea
        ? h('textarea', { ...common, rows: props.rows })
        : h('input', { ...common, type: inputType })

      const children = [control]
      if (props.showPassword) {
        children.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ui-input__eye',
              onClick: () => (visible.value = !visible.value)
            },
            visible.value ? '显示' : '隐藏'
          )
        )
      }
      if (props.clearable && props.modelValue) {
        children.push(
          h(
            'button',
            {
              type: 'button',
              class: 'ui-input__clear',
              onClick: () => emit('update:modelValue', '')
            },
            '×'
          )
        )
      }

      return h('div', { class: 'ui-input-wrap', ...attrs }, children)
    }
  }
})

/* ============================== Select / Option ============================== */
const ElOption = defineComponent({
  name: 'ElOption',
  props: { value: { type: [String, Number], default: '' }, label: String },
  setup(props, { slots }) {
    return () => h('option', { value: props.value }, props.label || slots.default?.())
  }
})

const ElSelect = defineComponent({
  name: 'ElSelect',
  props: {
    modelValue: { type: [String, Number], default: '' },
    placeholder: String,
    clearable: Boolean,
    disabled: Boolean
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { slots, emit, attrs }) {
    return () =>
      h(
        'select',
        {
          class: 'ui-select',
          value: props.modelValue ?? '',
          disabled: props.disabled,
          onChange: (e) => {
            emit('update:modelValue', e.target.value)
            emit('change', e.target.value)
          },
          ...attrs
        },
        props.clearable
          ? [h('option', { value: '' }, props.placeholder || '全部'), slots.default?.()]
          : slots.default?.()
      )
  }
})

/* ============================== Switch ============================== */
const ElSwitch = defineComponent({
  name: 'ElSwitch',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('label', { class: 'ui-switch' }, [
        h('input', {
          type: 'checkbox',
          checked: props.modelValue,
          onChange: (e) => emit('update:modelValue', e.target.checked)
        }),
        h('span', { class: 'ui-switch__track' })
      ])
  }
})

/* ============================== Radio / Checkbox groups ============================== */
const ElRadioGroup = defineComponent({
  name: 'ElRadioGroup',
  props: { modelValue: { type: [String, Number], default: '' } },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    provide('uiChoice', {
      multiple: false,
      value: toRef(props, 'modelValue'),
      toggle: (value) => emit('update:modelValue', value)
    })
    return () => h('div', { class: 'ui-choice-group' }, slots.default?.())
  }
})

const ElCheckboxGroup = defineComponent({
  name: 'ElCheckboxGroup',
  props: { modelValue: { type: Array, default: () => [] } },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    provide('uiChoice', {
      multiple: true,
      value: toRef(props, 'modelValue'),
      toggle: (value) => {
        const next = Array.isArray(props.modelValue) ? [...props.modelValue] : []
        const index = next.indexOf(value)
        if (index === -1) next.push(value)
        else next.splice(index, 1)
        emit('update:modelValue', next)
      }
    })
    return () => h('div', { class: 'ui-choice-group' }, slots.default?.())
  }
})

function useChoice(props, type) {
  const group = inject('uiChoice', null)
  const checked = () => {
    if (!group) return false
    return group.multiple
      ? (group.value.value || []).includes(props.value)
      : group.value.value === props.value
  }
  const onChange = () => group?.toggle(props.value)

  return () =>
    h('label', { class: ['ui-choice', `ui-choice--${type}`, checked() && 'is-checked'] }, [
      h('input', { type, checked: checked(), onChange, disabled: props.disabled }),
      h('span', { class: 'ui-choice__box' }),
      h('span', { class: 'ui-choice__label' }, slotsText(props, type))
    ])
}

function slotsText(props, type) {
  return props.label != null ? props.label : type === 'radio' ? '' : ''
}

const ElRadio = defineComponent({
  name: 'ElRadio',
  props: {
    value: { type: [String, Number], default: '' },
    label: { type: [String, Number], default: null },
    disabled: Boolean
  },
  setup(props, { slots }) {
    const base = useChoice(props, 'radio')
    return () => {
      const vnode = base()
      // 把默认插槽的文字塞进 label（useChoice 里拿不到 slots，这里补一次）
      if (slots.default) {
        const labelVNode = vnode.children?.[2]
        if (labelVNode) labelVNode.children = slots.default()
      }
      return vnode
    }
  }
})

const ElCheckbox = defineComponent({
  name: 'ElCheckbox',
  props: {
    value: { type: [String, Number], default: '' },
    label: { type: [String, Number], default: null },
    modelValue: Boolean,
    disabled: Boolean
  },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    const group = inject('uiChoice', null)
    return () => {
      const checked = group
        ? group.multiple
          ? (group.value.value || []).includes(props.value)
          : group.value.value === props.value
        : props.modelValue
      return h(
        'label',
        { class: ['ui-choice', 'ui-choice--checkbox', checked && 'is-checked'] },
        [
          h('input', {
            type: 'checkbox',
            checked,
            disabled: props.disabled,
            onChange: () => {
              if (group) group.toggle(props.value)
              else emit('update:modelValue', !checked)
            }
          }),
          h('span', { class: 'ui-choice__box' }),
          h('span', { class: 'ui-choice__label' }, slots.default?.() ?? props.label ?? '')
        ]
      )
    }
  }
})

/* ============================== Tag / Divider / Empty ============================== */
const ElTag = defineComponent({
  name: 'ElTag',
  props: { type: String, size: String, closable: Boolean },
  emits: ['close'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'span',
        { class: ['ui-tag', props.type && `ui-tag--${props.type}`, props.size === 'small' && 'ui-tag--sm'] },
        [
          slots.default?.(),
          props.closable &&
            h('button', { type: 'button', class: 'ui-tag__close', onClick: () => emit('close') }, '×')
        ]
      )
  }
})

const ElDivider = defineComponent({
  name: 'ElDivider',
  props: { contentPosition: String },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'ui-divider' }, slots.default?.() ? h('span', null, slots.default?.()) : null)
  }
})

const ElEmpty = defineComponent({
  name: 'ElEmpty',
  props: { description: { type: String, default: '暂无数据' } },
  setup(props) {
    return () =>
      h('div', { class: 'ui-empty' }, [
        h('div', { class: 'ui-empty__icon' }, '□'),
        h('div', null, props.description)
      ])
  }
})

/* ============================== Card / Dialog ============================== */
const ElCard = defineComponent({
  name: 'ElCard',
  setup(props, { slots, attrs }) {
    return () =>
      h('section', { class: 'ui-card', ...attrs }, [
        slots.header && h('header', { class: 'ui-card__header' }, slots.header()),
        h('div', { class: 'ui-card__body' }, slots.default?.())
      ])
  }
})

const ElDialog = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: Boolean,
    title: String,
    width: { type: [String, Number], default: '50%' },
    showClose: { type: Boolean, default: true }
  },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    const close = () => emit('update:modelValue', false)
    return () => {
      if (!props.modelValue) return null
      return h(Teleport, { to: 'body' }, [
        h('div', { class: 'ui-overlay', onClick: close }, [
          h(
            'div',
            {
              class: 'ui-dialog',
              style: { width: typeof props.width === 'number' ? `${props.width}px` : props.width },
              onClick: (e) => e.stopPropagation()
            },
            [
              h('header', { class: 'ui-dialog__header' }, [
                h('strong', null, props.title || ''),
                props.showClose && h('button', { type: 'button', class: 'ui-dialog__close', onClick: close }, '×')
              ]),
              h('div', { class: 'ui-dialog__body' }, slots.default?.()),
              slots.footer && h('footer', { class: 'ui-dialog__footer' }, slots.footer())
            ]
          )
        ])
      ])
    }
  }
})

/* ============================== Form / FormItem ============================== */
const ElForm = defineComponent({
  name: 'ElForm',
  props: {
    model: { type: Object, required: true },
    rules: { type: Object, default: () => ({}) },
    labelWidth: String
  },
  setup(props, { slots, expose }) {
    const items = []
    const errors = reactive({})
    provide('uiForm', {
      model: props.model,
      rules: props.rules,
      errors,
      register: (item) => items.push(item)
    })

    function validate() {
      let valid = true
      items.forEach(({ prop }) => {
        const rules = props.rules[prop] || []
        const value = props.model[prop]
        const rule = rules.find((r) => {
          if (r.required && (value === undefined || value === null || value === '')) return true
          if (r.pattern && value && !r.pattern.test(value)) return true
          return false
        })
        errors[prop] = rule ? rule.message || '校验失败' : ''
        if (rule) valid = false
      })
      return Promise.resolve(valid)
    }

    expose({ validate })
    return () => h('form', { class: 'ui-form', onSubmit: (e) => e.preventDefault() }, slots.default?.())
  }
})

const ElFormItem = defineComponent({
  name: 'ElFormItem',
  props: { prop: String, label: String },
  setup(props, { slots }) {
    const form = inject('uiForm', null)
    onMounted(() => form?.register({ prop: props.prop }))
    return () =>
      h('div', { class: 'ui-form-item' }, [
        props.label && h('label', { class: 'ui-form-item__label' }, props.label),
        h('div', { class: 'ui-form-item__control' }, slots.default?.()),
        form?.errors?.[props.prop] && h('div', { class: 'ui-form-item__error' }, form.errors[props.prop])
      ])
  }
})

/* ============================== Table / TableColumn ============================== */
const ElTableColumn = defineComponent({
  name: 'ElTableColumn',
  props: { label: String, prop: String, width: [String, Number], minWidth: [String, Number] },
  setup() {
    return () => null // 只作为配置节点，由 ElTable 读取它的 props / slots
  }
})

const ElTable = defineComponent({
  name: 'ElTable',
  props: { data: { type: Array, default: () => [] } },
  setup(props, { slots, attrs }) {
    return () => {
      const columns = slots.default?.() || []
      const cols = columns.filter((v) => v.type?.name === 'ElTableColumn')

      return h('div', { class: 'ui-table-wrap', ...attrs }, [
        h(
          'table',
          { class: 'ui-table' },
          [
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                cols.map((col) =>
                  h(
                    'th',
                    { style: col.props?.width ? { width: `${col.props.width}px` } : undefined },
                    col.props?.label || ''
                  )
                )
              )
            ),
            h(
              'tbody',
              null,
              props.data.length
                ? props.data.map((row, index) =>
                    h(
                      'tr',
                      null,
                      cols.map((col) =>
                        h(
                          'td',
                          null,
                          col.children?.default
                            ? col.children.default({ row, $index: index })
                            : row[col.props?.prop] ?? ''
                        )
                      )
                    )
                  )
                : h('tr', null, h('td', { colspan: cols.length || 1, class: 'ui-table__empty' }, '暂无数据'))
            )
          ]
        )
      ])
    }
  }
})

/* ============================== Pagination ============================== */
const ElPagination = defineComponent({
  name: 'ElPagination',
  props: {
    total: { type: Number, default: 0 },
    pageSize: { type: Number, default: 10 },
    currentPage: { type: Number, default: 1 },
    layout: { type: String, default: '' }
  },
  emits: ['current-change'],
  setup(props, { emit, attrs }) {
    const pages = () => Math.max(1, Math.ceil(props.total / props.pageSize))
    const go = (page) => {
      if (page < 1 || page > pages() || page === props.currentPage) return
      emit('current-change', page)
    }
    return () =>
      h('div', { class: 'ui-pagination', ...attrs }, [
        h('span', { class: 'ui-pagination__total' }, `共 ${props.total} 条`),
        h('button', { class: 'ui-page-btn', disabled: props.currentPage <= 1, onClick: () => go(props.currentPage - 1) }, '‹'),
        ...Array.from({ length: pages() }, (_, i) =>
          h(
            'button',
            {
              class: ['ui-page-btn', props.currentPage === i + 1 && 'is-active'],
              onClick: () => go(i + 1)
            },
            i + 1
          )
        ),
        h('button', { class: 'ui-page-btn', disabled: props.currentPage >= pages(), onClick: () => go(props.currentPage + 1) }, '›')
      ])
  }
})

/* ============================== Menu / PageHeader / ConfigProvider ============================== */
const ElMenuItem = defineComponent({
  name: 'ElMenuItem',
  props: { index: String },
  setup(props, { slots }) {
    const router = useRouter()
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: 'ui-menu-item',
          onClick: () => props.index && router?.push(props.index)
        },
        slots.default?.()
      )
  }
})

const ElMenu = defineComponent({
  name: 'ElMenu',
  setup(props, { slots }) {
    return () => h('nav', { class: 'ui-menu' }, slots.default?.())
  }
})

const ElPageHeader = defineComponent({
  name: 'ElPageHeader',
  emits: ['back'],
  setup(props, { slots, emit }) {
    return () =>
      h('div', { class: 'ui-page-header' }, [
        h('button', { type: 'button', class: 'ui-back', onClick: () => emit('back') }, '‹ 返回'),
        slots.default?.()
      ])
  }
})

const ElConfigProvider = defineComponent({
  name: 'ElConfigProvider',
  setup(props, { slots }) {
    return () => h(Fragment, null, slots.default?.())
  }
})

/* ============================== 命令式 API ============================== */
function showMessage(text, kind = 'info') {
  const el = document.createElement('div')
  el.className = `ui-message ui-message--${kind}`
  el.textContent = String(text)
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('is-in'))
  setTimeout(() => {
    el.classList.remove('is-in')
    setTimeout(() => el.remove(), 250)
  }, 2200)
}

export const ElMessage = Object.assign((text) => showMessage(text), {
  info: (text) => showMessage(text, 'info'),
  success: (text) => showMessage(text, 'success'),
  warning: (text) => showMessage(text, 'warning'),
  error: (text) => showMessage(text, 'error')
})

export const ElMessageBox = {
  confirm(message, title = '提示', options = {}) {
    return new Promise((resolve, reject) => {
      const mask = document.createElement('div')
      mask.className = 'ui-overlay ui-messagebox'
      const box = document.createElement('div')
      box.className = 'ui-messagebox__box'
      box.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="ui-messagebox__actions">
          <button type="button" data-act="cancel">取消</button>
          <button type="button" data-act="ok" class="is-primary">确定</button>
        </div>`
      mask.appendChild(box)
      document.body.appendChild(mask)

      const close = (ok) => {
        mask.remove()
        ok ? resolve() : reject(new Error('cancel'))
      }
      box.querySelector('[data-act="cancel"]').onclick = () => close(false)
      box.querySelector('[data-act="ok"]').onclick = () => close(true)
      mask.onclick = (e) => {
        if (e.target === mask) close(false)
      }
      void options
    })
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c])
}

/* ============================== v-loading 指令 ============================== */
const loadingDirective = {
  mounted(el, binding) {
    if (binding.value) el.classList.add('ui-loading')
  },
  updated(el, binding) {
    binding.value ? el.classList.add('ui-loading') : el.classList.remove('ui-loading')
  },
  unmounted(el) {
    el.classList.remove('ui-loading')
  }
}

/* ============================== 安装入口 ============================== */
const components = {
  ElButton,
  ElInput,
  ElOption,
  ElSelect,
  ElSwitch,
  ElRadioGroup,
  ElRadio,
  ElCheckboxGroup,
  ElCheckbox,
  ElTag,
  ElDivider,
  ElEmpty,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElMenu,
  ElMenuItem,
  ElPageHeader,
  ElConfigProvider
}

export const UiPlugin = {
  install(app) {
    Object.entries(components).forEach(([name, component]) => app.component(name, component))
    app.directive('loading', loadingDirective)
    // 挂到全局属性，页面里 import { ElMessage } 也能用；留这个给 Options API 兜底
    app.config.globalProperties.$message = ElMessage
  }
}

export default UiPlugin
