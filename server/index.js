/**
 * 极简后端：Express + JSON 文件持久化
 * 只用 express + cors 两个依赖，无数据库、无原生编译，保证能直接跑起来。
 *
 * 接口一览：
 *   POST   /api/auth/login
 *   GET    /api/surveys?page&size&keyword&status
 *   POST   /api/surveys
 *   GET    /api/surveys/:id
 *   PUT    /api/surveys/:id
 *   DELETE /api/surveys/:id
 *   POST   /api/surveys/:id/publish
 *   POST   /api/surveys/:id/answers
 *   GET    /api/surveys/:id/answers
 *   GET    /api/surveys/:id/stats
 */
import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 允许用环境变量指定数据文件位置（部署到云平台时文件系统只读/临时，可指到 /tmp）
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json')

/* ---------------- 存储层 ---------------- */
function defaultDB() {
  return {
    users: [{ id: 'u1', username: 'admin', password: 'admin123', role: 'admin' }],
    surveys: [],
    answers: []
  }
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const db = defaultDB()
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
    return db
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

let db = readDB()

/* ---------------- 鉴权：手写极简 JWT ---------------- */
const SECRET = 'mini-survey-secret'
const TOKEN_TTL = 1000 * 60 * 60 * 24 // refreshToken 24h
const ACCESS_TTL = 1000 * 60 * 2      // accessToken 只给 2 分钟：方便复现「过期 → 401 → 无感刷新」，演示时不用等太久

function base64url(str) {
  return Buffer.from(str).toString('base64url')
}

function signToken(payload, ttl = TOKEN_TTL) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + ttl }))
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyToken(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  if (expected !== signature) return null // 签名不符，拒绝
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
    if (payload.exp < Date.now()) return null // 过期
    return payload
  } catch {
    return null
  }
}

/** 鉴权中间件：注意这里解析出 userId 后，后续所有查询都会带上归属校验，防越权 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const payload = verifyToken(token)
  // typ 必须是 access：防止把 refreshToken 直接当接口凭证用
  if (!payload || payload.typ !== 'access') return res.status(401).json({ code: 401, message: '未登录或登录已过期' })
  req.user = payload
  next()
}

/* ---------------- 工具 ---------------- */
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

function ok(res, data) {
  res.json({ code: 0, data, message: 'ok' })
}
function fail(res, message, code = 400, status = 400) {
  res.status(status).json({ code, message })
}

/** 后端二次校验：前端校验只是体验，可以被绕过 */
function validateSurvey(payload) {
  if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) {
    return '标题不能为空'
  }
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
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)

    if (q.required && isEmpty) {
      return { error: `「${q.title}」为必填项` }
    }
    result[q.id] = value ?? (q.type === 'checkbox' ? [] : '')
  }
  return { data: result }
}

/* ---------------- 应用 ---------------- */
const app = express()
/* CORS 白名单：ALLOWED_ORIGINS=https://xxx.pages.dev,http://localhost:5173
   支持 *.pages.dev 这种通配；不配置时放开（方便本地开发和 curl 调试） */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)             // 同源请求 / curl
    if (!ALLOWED_ORIGINS.length) return callback(null, true) // 未配置：不限制
    const allowed = ALLOWED_ORIGINS.some((rule) =>
      rule.startsWith('*.') ? origin.endsWith(rule.slice(1)) : rule === origin
    )
    callback(allowed ? null : new Error('Not allowed by CORS'), allowed)
  }
}))
app.use(express.json({ limit: '2mb' }))

/* 登录 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = db.users.find((u) => u.username === username && u.password === password)
  if (!user) return fail(res, '用户名或密码错误', 401, 401)

  // 双 token：access 短（2 分钟）、refresh 长（24h）
  const token = signToken({ userId: user.id, username: user.username, role: user.role, typ: 'access' }, ACCESS_TTL)
  const refreshToken = signToken({ userId: user.id, typ: 'refresh' }, TOKEN_TTL)
  ok(res, { token, refreshToken, user: { id: user.id, username: user.username, role: user.role } })
})

/* 用 refreshToken 换新的 accessToken（401 后前端自动调用，对用户无感） */
app.post('/api/auth/refresh', (req, res) => {
  const payload = verifyToken(req.body?.refreshToken)
  if (!payload || payload.typ !== 'refresh') return fail(res, '登录已过期，请重新登录', 401, 401)

  const user = db.users.find((u) => u.id === payload.userId)
  if (!user) return fail(res, '用户不存在', 401, 401)

  const token = signToken({ userId: user.id, username: user.username, role: user.role, typ: 'access' }, ACCESS_TTL)
  ok(res, { token })
})

/* 问卷列表：分页 + 关键词 + 状态筛选 */
app.get('/api/surveys', authMiddleware, (req, res) => {
  const { page = '1', size = '10', keyword = '', status = '' } = req.query
  let list = db.surveys.filter((s) => s.creatorId === req.user.userId)

  if (keyword) list = list.filter((s) => s.title.includes(keyword))
  if (status) list = list.filter((s) => s.status === status)

  const total = list.length
  const start = (Number(page) - 1) * Number(size)
  const paged = list
    .slice(start, start + Number(size))
    .map((s) => ({ ...s, answerCount: db.answers.filter((a) => a.surveyId === s.id).length }))

  ok(res, { list: paged, total, page: Number(page), size: Number(size) })
})

