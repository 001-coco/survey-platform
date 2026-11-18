<template>
  <div class="fill">
    <div v-loading="loading" class="fill__card">
      <template v-if="survey">
        <h1 class="fill__title">{{ survey.title }}</h1>
        <p v-if="survey.desc" class="fill__desc">{{ survey.desc }}</p>

        <SchemaRenderer v-model="model" :questions="survey.questions" :error-map="errors" />

        <div class="fill__footer">
          <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
          <span v-if="draftSaved" class="fill__draft">草稿已自动保存</span>
        </div>
      </template>

      <el-empty v-else-if="!loading" description="问卷不存在或未发布" />
    </div>

    <el-dialog v-model="submitted" title="提交成功" width="360px" :show-close="false">
      <p>感谢您的参与！</p>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

import SchemaRenderer from '@/components/SchemaRenderer.vue'
import { getPublicSurvey, submitAnswer } from '@/api/survey'
import { validateQuestions } from '@/utils/validate'

const route = useRoute()

const loading = ref(false)
const submitting = ref(false)
const submitted = ref(false)
const draftSaved = ref(false)
const survey = ref(null)
const model = ref({})
const errors = reactive({})

const draftKey = computed(() => `survey_draft_${route.params.id}`)

/** 草稿自动保存：内容变化后写入 localStorage，刷新可继续填 */
watch(
  model,
  (value) => {
    localStorage.setItem(draftKey.value, JSON.stringify(value))
    draftSaved.value = true
  },
  { deep: true }
)

async function load() {
  loading.value = true
  try {
    survey.value = await getPublicSurvey(route.params.id)
    const cached = localStorage.getItem(draftKey.value)
    model.value = cached ? JSON.parse(cached) : {}
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  Object.keys(errors).forEach((k) => delete errors[k])

  const { valid, errors: found } = validateQuestions(survey.value.questions, model.value)
  if (!valid) {
    Object.assign(errors, found)
    ElMessage.warning('还有必填项未完成')
    return
  }

  submitting.value = true // 防重复提交
  try {
    await submitAnswer(survey.value.id, model.value)
    localStorage.removeItem(draftKey.value)
    submitted.value = true
  } catch {
    ElMessage.error('提交失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.fill { min-height: 100vh; padding: 24px 12px; background: #f5f7fa; }
.fill__card {
  max-width: 640px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}
.fill__title { font-size: 20px; margin: 0 0 8px; }
.fill__desc { color: #606266; font-size: 14px; margin: 0 0 20px; }
.fill__footer { margin-top: 24px; display: flex; align-items: center; gap: 12px; }
.fill__draft { font-size: 12px; color: #909399; }
</style>
