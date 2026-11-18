<template>
  <div class="editor__panel editor__materials">
    <h3>题型</h3>
    <p class="hint">拖到右侧画布，或点击直接添加</p>

    <div
      v-for="item in WIDGET_TYPES"
      :key="item.type"
      class="material-item"
      draggable="true"
      @dragstart="onDragStart($event, item.type)"
      @click="emit('add', item.type)"
    >
      {{ item.label }}
    </div>
  </div>
</template>

<script setup>
import { WIDGET_TYPES } from './widgets'

const emit = defineEmits(['add', 'dragNew'])

function onDragStart(event, type) {
  // dataTransfer 里带上标记，画布 drop 时区分「新增」还是「移动」
  event.dataTransfer.setData(
    'application/x-survey',
    JSON.stringify({ kind: 'new', type })
  )
  event.dataTransfer.effectAllowed = 'copy'
  emit('dragNew', type)
}
</script>

<style scoped>
h3 { margin: 0 0 4px; font-size: 14px; }
.hint { margin: 0 0 12px; font-size: 12px; color: #909399; }
</style>
