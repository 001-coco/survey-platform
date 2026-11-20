/**
 * Vercel Serverless 入口：api/index.js 对应路径 /api，
 * 配合 vercel.json 里的 rewrite（/api/:path* → /api），
 * 把 /api 下的所有请求交给同一个 Express 应用。
 */
import app from '../server/app.js'

export default function handler(req, res) {
  // 兜底：确保 Express 看到的是以 /api 开头的路径
  const url = req.url || '/'
  if (!url.startsWith('/api')) {
    req.url = '/api' + (url === '/' ? '' : url)
  }
  return app(req, res)
}
