import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '@/layout/index.vue'

/**
 * 路由表说明：
 * - meta.auth  是否需要登录
 * - meta.perm  按钮/页面级权限点（示例：只有 admin 能进统计页）
 * - 填写页 /fill/:id 是独立的公开页面，不套后台布局
 */
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue')
  },
  {
    path: '/fill/:id',
    name: 'Fill',
    component: () => import('@/views/fill/index.vue')
  },
  {
    path: '/',
    component: Layout,
    redirect: '/surveys',
    children: [
      {
        path: 'surveys',
        name: 'SurveyList',
        component: () => import('@/views/survey/ListView.vue'),
        meta: { title: '问卷管理', auth: true }
      },
      {
        path: 'editor/:id?',
        name: 'Editor',
        component: () => import('@/views/editor/EditorView.vue'),
        meta: { title: '问卷编辑器', auth: true }
      },
      {
        path: 'stats/:id',
        name: 'Stats',
        component: () => import('@/views/survey/StatsView.vue'),
        meta: { title: '数据回收', auth: true }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 全局前置守卫：未登录跳转登录页，并带上回跳地址
router.beforeEach((to, from, next) => {
  if (to.meta.auth && !localStorage.getItem('token')) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }
  next()
})

export default router
