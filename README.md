# survey-platform · 问卷搭建与数据回收平台

Vue3 + JavaScript(ES6+) + Vite + Pinia + Element Plus + ECharts，后端 Express + JSON 文件存储。

## 启动

**最快方式：双击项目根目录的 `start.bat`**，它会自动装依赖、起后端(3000)、起前端(5173) 并打开浏览器。
关闭时把弹出的两个黑窗口关掉即可。

手动启动方式：

```bash
npm install

# 终端 1：后端（3000 端口）
npm run server

# 终端 2：前端（5173 端口）
npm run dev
```

浏览器打开 http://localhost:5173 ，默认账号 `admin / admin123`。

> 后端会把数据写到 `server/db.json`，删掉这个文件即可重置数据。

## 上线

线上地址：**https://survey-platform-coco.netlify.app**（账号 `admin / admin123`）

整个项目部署在 **Netlify** 一个平台上：静态页面 + `/api/*` 函数，同域，不涉及跨域，不绑卡。

- 云端后端用 **Hono**（Serverless 里跑不了 Express 的 `app.listen`），本地仍是 Express，两边业务规则一致
- 改完代码双击 **`deploy.bat`** 重新部署（本项目没接 Git 自动部署，`git push` 不会触发）
- 详情见 **[DEPLOY.md](./DEPLOY.md)**

## 完整闭环

1. 登录 → 新建问卷 → 编辑器拖入题型 → 保存 → 发布
2. 列表页「复制链接」得到 `#/fill/{id}` → 在填写端作答并提交
3. 回到列表页点「数据」看回收趋势与选项占比

## 目录

```
server/app.js                   Express 应用本体（登录 / CRUD / 发布 / 提交 / 统计）
server/index.js                 本地启动入口（只负责 app.listen）
netlify/functions/api.js        云端后端（Hono，同一套业务规则，跑在 Netlify 函数里）
src/
  api/request.js                Axios 封装（统一错误处理 + 取消重复请求 + 401 跳转）
  api/survey.js                 接口定义
  store/user.js                 Pinia 用户态
  directives/permission.js      按钮级权限指令 v-permission
  components/
    SchemaRenderer.vue          ★ Schema 驱动渲染引擎（动态组件 + 条件题过滤）
    widgets/*.vue               4 种题型的控件
  utils/validate.js             校验 + 条件显示求值
  views/
    editor/
      widgets.js                ★ 题目 Schema 协议与物料定义
      useHistory.js             ★ 撤销 / 重做（快照历史栈）
      MaterialPanel.vue         物料区（HTML5 原生拖拽，未用第三方库）
      CanvasArea.vue            画布（拖拽排序 / 选中 / 上下移动 / 复制 / 删除）
      PropPanel.vue             属性面板（含显示逻辑配置）
      EditorView.vue            编辑器主页
    fill/index.vue              填写端（草稿自动保存 + 防重复提交）
    survey/ListView.vue         问卷管理（分页 / 搜索 / 筛选 / 发布 / 删除）
    survey/StatsView.vue        数据回收（ECharts）
```

## 三个核心模块（面试重点）

| 模块 | 位置 | 可以讲的点 |
|---|---|---|
| Schema 渲染引擎 | `SchemaRenderer.vue` | 动态组件 `<component :is>`；新增题型只改 `widgetMap`，引擎不动 |
| 撤销 / 重做 | `useHistory.js` | 快照 vs 命令模式的取舍；`shallowRef` 避免历史栈被深度代理 |
| 条件显示（逻辑引擎） | `utils/validate.js` | 只允许依赖前面的题 → 依赖图天然无环；放开限制则需 DAG 环检测 |

## 后端相关

- 手写极简 JWT（`crypto` HMAC 签名，无第三方依赖）
- 双 token：accessToken 2 分钟（`ACCESS_TTL`）、refreshToken 24h；`POST /api/auth/refresh` 换取新 accessToken
- 每个查询都带 `creatorId` 条件做数据归属校验 —— 前端隐藏按钮不算权限控制
- 提交答卷时后端二次校验必填项，前端校验只是体验

## 无感刷新（怎么演示、怎么讲）

前端 `src/api/request.js`：

- 响应拦截到 401 时先调刷新接口，成功后用原 `config` 重放一次，并打 `config._retry` 标记防止死循环
- `refreshPromise` 是模块级单例：并发的多个 401 共用同一次刷新，其余请求 `await` 同一个 promise，等价于「挂起 → 刷新成功 → 一起重放」；`.finally` 里必须复位，否则后续永远拿到旧 promise
- 刷新请求走裸 `axios`，不经过拦截器，否则刷新失败又会触发刷新，形成递归
- 刷新失败 → 清 token + 跳登录；`refreshToken` 即使泄漏也不能直接调接口，后端 `authMiddleware` 校验 `typ === 'access'`

**演示方法**：登录后等 2 分钟（`ACCESS_TTL`）再点任意操作，Network 面板会看到一次 `/api/auth/refresh` 紧接着一次原请求重放，页面无感知。

## 简历可写的版本（4 句，每句都能展开 2 分钟）

> 设计题目 JSON Schema 协议（type / props / condition），用 `<component :is>` 动态组件渲染 4 种题型并支持题目条件显示；新增题型只需在组件表注册，渲染引擎不改。
>
> 用 HTML5 原生 drag 事件实现题目拖拽排序（未用第三方库），通过 `dataTransfer` 区分「新增」与「移动」，并处理了 `splice` 删除后下标左移导致的插入偏移问题。
>
> 基于历史栈 + JSON 快照实现撤销 / 重做，历史栈用 `shallowRef` 避免深度代理，并用栈深度上限控制内存占用；权衡后选快照而非命令模式，题目规模大时应改命令模式记录 inverse 操作。
>
> 封装 Axios 请求层（AbortController 取消重复请求、统一错误处理、401 统一跳转）；JWT + 路由守卫 + 自定义指令实现按钮级权限，后端每个查询带 `creatorId` 做数据归属校验。

**刻意没写的**：ECharts（只是简单柱/折线图，不值一个关键词）、环检测（没做，改用「单向依赖」规避）。

## 关键词自测表（每个问自己：能不看稿讲 2 分钟吗）

| 关键词 | 2 分钟讲稿要覆盖 |
|---|---|
| JSON Schema 协议 | 为什么用 type 字段驱动；新增题型要改哪几个文件；为什么没拆 questions 表 |
| 动态组件 | `<component :is>` 原理；widgetMap 注册表；和 v-if 分支的方案对比 |
| 条件显示 | 为什么限制只能依赖前面的题；放开限制需要补什么（DAG + 三色标记环检测） |
| HTML5 拖拽 | dragstart/dragover/drop 三件事；为什么 dragover 必须 preventDefault；下标左移的坑 |
| 快照撤销重做 | 快照 vs 命令模式的取舍；为什么用 shallowRef；栈深度上限取多少、为什么 |
| Axios 取消重复请求 | AbortController 怎么用；key 怎么拼；为什么取消的请求不弹提示 |
| 数据归属校验 | 前端隐藏按钮为什么不算权限控制；后端具体在哪几行加 creatorId |

讲不了的直接删，不要留。

## 未实现（面试主动说明即可）

- 题目跨层级的容器嵌套
- CSV 导出、批量操作、图片上传题
- 条件题放开顺序限制后的环检测
- 单元测试（建议后续补 Vitest，覆盖 `useHistory` 与 `validate`）
