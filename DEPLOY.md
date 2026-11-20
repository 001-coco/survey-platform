# 上线部署

## 架构（为什么这么绕）

```
浏览器  →  https://xxx.netlify.app        页面（Netlify，国内可访问）
        →  https://xxx.netlify.app/api/*  函数转发
                                        ↓（服务器到服务器，不走国内 DNS）
                     https://xxx.vercel.app/api/*   真正的接口（Vercel）
```

原因：`*.vercel.app` 在国内被 DNS 劫持——解析到无关 IP，换 DNS 服务器、用加密 DNS（DoH）都拿不到真实地址，浏览器打不开。而 `*.netlify.app` 可以正常访问。

所以页面放 Netlify，接口请求由 Netlify 的服务端转发给 Vercel。浏览器全程只和 netlify.app 打交道，前端仍然是同域 `/api`，不存在跨域。

转发实现：`netlify/functions/api.js`（只搬运请求，不改业务逻辑）。

> Cloudflare Pages 也测过（`functions/api/[[path]].js` 曾存在），但 `dash.cloudflare.com` 当前访问不稳定，无法完成注册部署，已移除。若日后 Cloudflare 恢复，转发逻辑可参考 git 历史。

---

## 部署步骤

### 1. 登录 Netlify

https://app.netlify.com

点 **Sign up** → 选 **GitHub** → 授权。

- **不需要邮箱验证码**（这正是选它的原因）
- **不需要绑卡**
- 若询问团队名 / 用途，随便填

### 2. 导入仓库

- **Add new site** → **Import an existing project**
- 选 **GitHub** → 授权 → 选 `001-coco/survey-platform`

### 3. 确认配置

Netlify 会读取仓库里的 `netlify.toml`，自动填好：

| 字段 | 值 |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |

**不要加任何环境变量**，点 **Deploy site**，等 1~2 分钟。

### 4. 拿到链接

```
https://随机名字.netlify.app
```

想改名字：**Site configuration → Change site name**。

打开后用 `admin / admin123` 登录。

---

## 如果接口报错

说明转发层里写死的 Vercel 地址不对（默认 `https://survey-platform.vercel.app`）。

1. Vercel 项目 → **Settings** → **Domains**，复制真实域名
2. Netlify → **Site configuration → Environment variables** → 添加：

   | Name | Value |
   |---|---|
   | `BACKEND_ORIGIN` | `https://你的真实域名.vercel.app` |

3. **Deploys** → 最新一条 → **Trigger deploy** → **Deploy site**

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
| 打开白屏 | 发布目录填错 | 确认 Publish directory 是 `dist` |
| 登录提示「网络异常」 | 转发地址不对 | 见「如果接口报错」 |
| 接口 502 | Netlify 连不上 Vercel | Vercel 项目被删或域名变了 |
| 改了代码没生效 | 没推送或没重新部署 | `git push` 后 Netlify 会自动重建 |
| 数据没了 | Serverless 无持久磁盘 | 见「关于数据」 |
| `*.vercel.app` 打不开 | DNS 劫持 | 正常现象，通过 netlify.app 入口访问 |
| `dash.cloudflare.com` 打不开 | 访问不稳定 | 本项目已不依赖 Cloudflare |

---

## 本地开发（不受影响）

双击项目根目录的 `start.bat`：后端 3000（`server/index.js` 常驻）、前端 5173，Vite 把 `/api` 代理到 3000。

`netlify/` 目录只在 Netlify 上生效，本地开发不会用到。
