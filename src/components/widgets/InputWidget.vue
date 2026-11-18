<template>
  <el-input v-model="inner" :placeholder="question.placeholder" />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  question: { type: Object, required: true },
  modelValue: { type: [String, Number], default: '' }
})
const emit = defineEmits(['update:modelValue'])

const inner = computed({
  get: () => props.modelValue ?? '',
  set: (value) => emit('update:modelValue', value)
})
</script>
