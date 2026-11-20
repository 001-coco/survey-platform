/**
 * Cloudflare Pages Function：把 /api/* 转发给 Vercel 上的后端。
 *
 * 为什么要这一层？
 *   - Vercel 免费域名 *.vercel.app 在国内被 DNS 污染，浏览器打不开
 *   - Cloudflare 的 *.pages.dev 可以正常访问
 *   - 所以页面放 Cloudflare，接口请求在 Cloudflare 边缘节点上转发到 Vercel
 *     （服务器到服务器，不受国内 DNS 污染影响）
 *
 * 效果：浏览器只和 pages.dev 打交道，前端仍然是同域请求 /api，不存在跨域。
 *
 * 如果以后 Vercel 的域名变了，改下面的 BACKEND_ORIGIN，
 * 或者在 Cloudflare Pages 的环境变量里设置 BACKEND_ORIGIN 覆盖。
 */
const DEFAULT_BACKEND_ORIGIN = 'https://survey-platform.vercel.app'

export const onRequest = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const origin = (env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, '')

  const headers = new Headers(request.headers)
  headers.delete('host')        // 由目标服务自己决定
  headers.delete('cf-connecting-ip')

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  }

  // GET / HEAD 不能带 body
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  try {
    const upstream = await fetch(origin + url.pathname + url.search, init)

    // 只透传 content-type，避免把 content-encoding / content-length 等
    // 已被中间层处理过的头带回来导致响应错乱
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    })
  } catch {
    return new Response(
      JSON.stringify({ code: 502, message: '后端服务暂时不可用' }),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } }
    )
  }
}
