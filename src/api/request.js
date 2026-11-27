// 引入 axios（现成的发请求工具）和消息提示组件
import axios from 'axios'
import { ElMessage } from 'element-plus'

// 接口地址前缀：本地开发走 /api，部署时可用环境变量覆盖
const BASE_URL = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

// 创建一个 axios 实例，相当于造一台专门发请求的"机器"
// baseURL：所有请求地址前面自动加 /api；timeout：10秒没响应就超时
const service = axios.create({ baseURL: BASE_URL, timeout: 10000 })

// ========== 登录过期自动刷新 ==========
// 用一个变量记住"正在刷新的那一次请求"，避免同时来 5 个过期请求就刷新 5 次
let refreshPromise = null

function refreshToken() {
  // 如果当前没有正在刷新的请求，才发起新的刷新
  if (!refreshPromise) {
    refreshPromise = service
      // 拿刷新令牌去换一个新的登录令牌
      .post('/auth/refresh', { refreshToken: localStorage.getItem('refreshToken') })
      .then((res) => {
        const token = res.data?.data?.token   // 从返回结果里取出新 token
        if (!token) throw new Error('refresh failed')  // 没拿到就报错
        localStorage.setItem('token', token)  // 把新 token 存起来，下次请求用
        return token
      })
      .finally(() => { refreshPromise = null })  // 不管成功失败都要清空，否则以后永远用这个旧结果
  }
  return refreshPromise  // 如果有正在刷新的，就直接把同一个结果给所有人用
}

// 登录彻底失效时：清掉本地所有登录信息，跳回登录页
function clearLoginState() {
  ;['token', 'refreshToken', 'username', 'role'].forEach((k) => localStorage.removeItem(k))
  window.location.hash = '#/login'
}

// ========== 请求拦截器：发出去之前自动做的事 ==========
service.interceptors.request.use((config) => {
  // 除了登录接口，其他请求都自动带上 token（证明你是谁）
  if (config.auth !== false) {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config  // 把加工好的请求交出去
})

// ========== 响应拦截器：拿回来之后自动做的事 ==========
service.interceptors.response.use(
  // 成功回来的数据
  (response) => {
    const body = response.data
    // 后端约定 code 不为 0 就是业务失败（比如"问卷不存在"），转成错误抛出
    if (body && typeof body === 'object' && body.code !== undefined && body.code !== 0) {
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    // 把真正的数据从 { code, data, message } 里拆出来，页面直接拿到 data
    return body && typeof body === 'object' && 'data' in body ? body.data : body
  },
  // 失败回来的请求（网络错误、401、500 等）
  async (error) => {
    const config = error.config        // 出错的那个请求的配置
    if (!config) return Promise.reject(error)
    const isAuthApi = config.url.includes('/auth/')  // 判断是不是登录/刷新接口本身

    // 如果是 401（登录过期）且没重试过，就刷新 token 后自动再发一次
    if (error.response?.status === 401 && !config._retried && !isAuthApi) {
      config._retried = true           // 打标记：这是重试的一次，别无限重试
      try {
        await refreshToken()           // 先换新 token
        return service(config)         // 用新 token 把刚才失败的请求重发一遍
      } catch (e) {
        clearLoginState()              // 连刷新都失败了，只能退出登录
        return Promise.reject(e)
      }
    }
    // 普通 401（比如刷新接口自己过期了），直接清登录态
    if (error.response?.status === 401) clearLoginState()
    // 非静默请求弹一个错误提示（silent: true 表示调用方想自己处理，不弹）
    if (!config.silent) ElMessage.error(error.response?.data?.message || error.message || '请求失败')
    return Promise.reject(error)       // 把错误继续抛给页面
  }
)

// 造出 get / post / put / delete 四个方法，页面里就还是 request.get(...) 这么用
function createMethod(method) {
  return (url, dataOrConfig = {}, maybeConfig = {}) => {
    const isGet = method === 'get'
    // get 请求：第二个参数是配置（里面有 params 查询参数）；其他请求：第二个参数是请求体
    const config = isGet ? dataOrConfig : maybeConfig
    const data = isGet ? undefined : dataOrConfig
    return service.request({ ...config, url, method, data })
  }
}

// 最终导出的对象，页面从 '@/api/request' 引入的就是它
const request = {
  get: createMethod('get'),
  post: createMethod('post'),
  put: createMethod('put'),
  delete: createMethod('delete')
}

export default request
