/**
 * Netlify Function：后端全部接口（Functions 2.0 写法，标准 Request/Response）。
 *
 * 为什么不用 Express：Netlify 的函数运行在 Serverless 环境里，
 * 没有长驻的 http 服务器，Express 的 app.listen 那套在这里不适用。
 * 所以这里用 Hono（同样是"路由 + 中间件"，但基于 Web 标准），
 * 业务规则（鉴权、校验、数据结构）与本地 server/app.js 保持一致。
 *
 * 数据存在函数实例的内存里：实例被回收后会重置为默认账号。
 * 演示够用；要持久化，把 getDB()/save() 换成 Netlify Blobs 或外部数据库即可。
 */
import { Hono } from 'hono'
import crypto from 'node:crypto'

/* ---------------- 存储 ---------------- */
function defaultDB() {
  return {
    users: [{ id: 'u1', username: 'admin', password: 'admin123', role: 'admin' }],
    surveys: [],
    answers: []
  }
}

let db = null

function getDB() {
  if (!db) db = defaultDB()
  return db
}

// 内存存储无需落盘，保留这个函数是为了日后换成数据库时语义一致
function save() {}

/* ---------------- 鉴权：手写极简 JWT ---------------- */
const SECRET = process.env.JWT_SECRET || 'mini-survey-secret'
const TOKEN_TTL = 1000 * 60 * 60 * 24 // refreshToken 24h
const ACCESS_TTL = 1000 * 60 * 2      // accessToken 2 分钟（方便演示无感刷新）

const b64 = (str) => Buffer.from(str).toString('base64url')

function signToken(payload, ttl = TOKEN_TTL) {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttl }))
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyToken(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  if (expected !== signature) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/* ---------------- 工具 ---------------- */
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const ok = (c, data) => c.json({ code: 0, data, message: 'ok' })
const fail = (c, message, code = 400, status = 400) => c.json({ code, message }, status)

/** 后端二次校验：前端校验只是体验，可以被绕过 */
function validateSurvey(payload) {
  if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) return '标题不能为空'
  if (!Array.isArray(payload.questions)) return '题目必须是数组'
  const allowTypes = ['input', 'textarea', 'radio', 'checkbox']
  for (const q of payload.questions) {
    if (!q.id || !q.title) return '题目必须包含 id 与 title'
    if (!allowTypes.includes(q.type)) return `不支持的题型：${q.type}`
    if ((q.type === 'radio' || q.type === 'checkbox') && (!Array.isArray(q.options) || q.options.length === 0)) {
      return `选择题「${q.title}」必须配置选项`
    }
  }
  return null
}

function validateAnswer(survey, data) {
  const result = {}
  for (const q of survey.questions) {
    const value = data[q.id]
    const isEmpty =
      value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)

    if (q.required && isEmpty) return { error: `「${q.title}」为必填项` }
    result[q.id] = value ?? (q.type === 'checkbox' ? [] : '')
  }
  return { data: result }
}

/* ---------------- 应用 ---------------- */
const app = new Hono()

// 鉴权中间件：typ 必须是 access，防止拿 refreshToken 直接调接口
const auth = async (c, next) => {
  const header = c.req.header('authorization') || ''
  const payload = verifyToken(header.replace(/^Bearer\s+/i, ''))
  if (!payload || payload.typ !== 'access') return fail(c, '未登录或登录已过期', 401, 401)
  c.set('user', payload)
  await next()
}

const currentUser = (c) => c.get('user')

