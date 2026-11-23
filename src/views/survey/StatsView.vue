<template>
  <div class="page">
    <div class="stats__bar">
      <el-page-header @back="$router.back()" />
      <h3>{{ title }}</h3>
      <el-tag type="success">共回收 {{ stats?.total || 0 }} 份</el-tag>
      <span class="grow"></span>
      <span class="tag">SVG 手绘图表 · 无图表库</span>
    </div>

    <el-card v-loading="loading" shadow="never">
      <template #header><b>回收趋势</b></template>
      <MiniChart
        type="line"
        :labels="trendLabels"
        :values="trendValues"
        title="每日回收量"
        color="#4f46e5"
      />
    </el-card>

    <el-card v-for="question in choiceQuestions" :key="question.id" shadow="never" style="margin-top: 12px">
      <template #header><b>{{ question.title }}</b></template>
      <MiniChart
        type="bar"
        :labels="question.options.map((o) => o.label)"
        :values="question.options.map((o) => o.count)"
        :title="question.title"
        color="#0b6bcb"
      />
    </el-card>

    <el-card v-for="question in textQuestions" :key="question.id" shadow="never" style="margin-top: 12px">
      <template #header><b>{{ question.title }}（文本回答）</b></template>
      <el-empty v-if="!question.texts.length" description="暂无回答" />
      <div v-for="(text, i) in question.texts" :key="i" class="text-item">{{ text }}</div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getStats, getSurvey } from '@/api/survey'
import MiniChart from '@/components/MiniChart.vue'

/**
 * 以前这里用 ECharts：
 *   - 按需引入 4 个模块 + echarts.use()
 *   - 手动保存实例数组、resize、dispose
 * 现在换成手写 SVG 组件：
 *   - 没有实例，就没有实例泄漏
 *   - 响应式由 Vue 管，数据变了自动重绘
 *   - 打包体积直接少掉几十 KB
 */
const route = useRoute()

const loading = ref(false)
const stats = ref(null)
const title = ref('')

const choiceQuestions = computed(() => (stats.value?.questionStats || []).filter((q) => q.options))
const textQuestions = computed(() => (stats.value?.questionStats || []).filter((q) => q.texts))

const trendLabels = computed(() => (stats.value?.trend || []).map((item) => item[0]))
const trendValues = computed(() => (stats.value?.trend || []).map((item) => item[1]))

async function load() {
  loading.value = true
  try {
    const [survey, statData] = await Promise.all([getSurvey(route.params.id), getStats(route.params.id)])
    title.value = survey.title
    stats.value = statData
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.stats__bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.stats__bar h3 { font-size: 16px; }
.text-item { padding: 7px 2px; border-bottom: 1px solid #eef0f3; font-size: 13px; }
.text-item:last-child { border: 0; }
</style>
