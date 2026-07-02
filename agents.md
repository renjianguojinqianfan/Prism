# AGENTS.md - 棱镜 (Prism)

> 本文件为 AI 编程助手的核心指令集，优先级高于所有口头约定。

## 1. 项目快照

- **项目名称**：棱镜 (Prism)
- **一句话描述**：多 AI 讨论台。用户提问后，用户自填的多个 AI 模型依次参与讨论，每条发言由发言者自己的 LLM 做共识/分歧自评（实时流式）。
- **项目类型**：`web`（前后端分离 SPA + 轻量 FastAPI 后端）
- **技术栈**：
  - 前端：React 18 + TypeScript（strict）+ Vite + Tailwind CSS；状态管理用 Context + useReducer；Markdown 渲染用 marked
  - 后端：FastAPI（`backend/` 分层包）+ httpx，提供 `GET /api/health` 健康检查、`POST /api/analyze`（Jaccard 同步回退）与 `POST /api/analyze/stream`（发言者自评 SSE 流式）三个端点
  - 部署：Vercel / Render（前端 dist 静态托管，后端 uvicorn）
  - 模型调用：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过
  - 分析 Key 管理：发言者自评所需的 endpoint 与 API Key 通过后端环境变量 `PRISM_ANALYZER_API_KEYS`（JSON 字符串，结构 `{"model":{"endpoint":url,"key":apiKey}}`，按 model 名匹配）统一管理，前端只传 model 名，不传 endpoint 也不传 Key（C1 修复，避免 SSRF 与 Key 泄漏）
- **目录约定**：
  - `frontend/` — React+TS 前端主版本（日常开发目录）
  - 根目录 `index.html` — 早期单 HTML 原型，保留对照，不再演进
  - `backend/` — FastAPI 后端（分层：`app/main` + `app/services` + `app/api` + `tests`）
  - `.trae/specs/` — Spec 驱动开发的规格文档

## 2. 关键规则

### 必须遵守
- **改代码前先说明计划**：不得直接改代码，必须先向用户确认方案
- **一个对话 = 一个任务**：不混杂多个不相关的改动
- **TypeScript 严格模式**：`frontend/tsconfig.json` 开启 `strict`、`noUnusedLocals`、`noUnusedParameters`，新增代码必须通过 `npm run typecheck`
- **UI 风格锁定**：深色赛博朋克主题（`App.css` 中的 CSS 变量 `--bg/--fg/--accent` 等），全局动效（背景光、浮动光点、发言脉冲、消息入场、打字光标）不得擅自移除或改色
- **无第三方状态库**：状态统一在 `DiscussionContext.tsx` 中用 `useReducer`+`useRef` 管理，不要引入 Redux/Zustand/Jotai 等
- **组件拆分原则**：按现有目录约定放置，新增组件放 `frontend/src/components/`，纯逻辑放 `services/` 或 `utils/`，类型集中在 `store/types.ts`
- **禁止硬编码密钥**：发言用 API Key 通过用户输入 + localStorage 持久化；发言者自评用 endpoint 与 API Key 通过后端环境变量 `PRISM_ANALYZER_API_KEYS`（JSON 字符串，结构 `{"model":{"endpoint":url,"key":apiKey}}`，按 model 名匹配）统一读取，前端只传 model 名，不传 endpoint 也不传 Key（C1 修复，避免 SSRF 与 Key 泄漏）；后端端口等配置通过环境变量读取
- **后端/前端阈值同步**：Jaccard 回退路径的阈值（当前 HIGH=0.14, LOW=0.11）前后端必须保持一致，改一处必须改另一处（见 `frontend/src/services/analyzer.ts` 与 `backend/app/config.py`）。注意：主路径为「发言者自评 LLM」，Jaccard 仅在自评失败时回退

### 禁止事项
- 禁止擅自更改深色赛博朋克 UI 风格
- 禁止在代码中硬编码 API Key
- 禁止提交未经用户确认的代码
- 禁止删除根目录 `index.html`（早期原型，保留用于对照）
- 禁止在前端引入除 marked 之外的大型依赖（如 UI 组件库、图表库）除非用户明确要求

## 3. 文件清单

### 前端（frontend/）

