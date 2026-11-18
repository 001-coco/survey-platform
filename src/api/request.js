import axios from 'axios'
import { ElMessage } from 'element-plus'

/**
 * 请求层封装，面试可以展开讲的三件事：
 * 1. 统一错误处理：业务 code !== 0 统一弹提示并 reject，页面不用重复写 catch
 * 2. 取消重复请求：同一个请求在上一个没回来时再次发起，先 abort 掉旧的
 * 3. 401 统一跳转登录，避免每个页面都判断一遍
 */
/* 本地开发走 vite 代理（/api），线上由 VITE_API_BASE 指向真实后端地址 */
const BASE_URL = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

const service = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
})

/* ---------- 无感刷新 ----------
 * 1. refreshPromise 单例：同一时刻并发的多个 401 只发一次刷新请求，
 *    其余请求都在 await 同一个 promise，等价于「挂起 → 刷新成功 → 一起重放」
 * 2. 刷新用的请求走裸 axios，不经过本文件的拦截器，否则 401 会递归
 */
let refreshPromise = null

function refreshToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, { refreshToken: localStorage.getItem('refreshToken') })
      .then((res) => {
        const token = res.data?.data?.token
        if (!token) throw new Error('refresh failed')
        localStorage.setItem('token', token)
        return token
      })
      .finally(() => {
        refreshPromise = null // 无论成败都要复位，否则后续拿到的永远是旧 promise
      })
  }
  return refreshPromise
}

function clearLoginState() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  window.location.hash = '#/login'
}

/* ---------- 重复请求取消 ---------- */
const pendingMap = new Map()

function getRequestKey(config) {
  return [config.method, config.url, JSON.stringify(config.params || {}), JSON.stringify(config.data || {})].join('&')
}

function removePending(config) {
  if (!config) return
  const key = getRequestKey(config)
  const controller = pendingMap.get(key)
  if (controller) {
    controller.abort()
    pendingMap.delete(key)
  }
}

/* ---------- 请求拦截器 ---------- */
service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`

    removePending(config) // 先取消上一个相同请求
    const controller = new AbortController()
    config.signal = controller.signal
    pendingMap.set(getRequestKey(config), controller)

    return config
  },
  (error) => Promise.reject(error)
)

/* ---------- 响应拦截器 ---------- */
service.interceptors.response.use(
  (response) => {
    removePending(response.config)
    const body = response.data
    if (body.code === 0) return body.data // 直接返回 data，调用方少写一层

    ElMessage.error(body.message || '请求失败')
    return Promise.reject(new Error(body.message))
  },
  (error) => {
    removePending(error.config)

    // 主动取消的请求不弹错误提示
    if (axios.isCancel?.(error) || error.name === 'CanceledError') {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const config = error.config || {}

    // 401 先尝试续期并重放一次；_retry 标记防止「重放又 401」时无限循环
    if (status === 401 && !config._retry && !String(config.url).includes('/auth/refresh')) {
      config._retry = true
      return refreshToken()
        .then((token) => {
          config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
          return service(config)
        })
        .catch(() => {
          ElMessage.error('登录已过期，请重新登录')
          clearLoginState()
          return Promise.reject(error)
        })
    }

    if (status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      clearLoginState()
    } else if (status === 403) {
      ElMessage.error('没有权限执行该操作')
    } else {
      ElMessage.error(error.response?.data?.message || '网络异常，请稍后重试')
    }
    return Promise.reject(error)
  }
)

export default service
