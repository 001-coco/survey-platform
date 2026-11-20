const DEFAULT_BACKEND_ORIGIN = 'https://survey-platform.vercel.app'

export default async (request, context) => {
  const backend = (context?.env?.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, '')
  const original = new URL(request.url)
  const target = backend + original.pathname + original.search

  try {
    const upstream = await fetch(target, { method: request.method, redirect: 'manual' })
    const text = await upstream.text()
    return new Response(
      JSON.stringify({
        target,
        upstreamStatus: upstream.status,
        upstreamType: upstream.headers.get('content-type'),
        preview: text.slice(0, 200)
      }, null, 2),
      { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ target, error: String(err) }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    })
  }
}

export const config = { path: '/api/*' }
