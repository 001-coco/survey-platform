# 上线部署（Netlify 单平台）

## 现在的线上地址

```
https://survey-platform-coco.netlify.app
```

账号 `admin` / 密码 `admin123`，国内可直接访问。

## 架构

```
浏览器 → https://xxx.netlify.app           静态页面（dist）
       → https://xxx.netlify.app/api/*     函数（netlify/functions/api.js，Hono 路由）
```

前后端同域，**不存在跨域**，也不需要任何环境变量。

为什么不用 Vercel：`*.vercel.app` 在国内被 DNS 劫持（换 DNS、用加密 DNS 都拿不到真实地址），浏览器打不开。Netlify 的 `*.netlify.app` 可以正常访问。

为什么后端不用 Express：Netlify 函数运行在 Serverless 环境，没有长驻 http 服务器，`app.listen()` 不可用。所以云端用 Hono（同样是路由 + 中间件，基于 Web 标准），本地开发仍用 Express。

两套后端保持同一份业务规则：鉴权方式、校验规则、数据结构、响应格式一致。

## 怎么更新线上

改完代码后，**双击项目根目录的 `deploy.bat`**。

它等价于：

```bash
netlify deploy --build --prod
```

> ⚠️ 注意：本项目**没有接 Netlify 的 Git 自动部署**（连接 GitHub 时网页打不开），所以 `git push` **不会**触发线上更新，必须跑一次 `deploy.bat`。

## 数据说明（重要）

后端跑在 Netlify 函数里，数据存在**函数实例的内存**中：

- 实例被回收（闲置一段时间）后，数据重置为默认账号 `admin / admin123`
- 多人同时访问可能命中不同实例，互相看不到对方的数据

**演示、面试展示够用；要真正收集问卷数据必须换成持久化存储。** 换的时候只改 `netlify/functions/api.js` 里的 `getDB()` 和 `save()` 两个函数，路由和校验都不用动。可选：

- **Netlify Blobs**（Netlify 自带，免费额度，最省事）
- Supabase / Upstash Redis（免费额度够用，不绑卡）

## 换成自己的域名（可选）

现在用的是 Netlify 免费子域名，够用。想换成自己的域名：

1. 买域名（阿里云 / 腾讯云 / Cloudflare，`.com` 约 60~80 元/年，`.top` / `.xyz` 十元左右）
2. Netlify → **Domain management** → **Add a domain you already own**
3. 去域名服务商加一条 CNAME，指向 `survey-platform-coco.netlify.app`
4. 等几分钟，Netlify 自动签发 HTTPS 证书

**不需要备案**：备案针对「域名 + 国内服务器」，你的站点跑在 Netlify（海外），不涉及备案。

觉得现在的名字太长，可以先在 **Site configuration → Change site name** 改成短的，免费且立即生效。

## 本地开发（不受影响）

双击 `start.bat`：后端 3000（`server/index.js` + `server/app.js`，Express）、前端 5173（Vite 代理 `/api` 到 3000）。

本地用的是 `server/app.js`，线上用的是 `netlify/functions/api.js`，两者互不影响。

## 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 改了代码线上没变 | 没跑部署 | 双击 `deploy.bat` |
| 打开白屏 | 构建失败 | 看 `deploy.bat` 窗口里的报错 |
| 登录提示「网络异常」 | 函数报错 | Netlify 项目 → Logs → Functions 看堆栈 |
| 数据突然没了 | 函数实例被回收 | 正常现象，见「数据说明」 |
| 想前后端分开部署 | 需要配 `VITE_API_BASE` 和后端 `ALLOWED_ORIGINS` | 见 `.env.example` |

## 已经试过但不可行的方案（避免重复踩坑）

| 方案 | 结果 |
|---|---|
| Render 免费实例 | 必须绑信用卡，国内卡不通过 |
| Vercel 直接访问 | `*.vercel.app` 国内 DNS 被劫持，打不开 |
| Cloudflare Pages | 控制台访问不稳定，注册邮件收不到 |
| Netlify 代理到 Vercel | 链路复杂，且 Vercel 侧请求体解析异常 |
