<template>
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
</template>

<script setup>
import { defineComponent, h, onErrorCaptured, ref } from 'vue'
import { RouterView } from 'vue-router'

/**
 * 组件级错误边界：某个页面崩了，只把这一块换成说明卡片，
 * 而不是整页白屏 —— 这是白屏治理的其中一层。
 */
const ErrorBoundary = defineComponent({
  name: 'ErrorBoundary',
  setup(_, { slots }) {
    const error = ref(null)
    onErrorCaptured((err) => {
      error.value = err
      return false
    })
    return () =>
      error.value
        ? h('div', { style: { padding: '32px', maxWidth: '720px', margin: '40px auto' } }, [
            h('h2', { style: { color: '#d92d20' } }, '页面出错了，但不是白屏'),
            h('p', { style: { color: '#5b6472' } }, String(error.value.message || error.value)),
            h('pre', { style: { padding: '12px', background: '#f5f6f8', borderRadius: '8px', overflow: 'auto' } }, String(error.value.stack || '')),
            h('button', { type: 'button', onClick: () => window.location.reload() }, '刷新重试')
          ])
        : slots.default?.()
  }
})
</script>
