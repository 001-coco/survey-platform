# 上线部署手册

目标：得到一个能发给别人打开的网址。全程在网页上点，不用敲代码命令。

分工：
- **后端**（接口）→ Render，免费，已由 `render.yaml` 配好
- **前端**（网页）→ Vercel，免费，已由 `vercel.json` 配好

两边的配置都在仓库里了，你只需要在各平台**点几下授权**。

---

## 第 0 步：把代码传到 GitHub（只需一次）

在项目目录 `C:\Users\Yolo\Desktop\work\survey-platform` 打开终端，执行：

```bash
git init
git add .
git commit -m "ready to deploy"
```

然后去 https://github.com/new 新建一个仓库（名字随意，比如 `survey-platform`，**不要**勾选添加 README），把页面上的命令复制过来执行，长得像这样：

```bash
git remote add origin https://github.com/你的用户名/survey-platform.git
git branch -M main
git push -u origin main
```

浏览器会让你登录 GitHub，登录一次即可。

> `.gitignore` 已配好，`node_modules`、`dist`、`server/db.json` 不会被传上去。

---

## 第 1 步：部署后端（Render）

1. 打开 https://render.com ，用 **GitHub 账号**登录（这一步就是授权，只有你能做）
2. 点右上角 **New** → 选 **Blueprint**
3. 选中你刚创建的仓库 → 点 **Apply / Deploy**
4. 等 2~3 分钟，状态变成 **Live** 就成功了

不用填任何参数，`render.yaml` 里已经写好了：启动命令、Node 版本、数据文件位置、跨域白名单。

**部署完成后，页面上会显示一个地址**，形如：

```
https://survey-api.onrender.com
```

👉 **把这个地址记下来，下一步要用。** 如果 `survey-api` 这个名字被别人占了，Render 会让你改名，那就用你实际得到的地址。

**自测后端通不通**：浏览器打开 `https://你的地址/api/public/surveys/test`

- 返回 `{"code":404,"message":"问卷不存在或未发布"}` → ✅ 正常
- 打不开或 502 → 等一会儿再试，免费实例冷启动要 50 秒左右

---

## 第 2 步：部署前端（Vercel）

1. 打开 https://vercel.com ，用 **GitHub 账号**登录
2. 点 **Add New** → **Project** → 找到你的仓库 → 点 **Import**
3. 展开 **Environment Variables**，添加一条：

   | Name | Value |
   |---|---|
   | `VITE_API_BASE` | `https://survey-api.onrender.com/api` |

   ⚠️ 把域名换成你第 1 步实际得到的地址，**末尾一定要带 `/api`**

4. 点 **Deploy**，等 1 分钟

Vercel 会给你一个 `https://xxx.vercel.app` 的网址，打开它，用 `admin / admin123` 登录 —— 上线完成。

> 环境变量是**构建时**打进代码里的，以后改了它必须点一次 Redeploy 才生效。

---

## 换 Cloudflare Pages 也行

不想用 Vercel 就换 Cloudflare Pages，效果一样：

1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
2. 选仓库，构建设置填：
   - Framework preset：`Vue`
   - Build command：`npm run build`
   - Build output directory：`dist`
3. 环境变量加 `VITE_API_BASE`，同上
4. Save and Deploy

`render.yaml` 里的跨域白名单已经含 `*.pages.dev`，不用回去改后端。

---

## 部署后数据会丢，这是正常的

后端用的是 JSON 文件存数据，Render 免费实例的文件系统是**临时**的（写在 `/tmp`）：

- 服务重启 / 重新部署 → 数据库被重置，只剩默认账号 `admin / admin123`
- 免费实例闲置 15 分钟会休眠，下次访问要等 50 秒左右才响应

**要长期保存数据**，得换成托管数据库（比如 Render 自带的 Postgres，或 Supabase 免费版），改 `server/index.js` 里的 `readDB` / `writeDB` 两个函数即可。

如果只是**演示 / 面试展示**，现在的方案够用，提前跟面试官说一句「用的是临时存储」反而显得你知道取舍。

---

## 出问题了看这里

| 现象 | 原因 | 解决 |
|---|---|---|
| 登录一直转圈 / 失败 | 前端 `VITE_API_BASE` 没配或漏了 `/api` | 回 Vercel 检查环境变量，改完 Redeploy |
| 控制台报 403 + 「跨域来源不被允许」 | 前端域名不在后端白名单 | Render → Environment → 改 `ALLOWED_ORIGINS`，加上你的前端域名（逗号分隔），保存后会自动重启 |
| 后端第一次访问特别慢 | 免费实例休眠中 | 等 50 秒，属正常现象 |
| 重启后数据全没了 | 临时文件系统 | 见上一节，演示用可忽略 |
| 后端报 `Cannot find module 'express'` | 依赖被当成开发依赖没装上 | 已在 `package.json` 修好，确认推上去的是最新代码 |
