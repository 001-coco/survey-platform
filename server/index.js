/**
 * 长驻服务启动入口（本地开发 / 自己的服务器 / Render 等平台专用）。
 * 云端 Serverless（Vercel）不用这个文件，见 api/index.js。
 *
 * 应用本体在 server/app.js，这里只负责：读端口 + 开始监听。
 */
import app from './app.js'

// 云平台会注入 PORT，本地默认 3000
const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`)
  console.log('[server] 默认账号：admin / admin123')
})
