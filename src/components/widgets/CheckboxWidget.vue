<template>
  <el-checkbox-group v-model="inner">
    <el-checkbox v-for="opt in question.options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </el-checkbox>
  </el-checkbox-group>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  question: { type: Object, required: true },
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const inner = computed({
  get: () => props.modelValue ?? [],
  set: (value) => emit('update:modelValue', value)
})
</script>
