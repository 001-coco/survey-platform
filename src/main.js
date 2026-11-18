import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElLoading } from 'element-plus'

// 组件样式已经由 unplugin-vue-components 按需注入，这里只补「非组件」的样式：
// v-loading 指令、以及 ElMessage / ElMessageBox 这类命令式 API
// 用 es/components/*/style/css 而不是 theme-chalk 单文件，前者会把依赖的基础样式一并带上
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

import App from './App.vue'
import router from './router'
import permission from './directives/permission'
import './styles/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElLoading) // v-loading 指令
app.directive('permission', permission) // v-permission="'survey:delete'"

app.mount('#app')
