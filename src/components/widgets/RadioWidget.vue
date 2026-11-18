<template>
  <el-radio-group v-model="inner">
    <el-radio v-for="opt in question.options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </el-radio>
  </el-radio-group>
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
