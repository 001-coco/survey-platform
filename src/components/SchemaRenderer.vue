<template>
  <div class="schema-renderer">
    <div v-for="(question, index) in visibleQuestions" :key="question.id" class="sr-item">
      <div class="sr-title">
        <span v-if="question.required" class="sr-required">*</span>
        {{ index + 1 }}. {{ question.title }}
      </div>

      <!-- 动态组件：Schema 里的 type 决定渲染哪个控件，新增题型只需在 widgetMap 注册 -->
      <component
        :is="widgetMap[question.type]"
        :question="question"
        :model-value="modelValue[question.id]"
        @update:model-value="onChange(question.id, $event)"
      />

      <div v-if="errorMap[question.id]" class="sr-error">{{ errorMap[question.id] }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { isVisible } from '@/utils/validate'
import InputWidget from './widgets/InputWidget.vue'
import TextareaWidget from './widgets/TextareaWidget.vue'
import RadioWidget from './widgets/RadioWidget.vue'
import CheckboxWidget from './widgets/CheckboxWidget.vue'

/** 题型 -> 组件的注册表。扩展新题型只改这里，渲染引擎不用动 */
const widgetMap = {
  input: InputWidget,
  textarea: TextareaWidget,
  radio: RadioWidget,
  checkbox: CheckboxWidget
}

const props = defineProps({
  questions: { type: Array, required: true },
  modelValue: { type: Object, required: true },
  errorMap: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue'])

/** 条件题在这里被过滤掉 */
const visibleQuestions = computed(() => props.questions.filter((q) => isVisible(q, props.modelValue)))

function onChange(id, value) {
  emit('update:modelValue', { ...props.modelValue, [id]: value })
}
</script>

<style scoped>
.sr-item { margin-bottom: 20px; }
.sr-title { font-size: 14px; margin-bottom: 8px; line-height: 1.6; }
.sr-required { color: #f56c6c; margin-right: 2px; }
.sr-error { color: #f56c6c; font-size: 12px; margin-top: 4px; }
</style>