/* 创建 */
app.post('/api/surveys', authMiddleware, (req, res) => {
  const err = validateSurvey(req.body)
  if (err) return fail(res, err, 422)

  const survey = {
    id: uid('s'),
    title: req.body.title,
    desc: req.body.desc || '',
    status: 'draft', // draft | published | stopped
    questions: req.body.questions || [],
    creatorId: req.user.userId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  db.surveys.unshift(survey)
  writeDB(db)
  ok(res, survey)
})

/* 详情（问卷本身，后台编辑用） */
app.get('/api/surveys/:id', authMiddleware, (req, res) => {
  const survey = db.surveys.find((s) => s.id === req.params.id && s.creatorId === req.user.userId)
  if (!survey) return fail(res, '问卷不存在', 404, 404)
  ok(res, survey)
})

/* 更新 */
app.put('/api/surveys/:id', authMiddleware, (req, res) => {
  const survey = db.surveys.find((s) => s.id === req.params.id && s.creatorId === req.user.userId)
  if (!survey) return fail(res, '问卷不存在', 404, 404)

  const err = validateSurvey({ ...survey, ...req.body })
  if (err) return fail(res, err, 422)

  Object.assign(survey, {
    title: req.body.title ?? survey.title,
    desc: req.body.desc ?? survey.desc,
    questions: req.body.questions ?? survey.questions,
    updatedAt: Date.now()
  })
  writeDB(db)
  ok(res, survey)
})

/* 删除（连同答卷一起删） */
app.delete('/api/surveys/:id', authMiddleware, (req, res) => {
  const idx = db.surveys.findIndex((s) => s.id === req.params.id && s.creatorId === req.user.userId)
  if (idx === -1) return fail(res, '问卷不存在', 404, 404)

  db.surveys.splice(idx, 1)
  db.answers = db.answers.filter((a) => a.surveyId !== req.params.id)
  writeDB(db)
  ok(res, null)
})

/* 发布 / 停止 */
app.post('/api/surveys/:id/publish', authMiddleware, (req, res) => {
  const survey = db.surveys.find((s) => s.id === req.params.id && s.creatorId === req.user.userId)
  if (!survey) return fail(res, '问卷不存在', 404, 404)

  survey.status = survey.status === 'published' ? 'stopped' : 'published'
  survey.updatedAt = Date.now()
  writeDB(db)
  ok(res, survey)
})

/* 提交答卷（公开接口，无需登录） */
app.post('/api/surveys/:id/answers', (req, res) => {
  const survey = db.surveys.find((s) => s.id === req.params.id)
  if (!survey) return fail(res, '问卷不存在', 404, 404)
  if (survey.status !== 'published') return fail(res, '问卷未发布或已停止', 403, 403)

  const { error, data } = validateAnswer(survey, req.body?.data || {})
  if (error) return fail(res, error, 422)

  const answer = { id: uid('a'), surveyId: survey.id, data, submittedAt: Date.now() }
  db.answers.push(answer)
  writeDB(db)
  ok(res, answer)
})

/* 答卷列表 */
app.get('/api/surveys/:id/answers', authMiddleware, (req, res) => {
  const survey = db.surveys.find((s) => s.id === req.params.id && s.creatorId === req.user.userId)
  if (!survey) return fail(res, '问卷不存在', 404, 404)

  const list = db.answers.filter((a) => a.surveyId === survey.id)
  ok(res, { list, total: list.length })
})

/* 统计分析 */
app.get('/api/surveys/:id/stats', authMiddleware, (req, res) => {
  const survey = db.surveys.find((s) => s.id === req.params.id && s.creatorId === req.user.userId)
  if (!survey) return fail(res, '问卷不存在', 404, 404)

  const list = db.answers.filter((a) => a.surveyId === survey.id)

  // 按天聚合回收量
  const trendMap = new Map()
  list.forEach((a) => {
    const day = new Date(a.submittedAt).toISOString().slice(0, 10)
    trendMap.set(day, (trendMap.get(day) || 0) + 1)
  })
  const trend = [...trendMap.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1))

  // 逐题统计选项占比
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
    // 文本题：返回最近若干条文本
    return {
      id: q.id,
      title: q.title,
      type: q.type,
      texts: list.map((a) => a.data[q.id]).filter(Boolean).slice(-20)
    }
  })

  ok(res, { total: list.length, trend, questionStats })
})

/* 填写端拉取问卷（公开，只返回已发布的） */
app.get('/api/public/surveys/:id', (req, res) => {
  const survey = db.surveys.find((s) => s.id === req.params.id && s.status === 'published')
  if (!survey) return fail(res, '问卷不存在或未发布', 404, 404)
  ok(res, { id: survey.id, title: survey.title, desc: survey.desc, questions: survey.questions })
})

/* 全局错误处理 */
app.use((err, req, res, next) => {
  // 跨域被白名单拒绝时统一回 403，不要混进 5xx
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ code: 403, message: '跨域来源不被允许' })
  }
  console.error(err)
  res.status(500).json({ code: 500, message: '服务端内部错误' })
})

// 云平台会注入 PORT，本地默认 3000
const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`)
  console.log('[server] 默认账号：admin / admin123')
})