| 文件 | 用途 |
|------|------|
| `package.json` | 依赖与 scripts（dev/build/preview/typecheck） |
| `tsconfig.json` / `tsconfig.node.json` | TS 严格模式配置 |
| `vite.config.ts` | Vite 配置（默认端口 5173） |
| `tailwind.config.js` / `postcss.config.js` | Tailwind 配置 |
| `.env.example` | 前端环境变量示例（`VITE_ANALYZE_ENDPOINT` / `VITE_ANALYZE_FALLBACK_ENDPOINT`） |
| `src/main.tsx` | React 挂载入口 |
| `src/App.tsx` | 顶层布局（Provider + 浮动光点 + 面板） |
| `src/App.css` | 全局深色主题、动效、气泡/标签样式 |
| `src/store/types.ts` | 全部 TS 类型定义（Message / ModelConfig / Tag 等） |
| `src/store/DiscussionContext.tsx` | 状态 reducer + 讨论循环编排（start/pause/reset/export） |
| `src/config/presetModels.ts` | 5 个快速添加模板（DeepSeek/Kimi/GLM/通义/Mimo）与 localStorage key |
| `src/services/api.ts` | `buildAPIHistory` 历史拼接 + `streamChat` SSE 解析 |
| `src/services/simulator.ts` | 模拟模式模板回复生成（按轮次确定性取模板） |
| `src/services/analyzer.ts` | 本地 Jaccard 启发式分析 + 后端 `fetchAnalysis` 调用 + SSE `streamAnalysis` 解析 |
| `src/utils/escape.ts` | HTML 转义 |
| `src/utils/markdown.ts` | marked 封装（失败回退到 escape） |
| `src/utils/sleep.ts` | 延时工具 + `genId` |
| `src/components/Header.tsx` | 顶栏（Prism 标题 / 导出 / 配置模型） |
| `src/components/RoleBar.tsx` | 角色状态条（发言脉冲动画） |
| `src/components/ModelSelector.tsx` | 输入框上方模型复选框 |
| `src/components/MessageList.tsx` | 消息列表 + 欢迎页推荐话题 |
| `src/components/MessageBubble.tsx` | 消息气泡（标签 + Markdown + 打字光标） |
| `src/components/InputBar.tsx` | 输入框 + 控制条（发起/插话/暂停/跳过/重置/轮次/模拟开关） |
| `src/components/SettingsPanel.tsx` | 模型配置侧边面板（快速添加模板 + 自定义模型增删） |
| `src/components/Toast.tsx` | 操作提示 |

### 后端（backend/）与根目录

| 文件 | 用途 |
|------|------|
| `backend/main.py` | uvicorn 入口（`uvicorn main:app`，仅启动） |
| `backend/app/main.py` | FastAPI app 实例 + CORS + 路由注册 |
| `backend/app/config.py` | 配置：CORS 来源 / 阈值 / `load_analyzer_keys()` |
| `backend/app/schemas.py` | Pydantic 模型（Message / Tag / AnalyzeRequest 等） |
| `backend/app/services/heuristic.py` | Jaccard 启发式分析（`analyze()`） |
| `backend/app/services/analyzer.py` | 流式自评（prompt 构造 / 解析 / `stream_self_eval()`） |
| `backend/app/api/deps.py` | 依赖注入：`get_llm_client()`（可测试替换） |
| `backend/app/api/health.py` | `GET /api/health` |
| `backend/app/api/analyze.py` | `POST /api/analyze` + `POST /api/analyze/stream` |
| `backend/requirements.txt` | 运行时依赖（fastapi、uvicorn、pydantic、httpx） |
| `backend/requirements-dev.txt` | 开发依赖（pytest、pytest-asyncio） |
| `backend/pytest.ini` | pytest 配置 |
| `backend/.env.example` | 后端环境变量示例 |
| `backend/tests/` | pytest 测试（conftest + test_heuristic + test_api） |
| `index.html` | 早期单 HTML 原型（保留对照，不再演进） |
| `.gitignore` | Git 忽略规则 |
| `.trae/specs/` | Spec 驱动开发的规格文档（spec.md / tasks.md / checklist.md） |

## 4. 开发工作流

1. **启动前端**：`cd frontend && npm install && npm run dev` → [http://localhost:5173](http://localhost:5173)
2. **启动后端**（可选，共识/分歧真实分析）：`cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
3. **后端测试**：`cd backend && pip install -r requirements-dev.txt && pytest`
4. **类型检查**：`cd frontend && npm run typecheck`（提交前必须通过）
5. **构建验证**：`cd frontend && npm run build`（tsc + vite 打包，产物在 `frontend/dist/`）

## 5. Git 提交规范

- commit message 格式：`<type>: <描述>`
- type 可选：`feat` / `fix` / `style` / `refactor` / `docs` / `chore`
- 描述用中文，一句话说清改动
- 示例：`feat: 迁移至 React+TypeScript`
- **禁止提交未经用户确认的代码**
