<template>
  <div class="page">
    <div class="stats__bar">
      <el-page-header @back="$router.back()" />
      <h3>{{ title }}</h3>
      <el-tag type="success">共回收 {{ stats?.total || 0 }} 份</el-tag>
    </div>

    <el-card v-loading="loading" shadow="never">
      <template #header><b>回收趋势</b></template>
      <div ref="trendRef" class="chart" />
    </el-card>

    <el-card v-for="question in choiceQuestions" :key="question.id" shadow="never" style="margin-top: 12px">
      <template #header><b>{{ question.title }}</b></template>
      <div :ref="(el) => setChartEl(question.id, el)" class="chart" />
    </el-card>

    <el-card v-for="question in textQuestions" :key="question.id" shadow="never" style="margin-top: 12px">
      <template #header><b>{{ question.title }}（文本回答）</b></template>
      <el-empty v-if="!question.texts.length" description="暂无回答" />
      <div v-for="(text, i) in question.texts" :key="i" class="text-item">{{ text }}</div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
// ECharts 按需引入：只装用到的图表类型、组件与渲染器，避免把整个 echarts 打进包里
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer])
import { getStats, getSurvey } from '@/api/survey'

const route = useRoute()

const loading = ref(false)
const stats = ref(null)
const title = ref('')
const trendRef = ref(null)
const chartEls = ref({})

/** 保存所有 echarts 实例，卸载和 resize 时要统一处理，否则内存泄漏 */
let charts = []

const choiceQuestions = computed(() => (stats.value?.questionStats || []).filter((q) => q.options))
const textQuestions = computed(() => (stats.value?.questionStats || []).filter((q) => q.texts))

function setChartEl(id, el) {
  if (el) chartEls.value[id] = el
}

function disposeCharts() {
  charts.forEach((c) => c.dispose())
  charts = []
}

function renderCharts() {
  disposeCharts()
  if (!stats.value) return

  if (trendRef.value) {
    const chart = echarts.init(trendRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: stats.value.trend.map((t) => t[0]) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{ type: 'line', smooth: true, data: stats.value.trend.map((t) => t[1]), areaStyle: {} }]
    })
    charts.push(chart)
  }

  choiceQuestions.value.forEach((question) => {
    const el = chartEls.value[question.id]
    if (!el) return
    const chart = echarts.init(el)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: question.options.map((o) => o.label) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{ type: 'bar', data: question.options.map((o) => o.count), itemStyle: { color: '#409eff' } }]
    })
    charts.push(chart)
  })
}

function handleResize() {
  charts.forEach((c) => c.resize())
}

async function load() {
  loading.value = true
  try {
    const [survey, statData] = await Promise.all([getSurvey(route.params.id), getStats(route.params.id)])
    title.value = survey.title
    stats.value = statData
  } finally {
    loading.value = false
  }
  await nextTick() // 等 DOM 渲染完再初始化图表，否则拿不到宽高
  renderCharts()
}

onMounted(() => {
  load()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeCharts()
})
</script>

<style scoped>
.stats__bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.stats__bar h3 { margin: 0; }
.chart { height: 260px; width: 100%; }
.text-item { padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
</style>
