<template>
  <svg class="mini-chart" viewBox="0 0 640 240" preserveAspectRatio="none" role="img" :aria-label="title">
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity="0.28" />
        <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
      </linearGradient>
    </defs>

    <!-- 网格与刻度：手写坐标系，不依赖图表库 -->
    <g class="mini-chart__grid">
      <line v-for="i in 5" :key="`h${i}`" :x1="pad" :x2="640 - pad + 8" :y1="top + (i - 1) * stepY" :y2="top + (i - 1) * stepY" />
      <text v-for="i in 5" :key="`t${i}`" :x="pad - 8" :y="top + (i - 1) * stepY + 4" text-anchor="end">
        {{ Math.round(max * (5 - i) / 4) }}
      </text>
    </g>

    <template v-if="type === 'line'">
      <polygon v-if="points.length > 1" :points="areaPoints" :fill="`url(#${gradientId})`" />
      <polyline v-if="points.length > 1" :points="points" fill="none" :stroke="color" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      <g v-for="(p, i) in pointsArr" :key="i">
        <circle :cx="p.x" :cy="p.y" r="3" :fill="color" />
        <title>{{ labels[i] }}：{{ values[i] }}</title>
      </g>
    </template>

    <g v-else>
      <rect
        v-for="(bar, i) in bars"
        :key="i"
        :x="bar.x"
        :y="bar.y"
        :width="barWidth"
        :height="bar.h"
        :fill="color"
        rx="3"
        opacity="0.88"
      >
        <title>{{ labels[i] }}：{{ values[i] }}</title>
      </rect>
    </g>

    <!-- X 轴标签：超过 8 个时抽稀，避免挤成一团 -->
    <text
      v-for="(label, i) in shownLabels"
      :key="`x${i}`"
      :x="barCenter(i)"
      :y="240 - 8"
      text-anchor="middle"
      class="mini-chart__xlabel"
    >
      {{ label }}
    </text>

    <text v-if="!values.length" x="320" y="125" text-anchor="middle" class="mini-chart__empty">暂无数据</text>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

/**
 * 手写 SVG 图表：折线图 + 柱状图
 * 以前这里是 ECharts 十几行配置 + 实例管理 + resize + dispose；
 * 现在是一个纯函数式的 SVG 组件，没有实例、没有内存泄漏风险。
 */
const props = defineProps({
  type: { type: String, default: 'line' }, // 'line' | 'bar'
  labels: { type: Array, default: () => [] },
  values: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  color: { type: String, default: '#4f46e5' }
})

const W = 640
const H = 240
const pad = 42
const top = 20
const bottom = 28
const plotH = H - top - bottom
const plotW = W - pad - 16
const stepY = plotH / 4
const gradientId = `chart-grad-${Math.random().toString(36).slice(2, 8)}`

const max = computed(() => Math.max(1, ...props.values.map((v) => Number(v) || 0)))
const yOf = (value) => top + plotH - (Number(value) / max.value) * plotH
const band = computed(() => plotW / Math.max(props.values.length, 1))
const barWidth = computed(() => Math.max(4, Math.min(46, band.value * 0.56)))
const barCenter = (i) => pad + band.value * (i + 0.5)

const pointsArr = computed(() =>
  props.values.map((value, i) => ({
    x: props.values.length === 1 ? pad + plotW / 2 : pad + (band.value * i),
    y: yOf(value)
  }))
)
const points = computed(() => pointsArr.value.map((p) => `${p.x},${p.y}`).join(' '))
const areaPoints = computed(() =>
  `${pad},${top + plotH} ${points.value} ${pad + plotW},${top + plotH}`
)

const bars = computed(() =>
  props.values.map((value, i) => {
    const h = Math.max(0, (Number(value) / max.value) * plotH)
    return { x: barCenter(i) - barWidth.value / 2, y: yOf(value), h }
  })
)

const shownLabels = computed(() => {
  const labels = props.labels
  const stride = Math.max(1, Math.ceil(labels.length / 8))
  return labels.map((label, i) => (i % stride === 0 ? label : ''))
})
</script>

<style scoped>
.mini-chart { display: block; width: 100%; height: 240px; }
.mini-chart__grid line { stroke: #e8ebf0; stroke-width: 1; }
.mini-chart__grid text { fill: #98a1b0; font-size: 11px; }
.mini-chart__xlabel { fill: #7b8494; font-size: 11px; }
.mini-chart__empty { fill: #98a1b0; font-size: 13px; }
</style>
