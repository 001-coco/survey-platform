<template>
  <div class="editor__panel editor__canvas" @dragover.prevent @drop="onDropEnd">
    <h3>画布</h3>
    <p v-if="!questions.length" class="empty">从左侧拖入题型开始搭建</p>

    <div
      v-for="(question, index) in questions"
      :key="question.id"
      class="canvas-item"
      :class="{ 'is-active': question.id === activeId }"
      draggable="true"
      @click="emit('select', question.id)"
      @dragstart="onDragStart($event, index)"
      @dragover.prevent="onDragOver"
      @drop.stop="onDrop($event, index)"
    >
      <!-- 题目预览：只读渲染，和填写端共用同一份 Schema -->
      <div class="q-title">
        <span v-if="question.required" class="q-required">*</span>
        {{ index + 1 }}. {{ question.title }}
        <el-tag size="small" type="info">{{ typeLabel(question.type) }}</el-tag>
        <el-tag v-if="question.condition" size="small" type="warning">条件题</el-tag>
      </div>

      <div class="q-preview">
        <template v-if="question.type === 'input'">
          <el-input :placeholder="question.placeholder" disabled />
        </template>
        <template v-else-if="question.type === 'textarea'">
          <el-input type="textarea" :rows="2" :placeholder="question.placeholder" disabled />
        </template>
        <template v-else-if="question.type === 'radio'">
          <el-radio v-for="opt in question.options" :key="opt.value" disabled>{{ opt.label }}</el-radio>
        </template>
        <template v-else-if="question.type === 'checkbox'">
          <el-checkbox v-for="opt in question.options" :key="opt.value" disabled>{{ opt.label }}</el-checkbox>
        </template>
      </div>

      <div class="canvas-item__tools">
        <el-button size="small" @click.stop="emit('move', index, -1)">↑</el-button>
        <el-button size="small" @click.stop="emit('move', index, 1)">↓</el-button>
        <el-button size="small" @click.stop="emit('copy', index)">复制</el-button>
        <el-button size="small" type="danger" @click.stop="emit('remove', index)">删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { WIDGET_TYPE_LABEL } from './widgets'

const props = defineProps({
  questions: { type: Array, required: true },
  activeId: { type: String, default: '' }
})

const emit = defineEmits(['select', 'move', 'copy', 'remove', 'drop'])

const typeLabel = (type) => WIDGET_TYPE_LABEL[type] || type

function onDragStart(event, index) {
  event.dataTransfer.setData(
    'application/x-survey',
    JSON.stringify({ kind: 'move', index })
  )
  event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event) {
  event.dataTransfer.dropEffect = 'move'
}

/** 落在某个题目上：插入到该位置 */
function onDrop(event, index) {
  const payload = readPayload(event)
  if (payload) emit('drop', payload, index)
}

/** 落在画布空白处：追加到末尾 */
function onDropEnd(event) {
  const payload = readPayload(event)
  if (payload) emit('drop', payload, props.questions.length)
}

function readPayload(event) {
  const raw = event.dataTransfer?.getData('application/x-survey')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
</script>

<style scoped>
h3 { margin: 0 0 4px; font-size: 14px; }
.empty { color: #909399; font-size: 13px; padding: 24px 0; text-align: center; }
.q-title { font-size: 14px; margin-bottom: 8px; }
.q-required { color: #f56c6c; margin-right: 2px; }
.q-preview { pointer-events: none; }
</style>
