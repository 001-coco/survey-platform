/**
 * Netlify Function（Functions 2.0）：把 /api/* 转发到 Vercel 上的后端。
 *
 * 为什么需要有这一层：*.vercel.app 在国内被 DNS 劫持，浏览器打不开；
 * 而 *.netlify.app 可以正常访问，所以页面放 Netlify，
 * 接口请求由 Netlify 的服务端转发给 Vercel（服务器之间通信，不走本地 DNS）。
 *
 * 2.0 的写法：标准 Request/Response，并通过 config.path 直接绑定路由。
 */
const DEFAULT_BACKEND_ORIGIN = 'https://survey-platform-lyart.vercel.app'

export default async (request, context) => {
  const backend = (context?.env?.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, '')
  const original = new URL(request.url)

  const headers = new Headers(request.headers)
  // 这几个头由各自的网络层负责，透传会出错
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('accept-encoding')
  headers.delete('connection')

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  try {
    const upstream = await fetch(backend + original.pathname + original.search, init)

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ code: 502, message: '后端服务暂时不可用', detail: String(err) }),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } }
    )
  }
}

export const config = { path: '/api/*' }
