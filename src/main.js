import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import permission from './directives/permission'
import { installErrorHooks } from './core'

import './styles/index.css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
const app = createApp(App)

// 三类错误（资源 / 脚本 / Promise 拒绝）收口到同一个地方，不让任何一处直接白屏
installErrorHooks(app)

app.use(createPinia())

app.use(router)
app.directive('permission', permission)

app.mount('#app')
window.__SURVEY_READY__ = true
