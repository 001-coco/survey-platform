# 上线部署

## 架构（为什么这么绕）

```
浏览器  →  https://xxx.pages.dev        页面（Cloudflare Pages，国内可访问）
        →  https://xxx.pages.dev/api/*  Cloudflare Function 转发
                                        ↓ （服务器到服务器，不走国内 DNS）
                     https://xxx.vercel.app/api/*   真正的接口（Vercel）
```

原因：`*.vercel.app` 在国内被 DNS 污染，浏览器打不开；`*.pages.dev` 可以正常访问。

所以页面放 Cloudflare，接口请求由 Cloudflare 边缘节点转发给 Vercel。**浏览器只和 pages.dev 打交道**，前端仍然是同域 `/api`，不存在跨域。

转发实现在 `functions/api/[[path]].js`，只负责搬运请求，不改业务。

---

## 现状

| 部分 | 状态 |
|---|---|
| 后端接口 | ✅ 已部署在 Vercel（`survey-platform.vercel.app`） |
| 前端页面 | 待部署到 Cloudflare Pages（就是下面这几步） |

---

## 第 1 步：注册 Cloudflare

https://dash.cloudflare.com/sign-up

- 用邮箱 + 密码注册即可（也可以选 GitHub 登录）
- **不需要绑卡**
- 注册后要收一封验证邮件，点邮件里的链接

---

## 第 2 步：创建 Pages 项目

登录后进入控制台：

1. 左侧菜单点 **Workers & Pages**
2. 点 **Create**（或 **Create application**）
3. 切到 **Pages** 标签 → 点 **Connect to Git**
4. 授权 GitHub → 选仓库 `001-coco/survey-platform` → **Begin setup**

---

## 第 3 步：构建配置

| 字段 | 填什么 |
|---|---|
| Project name | `survey-platform`（决定网址前缀） |
| Production branch | `main` |
| Framework preset | **Vue** |
| Build command | `npm run build` |
| Build output directory | `dist` |

选 `Vue` 后构建命令和输出目录会自动填好，核对一下即可。

**环境变量：不用加任何一条。**

点 **Save and Deploy**，等 1~2 分钟。

---

## 第 4 步：拿到链接

部署完成后会显示：

```
https://survey-platform.pages.dev
```

（名字被占用的话会带随机后缀）

打开它，用 `admin / admin123` 登录。

**这个链接国内可以直接打开，发给别人也能打开。**

---

## 如果接口报错

说明 `functions/api/[[path]].js` 里写死的后端地址不对。去核对：

1. 打开 Vercel 项目 → **Settings** → **Domains**，复制真实域名
2. Cloudflare Pages 项目 → **Settings** → **Environment variables** → 添加：

   | Name | Value |
   |---|---|
   | `BACKEND_ORIGIN` | `https://你的真实域名.vercel.app` |

3. 回到 **Deployments** → 最新那条 → 右侧 `...` → **Retry deployment**

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
| pages.dev 打开白屏 | 构建产物目录填错 | 确认 Build output directory 是 `dist` |
| 登录提示「网络异常」 | 转发地址不对 | 见上面「如果接口报错」 |
| 接口返回 502 | Cloudflare 连不上 Vercel | Vercel 项目被删除或域名变了，核对 `BACKEND_ORIGIN` |
| 改了代码没生效 | 没推送或没重新部署 | `git push` 后 Cloudflare 会自动重新构建 |
| 数据没了 | Serverless 无持久磁盘 | 见「关于数据」 |

---

## 本地开发（不受影响）

双击项目根目录的 `start.bat`：后端 3000（`server/index.js` 常驻）、前端 5173，Vite 把 `/api` 代理到 3000。

`functions/` 目录只在 Cloudflare 上生效，本地开发不会用到。
