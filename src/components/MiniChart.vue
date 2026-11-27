<template>
  <!-- 一个空 div，ECharts 会把图表画到这个 div 里面 -->
  <div ref="chartEl" class="mini-chart" role="img" :aria-label="title"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

// 按需引入 ECharts：只加载折线图、柱状图、网格、提示框、canvas 渲染器
// 好处是打包体积比整包引入小很多
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 告诉 ECharts 要用上面这些模块
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer])

// 接收外部传进来的参数（和原来完全一样，所以统计页不用改）
const props = defineProps({
  type: { type: String, default: 'line' },   // line=折线图，bar=柱状图
  labels: { type: Array, default: () => [] }, // X 轴的文字
  values: { type: Array, default: () => [] }, // 对应的数据
  title: { type: String, default: '' },
  color: { type: String, default: '#4f46e5' }
})

const chartEl = ref(null)  // 指向上面那个 div
let chart = null           // 保存 ECharts 实例

// 画图的函数
function render() {
  if (!chartEl.value) return
  // 第一次画的时候创建一个实例，之后复用它
  if (!chart) chart = echarts.init(chartEl.value)

  // type=line 用折线图的配置，否则用柱状图的配置
  const option = props.type === 'line'
    ? {
        tooltip: { trigger: 'axis' },                    // 鼠标悬浮显示数值
        grid: { left: 40, right: 16, top: 20, bottom: 30 }, // 图表留白
        xAxis: { type: 'category', data: props.labels },   // X 轴用传进来的标签
        yAxis: { type: 'value' },                          // Y 轴自动算刻度
        series: [{
          type: 'line', data: props.values, smooth: true,  // 折线、平滑
          lineStyle: { color: props.color, width: 2.5 },   // 线的颜色和粗细
          itemStyle: { color: props.color },               // 数据点的颜色
          areaStyle: { color: props.color, opacity: 0.15 } // 线下面的渐变填充
        }]
      }
    : {
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 16, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: props.labels },
        yAxis: { type: 'value' },
        series: [{
          type: 'bar', data: props.values,                 // 柱状图
          itemStyle: { color: props.color, borderRadius: [3, 3, 0, 0] } // 柱子顶部圆角
        }]
      }
  chart.setOption(option, true)  // 把配置交给 ECharts，它就画出来了
}

// 组件出现后画一次图，同时监听窗口变化
onMounted(() => { nextTick(render); window.addEventListener('resize', onResize) })

// 数据变了就重新画（比如筛选条件变化）
watch(() => [props.type, props.labels, props.values, props.color], render, { deep: true })

// 窗口大小变了让图重新适应
function onResize() { chart?.resize() }

// 组件销毁时：取消监听 + 销毁图表实例（不销毁会内存泄漏）
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
/* 图表占满宽度，高度 240 像素 */
.mini-chart { width: 100%; height: 240px; }
</style>
