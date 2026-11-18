# 上线部署（Vercel 单项目，免费、不绑卡）

整个项目部署成**一个** Vercel 项目：前端页面和 `/api` 接口同域，不需要买服务器、不需要配跨域、不需要填任何环境变量。

- 网页地址：`https://xxx.vercel.app`
- 接口地址：`https://xxx.vercel.app/api/...`（同一个域名）

---

## 部署步骤

### 1. 打开 Vercel 并登录

https://vercel.com → **Continue with GitHub** → 授权

免费 Hobby 套餐不需要绑卡。

### 2. 导入仓库

- 点 **Add New...** → **Project**
- 在列表里找到 `survey-platform` → 点 **Import**

（如果列表里没有，点 **Adjust GitHub App Permissions** 把仓库授权给 Vercel）

### 3. 直接点 Deploy

**什么都不要改，也不要加环境变量。**

页面上的配置会自动读成：

| 项 | 值 | 来源 |
|---|---|---|
| Framework Preset | Vite | `vercel.json` |
| Build Command | `npm run build` | `vercel.json` |
| Output Directory | `dist` | `vercel.json` |

点 **Deploy**，等 1~2 分钟。

---

## 部署完成后

Vercel 会给你形如 `https://survey-platform-abc123.vercel.app` 的地址，打开即可用：

- 账号 `admin` / 密码 `admin123`

**为什么不用配环境变量？**

前端默认请求 `/api`（`src/api/request.js` 里的兜底值），而同域下的 `/api` 正好由 `api/index.js` 这个函数处理，所以生产环境什么都不用配。

---

## 关于数据（重要）

Vercel 的 Serverless 函数**没有持久磁盘**，`/tmp` 只在单个实例存活期间有效：

- 一段时间没人访问 → 实例回收 → 数据回到初始状态（只剩默认账号）
- 两个人同时访问可能命中不同实例 → 互相看不到对方的数据

**所以：用来演示、面试展示没问题；真要收集真实问卷数据，必须换数据库。**

换数据库只需改 `server/app.js` 里的 `readDB()` / `writeDB()` 两个函数，上层的路由和校验都不用动。可选方案：

- **Supabase**（Postgres，免费额度够用，不绑卡）
- **Upstash Redis**（免费额度，按请求计费）
- **Vercel Postgres / KV**（需要绑卡）

---

## 出问题看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| 打开页面 404 | 部署失败或构建产物路径不对 | Vercel → Deployments → 看构建日志 |
| 登录报「网络异常」 | `/api` 请求没有到达函数 | Vercel → 项目 → Functions 里确认 `api/index.js` 存在 |
| 接口 500 | 函数运行时报错 | Vercel → 项目 → Logs（Real-time）查看堆栈 |
| 登录后一会儿就掉线 | accessToken 只有 2 分钟，靠 refresh 续期 | 正常现象，会自动刷新；Network 里能看到 `/api/auth/refresh` |
| 刷新页面数据没了 | 上面的「关于数据」 | 演示可忽略 |
| 想改成前后端分开部署 | 需要另配 `VITE_API_BASE` 和后端 `ALLOWED_ORIGINS` | 见 `.env.example` |

---

## 本地开发（不受影响）

双击项目根目录的 `start.bat`，它会起后端 3000 + 前端 5173，Vite 把 `/api` 代理到 3000。

本地仍然用 `server/index.js` 常驻启动，和线上走的是同一份 `server/app.js`。
