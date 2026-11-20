# 上线部署

## 架构（为什么这么绕）

```
浏览器  →  https://xxx.netlify.app        页面（Netlify，国内可访问，GitHub 登录免邮箱验证）
        →  https://xxx.netlify.app/api/*  函数转发
                                        ↓（服务器到服务器，不走国内 DNS）
                     https://xxx.vercel.app/api/*   真正的接口（Vercel）
```

原因：`*.vercel.app` 在国内被 DNS 劫持（解析到无关 IP，换 DNS、用加密 DNS 均无效），浏览器打不开；而 `*.netlify.app` 和 `*.pages.dev` 可以正常访问。

所以页面放在能访问的平台上，接口请求由平台的服务端转发给 Vercel。浏览器全程只和 netlify.app 打交道，前端仍然是同域 `/api`，不存在跨域。

- Netlify 版转发：`netlify/functions/api.js`
- Cloudflare 版转发：`functions/api/[[path]].js`

两套只保留一套即可，转发逻辑完全一样。

---

## 方案 A：Netlify（推荐）

**优点：用 GitHub 账号登录，不需要邮箱验证码。**

### 1. 注册 / 登录

https://app.netlify.com

点 **Sign up** → 选 **GitHub** → 授权。

不需要邮箱验证，不需要绑卡。

### 2. 导入仓库

- **Add new site** → **Import an existing project**
- 选 **GitHub** → 授权 → 选 `001-coco/survey-platform`

### 3. 确认配置

Netlify 会读取仓库里的 `netlify.toml`，自动填好：

| 字段 | 值 |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |

**不用加任何环境变量。**

点 **Deploy site**，等 1~2 分钟。

### 4. 拿到链接

```
https://随机名字.netlify.app
```

可在 **Site configuration → Change site name** 改成好记的名字。

---

## 方案 B：Cloudflare Pages

同样可行，但注册要收邮箱验证码（QQ 邮箱容易拦截，去垃圾箱找）。

1. https://dash.cloudflare.com → 注册 → 验证邮箱
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选仓库，Framework preset 选 **Vue**，Build command `npm run build`，Output `dist`
4. **Save and Deploy**

得到 `https://xxx.pages.dev`。

---

## 如果接口报错

说明转发层里写死的 Vercel 地址不对（默认 `https://survey-platform.vercel.app`）。

1. Vercel 项目 → **Settings** → **Domains**，复制真实域名
2. 在 Netlify / Cloudflare 的环境变量里加：

   | Name | Value |
   |---|---|
   | `BACKEND_ORIGIN` | `https://你的真实域名.vercel.app` |

3. 重新部署（Netlify: Deploys → Trigger deploy）

---

## 关于数据（重要）

后端跑在 Vercel Serverless 上，`/tmp` 不是持久存储：

- 实例回收后数据重置，只剩默认账号 `admin / admin123`
- 多人同时访问可能命中不同实例，互相看不到对方数据

**演示、面试展示够用；真要收真实问卷必须换数据库。** 换的时候只改 `server/app.js` 里的 `readDB()` / `writeDB()` 两个函数，路由和校验都不用动。可选：Supabase（免费、不绑卡）、Upstash Redis、Vercel Postgres。

---

## 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 打开白屏 | 发布目录填错 | 确认 publish/output 是 `dist` |
| 登录提示「网络异常」 | 转发地址不对 | 见「如果接口报错」 |
| 接口 502 | 平台连不上 Vercel | Vercel 项目被删或域名变了 |
| 改了代码没生效 | 没推送或没重新部署 | `git push` 后平台会自动重建 |
| 数据没了 | Serverless 无持久磁盘 | 见「关于数据」 |
| `*.vercel.app` 打不开 | DNS 劫持 | 正常，用 netlify.app / pages.dev 入口访问 |

---

## 本地开发（不受影响）

双击项目根目录的 `start.bat`：后端 3000（`server/index.js` 常驻）、前端 5173，Vite 把 `/api` 代理到 3000。

`netlify/` 和 `functions/` 目录只在云平台上生效，本地开发不会用到。
