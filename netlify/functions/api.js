/**
 * Netlify Function：把 /api/* 转发到 Vercel 上的后端。
 *
 * 与 functions/api/[[path]].js（Cloudflare 版）作用完全相同，
 * 只是两家的函数签名不一样：
 *   Cloudflare → onRequest(context) 用 fetch(Request) 风格
 *   Netlify    → handler(event) 用 { statusCode, headers, body } 风格
 *
 * 为什么要有这一层：*.vercel.app 在国内被 DNS 劫持，浏览器打不开；
 * 而 *.netlify.app / *.pages.dev 可以正常访问，所以页面放这些平台，
 * 接口请求由平台的服务端转发给 Vercel（服务器之间通信，不走国内 DNS）。
 */
const DEFAULT_BACKEND_ORIGIN = 'https://survey-platform.vercel.app'

export const handler = async (event) => {
  const backend = (process.env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, '')

  // event.rawUrl 是浏览器真正请求的地址，不受 Netlify 内部重写影响
  let pathname = '/api'
  let search = ''
  try {
    const original = new URL(event.rawUrl)
    pathname = original.pathname
    search = original.search
  } catch {
    pathname = event.path || '/api'
    search = event.rawQuery ? `?${event.rawQuery}` : ''
  }

  // Netlify 给的 header 键名大小写不统一，统一转小写后再剔除特定项
  const headers = {}
  for (const [key, value] of Object.entries(event.headers || {})) {
    headers[key.toLowerCase()] = value
  }
  // 这几个头由各自的网络层负责，透传反而会出错
  delete headers.host
  delete headers['content-length']
  delete headers['accept-encoding']
  delete headers.connection

  const init = {
    method: event.httpMethod || 'GET',
    headers,
    redirect: 'manual'
  }

  if (init.method !== 'GET' && init.method !== 'HEAD' && event.body) {
    init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body
  }

  try {
    const upstream = await fetch(backend + pathname + search, init)
    const text = await upstream.text()

    return {
      statusCode: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      },
      body: text
    }
  } catch {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ code: 502, message: '后端服务暂时不可用' })
    }
  }
}
