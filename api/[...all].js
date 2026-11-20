/**
 * Vercel 全路径入口：api/[...all].js 会接管 /api 下的所有路径，
 * 并把**原始路径**（/api/auth/login 等）原样交给 Express。
 *
 * 之前用 api/index.js + vercel.json 的 rewrites 时，路径会被改写成 /api，
 * 导致 Express 匹配不到具体路由、所有接口都 404。改用 catch-all 后不再需要 rewrites。
 */
import app from '../server/app.js'

export default function handler(req, res) {
  const url = req.url || '/'
  if (!url.startsWith('/api')) {
    req.url = '/api' + (url === '/' ? '' : url)
  }
  return app(req, res)
}
