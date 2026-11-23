import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import permission from './directives/permission'
import UiPlugin from './ui'
import { installErrorHooks } from './core'

import './styles/index.css'

const app = createApp(App)

// 三类错误（资源 / 脚本 / Promise 拒绝）收口到同一个地方，不让任何一处直接白屏
installErrorHooks(app)

app.use(createPinia())
app.use(UiPlugin) // 手写 UI 组件层：ElButton / ElTable / ElDialog … 全部是自己的代码
app.use(router)
app.directive('permission', permission)

app.mount('#app')
window.__SURVEY_READY__ = true
