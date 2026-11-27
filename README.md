# 问卷搭建与数据回收平台

**零 UI 库问卷平台**：手写 CSS 组件 / 请求内核 / SVG 图表，用 Vue 3 实现「搭建 → 发布 → 填写 → 回收 → 统计」闭环。

- 不用 Element Plus —— 23 个组件用原生 `h()` + 手写 CSS 实现（`src/ui/`）
- 不用 axios —— 手写请求内核，含 Promise 静态方法、并发池、重试、双 token 无感刷新（`src/api/request.js`）
- 不用 ECharts —— 手写 SVG 折线图 / 柱状图（`src/components/MiniChart.vue`）
- 不用 `JSON.parse(JSON.stringify())` —— 手写 `deepClone`（WeakMap 处理循环引用）
- 不用 lodash —— 手写 `debounce` / `throttle`

---

## 运行

```bash
npm install

# 前端 + 后端一起跑
npm run dev:all

# 只跑前端
npm run dev

# 只跑 Express 验证服务（3000）
npm run server

# 跑手写模块的用例
npm run test:core
```

线上演示：<https://survey-platform-coco.netlify.app/#/surveys>
默认账号：`admin / admin123`

---

## 手写清单

| 以前由谁提供 | 现在 | 位置 |
|---|---|---|
| Element Plus 23 个组件 | 原生 render 函数 + 手写 CSS | `src/ui/index.js`、`src/ui/ui.css` |
| axios 拦截器 | `fetch` + 手写请求内核 | `src/api/request.js` |
| axios 重试 / p-limit | 指数退避重试 + 并发池 | `src/core/index.js` |
| JSON 深拷贝 | `deepClone`（循环引用 / Date / Map / Set / 原型） | `src/core/index.js` |
| lodash debounce | 闭包防抖（含 `cancel` / `flush`） | `src/core/index.js` |
| mitt / 全局 store | 手写 EventBus + 闭包私有计数器 | `src/core/index.js` |
| ECharts | 手写 SVG 图表，无实例、无 `dispose` | `src/components/MiniChart.vue` |
| — | 多标签页草稿同步（BroadcastChannel） | `src/views/fill/index.vue` |
| — | 白屏看门狗 + 错误边界 + 错误收口 | `index.html`、`src/App.vue`、`src/core/index.js` |

---

## 目录

```
src/
  ui/                     手写 UI 组件层（替换 Element Plus）
    index.js              23 个组件的 render 函数实现
    ui.css                手写设计系统：变量 / 按钮 / 表格 / 弹窗 / 加载态 / 响应式
  core/index.js           手写基础设施：deepClone / debounce / Promise 静态方法 /
                          并发池 / 重试 / EventBus / 私有计数器 / 错误收口
  api/request.js          手写请求内核：401 单例刷新 + 重放 + 重试 + 并发池
  components/
    SchemaRenderer.vue    Schema 驱动渲染（动态组件注册表）
    MiniChart.vue         手写 SVG 折线图 / 柱状图
  views/
    editor/               三栏编辑器：物料 / 画布 / 属性
                          快照撤销（手写 deepClone）+ 原生 drag 排序
    survey/               列表（防抖搜索 + 参数级缓存）与统计（SVG 图表）
    fill/                 填写页：草稿保存 + BroadcastChannel 多标签页同步
  styles/index.css        页面级布局样式
server/                   Express 后端（12 个接口）
netlify/functions/api.js  Serverless 部署适配（Hono）
scripts/test-core.js      14 个用例，零测试框架
```

---

> **问卷搭建与数据回收平台**　个人项目 · Vue 3 + 原生 JS/CSS · Node.js/Express　
> 零 UI 库实现「搭建 → 发布 → 填写 → 回收 → 统计」闭环；23 个界面组件、请求层与图表全部手写。
> - **手写 UI 与样式**：用原生 render 函数实现按钮/表格/表单/弹窗等 23 个组件，配套手写响应式 CSS 与深色模式，不依赖任何 UI 库。
> - **请求内核**：基于 `fetch` 手写请求层，实现双 token 单例刷新与并发 401 重放（5 个并发 401 只刷新 1 次）、指数退避重试与 4 并发上限；手写 `Promise.all/allSettled/race/any` 与原生逐项对拍。
> - **编辑器**：用 `WeakMap + deepClone` 实现 50 步快照撤销，解决循环引用与分支快照问题；连续输入按「首击记录 + 尾部防抖复位」合并为一步，避免每敲一个字产生一条历史。
> - **性能与稳定性**：手写防抖搜索（300ms）+ 30s 参数级缓存；SVG 图表替代 ECharts，消除实例泄漏；`index.html` 内联关键 CSS + 3s 看门狗 + 组件级错误边界，故障下不白屏；BroadcastChannel 同步多标签页草稿。

---
简化：

- 后端仍是 Express + Netlify Function（Hono）两套入口，业务规则有重复；这是为了兼容 Serverless 部署
- Netlify Function 使用内存存储，实例回收后数据重置
- 白名单外的跨域场景依赖浏览器控制台报错，JS 只能看到 `TypeError`
- `v-permission` 只是前端展示层控制，真正的鉴权在后端 `creatorId` 归属校验