/** 统一读取 JSON 请求体：先取文本再解析，避免平台侧的流处理差异导致解析不到 */
async function readJson(c) {
  try {
    const text = await c.req.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}


/* 登录 */
app.post('/api/auth/login', async (c) => {
  const body = await readJson(c)
  const { username, password } = body || {}
  const user = getDB().users.find((u) => u.username === username && u.password === password)
  if (!user) return fail(c, '用户名或密码错误', 401, 401)

  const token = signToken({ userId: user.id, username: user.username, role: user.role, typ: 'access' }, ACCESS_TTL)
  const refreshToken = signToken({ userId: user.id, typ: 'refresh' }, TOKEN_TTL)
  return ok(c, { token, refreshToken, user: { id: user.id, username: user.username, role: user.role } })
})

/* 刷新 accessToken */
app.post('/api/auth/refresh', async (c) => {
  const body = await readJson(c)
  const payload = verifyToken(body?.refreshToken)
  if (!payload || payload.typ !== 'refresh') return fail(c, '登录已过期，请重新登录', 401, 401)

  const user = getDB().users.find((u) => u.id === payload.userId)
  if (!user) return fail(c, '用户不存在', 401, 401)

  const token = signToken({ userId: user.id, username: user.username, role: user.role, typ: 'access' }, ACCESS_TTL)
  return ok(c, { token })
})

/* 问卷列表：分页 + 关键词 + 状态筛选 */
app.get('/api/surveys', auth, (c) => {
  const { page = '1', size = '10', keyword = '', status = '' } = c.req.query()
  const store = getDB()
  let list = store.surveys.filter((s) => s.creatorId === currentUser(c).userId)

  if (keyword) list = list.filter((s) => s.title.includes(keyword))
  if (status) list = list.filter((s) => s.status === status)

  const total = list.length
  const start = (Number(page) - 1) * Number(size)
  const paged = list
    .slice(start, start + Number(size))
    .map((s) => ({ ...s, answerCount: store.answers.filter((a) => a.surveyId === s.id).length }))

  return ok(c, { list: paged, total, page: Number(page), size: Number(size) })
})

/* 创建 */
app.post('/api/surveys', auth, async (c) => {
  const body = await readJson(c)
  const err = validateSurvey(body)
  if (err) return fail(c, err, 422)

  const survey = {
    id: uid('s'),
    title: body.title,
    desc: body.desc || '',
    status: 'draft',
    questions: body.questions || [],
    creatorId: currentUser(c).userId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  getDB().surveys.unshift(survey)
  save()
  return ok(c, survey)
})

/* 详情 */
app.get('/api/surveys/:id', auth, (c) => {
  const survey = getDB().surveys.find((s) => s.id === c.req.param('id') && s.creatorId === currentUser(c).userId)
  if (!survey) return fail(c, '问卷不存在', 404, 404)
  return ok(c, survey)
})

/* 更新 */
app.put('/api/surveys/:id', auth, async (c) => {
  const body = await readJson(c)
  const survey = getDB().surveys.find((s) => s.id === c.req.param('id') && s.creatorId === currentUser(c).userId)
  if (!survey) return fail(c, '问卷不存在', 404, 404)

  const err = validateSurvey({ ...survey, ...body })
  if (err) return fail(c, err, 422)

  Object.assign(survey, {
    title: body.title ?? survey.title,
    desc: body.desc ?? survey.desc,
    questions: body.questions ?? survey.questions,
    updatedAt: Date.now()
  })
  save()
  return ok(c, survey)
})

/* 删除（连同答卷） */
app.delete('/api/surveys/:id', auth, (c) => {
  const store = getDB()
  const idx = store.surveys.findIndex((s) => s.id === c.req.param('id') && s.creatorId === currentUser(c).userId)
  if (idx === -1) return fail(c, '问卷不存在', 404, 404)

  const id = store.surveys[idx].id
  store.surveys.splice(idx, 1)
  store.answers = store.answers.filter((a) => a.surveyId !== id)
  save()
  return ok(c, null)
})

/* 发布 / 停止 */
app.post('/api/surveys/:id/publish', auth, (c) => {
  const survey = getDB().surveys.find((s) => s.id === c.req.param('id') && s.creatorId === currentUser(c).userId)
  if (!survey) return fail(c, '问卷不存在', 404, 404)

  survey.status = survey.status === 'published' ? 'stopped' : 'published'
  survey.updatedAt = Date.now()
  save()
  return ok(c, survey)
})

/* 提交答卷（公开） */
app.post('/api/surveys/:id/answers', async (c) => {
  const body = await readJson(c)
  const survey = getDB().surveys.find((s) => s.id === c.req.param('id'))
  if (!survey) return fail(c, '问卷不存在', 404, 404)
  if (survey.status !== 'published') return fail(c, '问卷未发布或已停止', 403, 403)

  const { error, data } = validateAnswer(survey, body?.data || {})
  if (error) return fail(c, error, 422)

  const answer = { id: uid('a'), surveyId: survey.id, data, submittedAt: Date.now() }
  getDB().answers.push(answer)
  save()
  return ok(c, answer)
})

/* 答卷列表 */
app.get('/api/surveys/:id/answers', auth, (c) => {
  const survey = getDB().surveys.find((s) => s.id === c.req.param('id') && s.creatorId === currentUser(c).userId)
  if (!survey) return fail(c, '问卷不存在', 404, 404)

  const list = getDB().answers.filter((a) => a.surveyId === survey.id)
  return ok(c, { list, total: list.length })
})

/* 统计 */
app.get('/api/surveys/:id/stats', auth, (c) => {
  const survey = getDB().surveys.find((s) => s.id === c.req.param('id') && s.creatorId === currentUser(c).userId)
  if (!survey) return fail(c, '问卷不存在', 404, 404)

  const list = getDB().answers.filter((a) => a.surveyId === survey.id)

  const trendMap = new Map()
  list.forEach((a) => {
    const day = new Date(a.submittedAt).toISOString().slice(0, 10)
    trendMap.set(day, (trendMap.get(day) || 0) + 1)
  })
  const trend = [...trendMap.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1))

  const questionStats = survey.questions.map((q) => {
    if (q.type === 'radio' || q.type === 'checkbox') {
      const counter = new Map()
      list.forEach((a) => {
        const value = a.data[q.id]
        const values = Array.isArray(value) ? value : [value]
        values.forEach((v) => v && counter.set(v, (counter.get(v) || 0) + 1))
      })
      return {
        id: q.id,
        title: q.title,
        type: q.type,
        options: q.options.map((o) => ({ label: o.label, count: counter.get(o.value) || 0 }))
      }
    }
    return {
      id: q.id,
      title: q.title,
      type: q.type,
      texts: list.map((a) => a.data[q.id]).filter(Boolean).slice(-20)
    }
  })

  return ok(c, { total: list.length, trend, questionStats })
})

/* 填写端拉取（公开，只返回已发布） */
app.get('/api/public/surveys/:id', (c) => {
  const survey = getDB().surveys.find((s) => s.id === c.req.param('id') && s.status === 'published')
  if (!survey) return fail(c, '问卷不存在或未发布', 404, 404)
  return ok(c, { id: survey.id, title: survey.title, desc: survey.desc, questions: survey.questions })
})

/* 兜底 404 与错误处理 */
app.notFound((c) => fail(c, '接口不存在', 404, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ code: 500, message: '服务端内部错误' }, 500)
})

/* Netlify Functions 2.0 入口 */
export default async (request, context) => {
  return app.fetch(request, context?.env ?? {}, context)
}

export const config = { path: '/api/*' }
