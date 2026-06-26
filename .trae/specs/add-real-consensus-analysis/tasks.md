# Tasks

> 标记说明：`[x]` 已完成 / `[ ]` 待办；`(P1)` 为高优先级规划项

## 阶段一：真实共识/分歧分析（已完成）

- [x] Task 1：搭建 FastAPI 后端骨架
  - [x] SubTask 1.1：创建 `requirements.txt`（fastapi、uvicorn、pydantic）
  - [x] SubTask 1.2：创建 `main.py`，定义 `app`、CORS 中间件、`GET /api/health`
  - [x] SubTask 1.3：创建 `.env.example`，列出占位变量（不含真实 Key）

- [x] Task 2：实现共识/分歧分析算法（后端）
  - [x] SubTask 2.1：定义 Pydantic 模型 `AnalyzeRequest`、`AnalyzeResponse`、`Tag`
  - [x] SubTask 2.2：实现启发式分析函数 `analyze(messages, topic)`（Jaccard 2-gram + 阈值 0.14/0.11）
  - [x] SubTask 2.3：暴露 `POST /api/analyze` 端点，处理空数组、单条消息等边界

- [x] Task 3：前端对接真实分析
  - [x] SubTask 3.1：新增 `analyzeMessages()`：讨论结束时根据模拟模式决定调用后端或本地启发式
  - [x] SubTask 3.2：实现 `localHeuristicAnalyze` 作为回退（与后端算法对齐）
  - [x] SubTask 3.3：替换 Mock 标签块，改为遍历 `analyzeMessages()` 结果统一写标签
  - [x] SubTask 3.4：移除"第一条强制 consensus"的 Mock

- [x] Task 4：新增中性标签样式
  - [x] SubTask 4.1：新增 `.msg-tag.neutral` 样式
  - [x] SubTask 4.2：标签文案统一：consensus → 「共识 💡」、divergence → 「分歧 ⚡」、neutral → 「中立 ·」

- [x] Task 5：文档与可运行性
  - [x] SubTask 5.1：更新 `readme.md` 功能列表与后端启动小节
  - [x] SubTask 5.2：说明前端如何指向后端（`VITE_ANALYZE_ENDPOINT`）

## 阶段二：React + TypeScript 迁移（已完成）

- [x] Task 6：搭建 Vite + React + TS 工程
  - [x] SubTask 6.1：初始化 `frontend/`（Vite react-ts 模板），配置 `tsconfig.json` strict + noUnusedLocals/Parameters
  - [x] SubTask 6.2：接入 Tailwind CSS（`tailwind.config.js` + `postcss.config.js`）
  - [x] SubTask 6.3：迁移 `App.css` 深色赛博朋克主题与动效（背景光、浮动光点、发言脉冲、打字光标）

- [x] Task 7：状态管理迁移
  - [x] SubTask 7.1：在 `store/types.ts` 集中定义 Message/ModelConfig/AnalysisTag/ToastItem 等类型
  - [x] SubTask 7.2：在 `DiscussionContext.tsx` 用 useReducer + useRef 实现 reducer 与讨论循环编排
  - [x] SubTask 7.3：纯 dispatch 回调用 useCallback 包裹，依赖 state 的函数移入 useMemo 内部

- [x] Task 8：服务层迁移
  - [x] SubTask 8.1：`services/api.ts` 迁移 `buildAPIHistory` + `streamChat`（SSE 解析 + response.body 非空检查）
  - [x] SubTask 8.2：`services/simulator.ts` 迁移 `generateSimReply`，增加 prevAi 引用实现多轮连贯
  - [x] SubTask 8.3：`services/analyzer.ts` 迁移 `localHeuristicAnalyze` + `fetchAnalysis`，与后端停用词/分词统一

- [x] Task 9：组件层迁移
  - [x] SubTask 9.1：`Header` / `RoleBar` / `ModelSelector` / `MessageList` / `MessageBubble` / `InputBar` / `SettingsPanel` / `Toast` 八个组件
  - [x] SubTask 9.2：`ModelSelector` 改为复选框 UI，默认全选
  - [x] SubTask 9.3：`MessageBubble` 接入 marked 渲染 + 标签 + 打字光标

- [x] Task 10：Markdown 渲染与安全加固
  - [x] SubTask 10.1：`utils/markdown.ts` 封装 marked，`walkTokens` 转义 HTML token 防 XSS
  - [x] SubTask 10.2：`main.py` CORS 收紧为 `PRISM_CORS_ORIGINS` 环境变量白名单
  - [x] SubTask 10.3：`DiscussionContext.tsx` setTimeout 定时器追踪与卸载清理
  - [x] SubTask 10.4：`config/presetModels.ts` localStorage 键迁移 `aiRoundtable_models` → `prism_models`
  - [x] SubTask 10.5：`services/api.ts` 添加 `response.body` 非空防御检查

- [x] Task 11：迁移后验证
  - [x] SubTask 11.1：`npm run typecheck` 通过
  - [x] SubTask 11.2：`npm run build` 通过
  - [x] SubTask 11.3：Playwright 浏览器冒烟测试（模拟模式发起讨论、标签渲染、暂停/跳过）

## 阶段三：观点图谱可视化（P1 规划，待办）

- [ ] (P1) Task 12：引入 D3 依赖与图谱组件骨架
  - [ ] SubTask 12.1：`npm install d3 @types/d3`（已获用户授权豁免 AGENTS.md 图表库禁令）
  - [ ] SubTask 12.2：新建 `components/OpinionGraph.tsx`，定义 props（messages + tags）
  - [ ] SubTask 12.3：在 `MessageList` 上方或侧边预留图谱挂载点，讨论结束后显示

- [ ] (P1) Task 13：实现力导向图渲染
  - [ ] SubTask 13.1：节点 = 每条 AI 发言，颜色按 label（consensus 绿/divergence 橙/neutral 灰）
  - [ ] SubTask 13.2：边 = 两两 Jaccard 相似度，边宽与透明度映射 score
  - [ ] SubTask 13.3：`simulation` 力导向布局（charge / link / center），支持拖拽节点
  - [ ] SubTask 13.4：hover 节点高亮邻接节点与边

- [ ] (P1) Task 14：图谱与消息列表联动
  - [ ] SubTask 14.1：点击图谱节点 → 消息列表滚动到对应气泡并高亮
  - [ ] SubTask 14.2：点击关闭按钮或发起新讨论时收起图谱
  - [ ] SubTask 14.3：响应式适配（窄屏折叠为可展开抽屉）

- [ ] (P1) Task 15：图谱验收
  - [ ] SubTask 15.1：`npm run typecheck` + `npm run build` 通过
  - [ ] SubTask 15.2：模拟模式讨论结束后图谱正确渲染，节点颜色与标签一致
  - [ ] SubTask 15.3：节点点击联动滚动生效
  - [ ] SubTask 15.4：同步更新 `readme.md` 功能列表与 `agents.md` 文件清单

# Task Dependencies
- 阶段二 Task 6-11 依赖阶段一 Task 1-5（分析能力先行）
- 阶段三 Task 13 依赖 Task 12（D3 与骨架先行）
- 阶段三 Task 14 依赖 Task 13（渲染先行才能联动）
- 阶段三 Task 15 依赖 Task 12-14 全部完成
