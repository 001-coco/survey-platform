<template>
  <div>
    <div class="editor__bar">
      <el-input v-model="survey.title" placeholder="问卷标题" style="width: 240px" />
      <el-button :disabled="!canUndo" @click="undo">撤销</el-button>
      <el-button :disabled="!canRedo" @click="redo">重做</el-button>
      <el-button @click="jsonVisible = true">查看 Schema</el-button>
      <el-button @click="previewVisible = true">预览</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      <el-button v-if="survey.id" link @click="openFill">打开填写页</el-button>
      <span class="editor__tip">快捷键：Ctrl+Z 撤销 / Ctrl+Y 重做 / Delete 删除</span>
    </div>

    <div class="editor">
      <MaterialPanel @add="addMaterial" />

      <CanvasArea
        :questions="survey.questions"
        :active-id="activeId"
        @select="activeId = $event"
        @drop="handleDrop"
        @move="handleMove"
        @copy="handleCopy"
        @remove="handleRemove"
      />

      <PropPanel :question="activeQuestion" :questions="survey.questions" @before-edit="record" />
    </div>

    <!-- Schema 源码视图 -->
    <el-dialog v-model="jsonVisible" title="题目 Schema" width="640px">
      <pre class="json-view">{{ questionsJson }}</pre>
    </el-dialog>

    <!-- 预览 -->
    <el-dialog v-model="previewVisible" :title="survey.title" width="640px">
      <SchemaRenderer v-if="survey.questions.length" :questions="survey.questions" v-model="previewModel" />
      <el-empty v-else description="还没有题目" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from '@/ui'

import MaterialPanel from './MaterialPanel.vue'
import CanvasArea from './CanvasArea.vue'
import PropPanel from './PropPanel.vue'
import { createQuestion, createSurveySchema } from './widgets'
import { useHistory } from './useHistory'
import { deepClone } from '@/core'
import { getSurvey, createSurvey, updateSurvey } from '@/api/survey'
import SchemaRenderer from '@/components/SchemaRenderer.vue'

const route = useRoute()
const router = useRouter()

const survey = reactive(createSurveySchema())
const activeId = ref('')
const saving = ref(false)
const jsonVisible = ref(false)
const previewVisible = ref(false)
const previewModel = ref({})

/* ---------- 撤销 / 重做 ---------- */
const { canUndo, canRedo, undo, redo, record, totalSnapshots } = useHistory(
  () => survey.questions,
  (snapshot) => {
    survey.questions = snapshot
    if (!snapshot.some((q) => q.id === activeId.value)) activeId.value = ''
  }
)

const activeQuestion = computed(
  () => survey.questions.find((q) => q.id === activeId.value) || null
)
const questionsJson = computed(() => JSON.stringify(survey.questions, null, 2))

/* ---------- 编辑器操作（每次改动前先 record） ---------- */
function addMaterial(type) {
  record()
  const question = createQuestion(type)
  survey.questions.push(question)
  activeId.value = question.id
}

function handleDrop(payload, index) {
  record()
  if (payload.kind === 'new') {
    const question = createQuestion(payload.type)
    survey.questions.splice(index, 0, question)
    activeId.value = question.id
    return
  }
  // 移动已有题目：先摘除再插入，注意摘除后下标会左移
  const from = payload.index
  const [item] = survey.questions.splice(from, 1)
  const insertAt = from < index ? index - 1 : index
  survey.questions.splice(insertAt, 0, item)
}

function handleMove(index, offset) {
  const target = index + offset
  if (target < 0 || target >= survey.questions.length) return
  record()
  const [item] = survey.questions.splice(index, 1)
  survey.questions.splice(target, 0, item)
}

function handleCopy(index) {
  record()
  const copy = deepClone(survey.questions[index])
  copy.id = createQuestion(copy.type).id // 生成新 id，避免 key 冲突
  survey.questions.splice(index + 1, 0, copy)
}

function handleRemove(index) {
  record()
  survey.questions.splice(index, 1)
  if (survey.questions[index]) activeId.value = survey.questions[index].id
  else activeId.value = ''
}

/* ---------- 快捷键 ---------- */
function onKeydown(e) {
  // 焦点在输入框里时，把快捷键还给浏览器：
  // 否则在标题输入框按 Delete 会删题，按 Ctrl+Z 会撤销题目而不是文字
  const target = e.target
  const typing =
    target &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
  if (typing) return

  const isCtrl = e.ctrlKey || e.metaKey
  if (isCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  } else if (isCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault()
    redo()
  } else if (e.key === 'Delete' && activeId.value) {
    const index = survey.questions.findIndex((q) => q.id === activeId.value)
    if (index !== -1) handleRemove(index)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  loadSurvey()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/* ---------- 数据加载与保存 ---------- */
async function loadSurvey() {
  const id = route.params.id
  if (!id) return
  const data = await getSurvey(id)
  Object.assign(survey, {
    id: data.id,
    title: data.title,
    desc: data.desc,
    questions: data.questions || []
  })
}

async function save() {
  if (!survey.title.trim()) return ElMessage.warning('请填写问卷标题')
  saving.value = true
  try {
    const payload = {
      title: survey.title,
      desc: survey.desc,
      questions: survey.questions
    }
    if (survey.id) {
      await updateSurvey(survey.id, payload)
      ElMessage.success('已保存')
    } else {
      const created = await createSurvey(payload)
      survey.id = created.id
      ElMessage.success('已创建')
      router.replace(`/editor/${created.id}`)
    }
  } finally {
    saving.value = false
  }
}

function openFill() {
  window.open(window.location.origin + window.location.pathname + `#/fill/${survey.id}`, '_blank')
}
</script>

<style scoped>
.editor__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fff;
}
.editor__tip { margin-left: auto; font-size: 12px; color: #909399; }
.json-view {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  max-height: 460px;
  overflow: auto;
  font-size: 12px;
}
</style>
