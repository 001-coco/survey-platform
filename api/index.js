/**
 * Vercel Serverless 入口。
 *
 * Vercel 会把 api/ 目录下的文件变成独立函数：api/index.js 对应路径 /api。
 * Express app 本身就是一个 (req, res) 函数，直接转交即可，业务代码一行都不用改。
 *
 * 前端与接口同域，所以生产环境不需要配 VITE_API_BASE，也不存在跨域。
 */
import app from '../server/app.js'

export default function handler(req, res) {
  // 兜底：不同运行环境传给函数的 req.url 可能是 /auth/login 或 /api/auth/login，
  // 这里统一补成 /api 前缀，保证 Express 里以 /api 开头的路由都能匹配上
  const url = req.url || '/'
  if (!url.startsWith('/api')) {
    req.url = '/api' + (url === '/' ? '' : url)
  }
  return app(req, res)
}
