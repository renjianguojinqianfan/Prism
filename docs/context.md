# Prism 深层上下文 (Context)

> 本文件为 AGENTS.md 的补充，提供完整的文件清单、目录结构与架构说明。
> AI 在需要查找具体文件或理解架构细节时查阅本文件。

## 1. 完整文件清单

### 1.1 前端（frontend/）

| 文件 | 用途 |
|------|------|
| `package.json` | 依赖与 scripts（dev/build/preview/typecheck/test/test:run） |
| `tsconfig.json` / `tsconfig.node.json` | TS 严格模式配置 |
| `vite.config.ts` | Vite 配置（默认端口 5173） |
| `vitest.config.ts` | Vitest 配置（jsdom + globals + 测试文件 glob） |
| `tailwind.config.js` / `postcss.config.js` | Tailwind 配置 |
| `.env.example` | 前端环境变量示例（`VITE_ANALYZE_ENDPOINT` / `VITE_ANALYZE_FALLBACK_ENDPOINT`） |
| `src/main.tsx` | React 挂载入口 |
| `src/App.tsx` | 顶层布局（Provider + 浮动光点 + 面板） |
| `src/App.css` | 全局深色主题、动效、气泡/标签样式 |
| `src/store/types.ts` | 全部 TS 类型定义（Message / ModelConfig / Tag 等） |
| `src/store/DiscussionContext.tsx` | 状态 reducer + 讨论循环编排（start/pause/reset/export + discussion token 防并发 + streamChat 超时兜底） |
| `src/config/presetModels.ts` | 5 个快速添加模板（DeepSeek/Kimi/GLM/通义/Mimo）与 localStorage key |
| `src/services/api.ts` | `buildAPIHistory` 历史拼接 + `streamChat` SSE 解析 |
| `src/services/simulator.ts` | 模拟模式模板回复生成（按轮次确定性取模板） |
| `src/services/analyzer.ts` | 本地 Jaccard 启发式分析 + 后端 `fetchAnalysis` 调用 + SSE `streamAnalysis` 解析（全程超时保护） |
| `src/utils/escape.ts` | HTML 转义（含 `"` `'` 属性上下文转义） |
| `src/utils/markdown.ts` | marked 封装（href/src 属性转义 + 协议白名单 + 失败回退到 escape） |
| `src/utils/sleep.ts` | 延时工具 + `genId` |
| `src/**/*.test.{ts,tsx}` | Vitest 单元测试（7 个文件：services × 3 / store × 1 / utils × 3，共 82 用例） |
| `src/components/Header.tsx` | 顶栏（Prism 标题 / 导出 / 配置模型） |
| `src/components/RoleBar.tsx` | 角色状态条（发言脉冲动画） |
| `src/components/ModelSelector.tsx` | 输入框上方模型复选框 |
| `src/components/MessageList.tsx` | 消息列表 + 欢迎页推荐话题 |
| `src/components/MessageBubble.tsx` | 消息气泡（标签 + Markdown + 打字光标） |
| `src/components/InputBar.tsx` | 输入框 + 控制条（发起/插话/暂停/跳过/重置/轮次/模拟开关） |
| `src/components/SettingsPanel.tsx` | 模型配置侧边面板（快速添加模板 + 自定义模型增删） |
| `src/components/Toast.tsx` | 操作提示 |

### 1.2 后端（backend/）与根目录

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
| `backend/requirements-dev.txt` | 开发依赖（pytest、pytest-asyncio、respx） |
| `backend/pytest.ini` | pytest 配置（asyncio_mode=auto） |
| `backend/.env.example` | 后端环境变量示例 |
| `backend/tests/` | pytest 测试（conftest + 5 个测试模块：heuristic / analyzer / config / api / api_stream，共 63 用例） |
| `index.html` | 单 HTML 原型（作为演示 demo，与 React 主版本功能同步） |
| `.gitignore` | Git 忽略规则 |
| `.trae/specs/` | Spec 驱动开发的规格文档（spec.md / tasks.md / checklist.md） |

## 2. 目录结构详解

### 2.1 前端分层

- `src/components/` — UI 组件（Header / RoleBar / ModelSelector / MessageList / MessageBubble / InputBar / SettingsPanel / Toast）
- `src/store/` — 状态管理（Context + useReducer，类型集中在 types.ts）
- `src/services/` — 业务逻辑（API 调用 `api.ts` / 分析器 `analyzer.ts` / 模拟器 `simulator.ts`）
- `src/utils/` — 工具函数（HTML 转义 `escape.ts` / Markdown 封装 `markdown.ts` / 延时 `sleep.ts`）
- `src/config/` — 预设模型配置（`presetModels.ts`，5 个快速添加模板）
- `src/App.css` — 全局深色赛博朋克主题（CSS 变量 `--bg/--fg/--accent` 等），全局动效

### 2.2 后端分层

- `app/main.py` — FastAPI app 实例 + CORS + 路由注册
- `app/api/` — 路由层（`health.py` 健康检查 / `analyze.py` 分析端点 / `deps.py` 依赖注入）
- `app/services/` — 业务层（`heuristic.py` Jaccard 启发式 / `analyzer.py` 流式自评）
- `app/config.py` — 配置层（CORS 来源 / 阈值 / `load_analyzer_keys()`）
- `app/schemas.py` — Pydantic 模型（Message / Tag / AnalyzeRequest 等）
- `tests/` — pytest 测试（conftest + 5 个测试模块）

## 3. 架构说明

### 3.1 模型调用流程

- **发言用模型调用**：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过
- **发言用 API Key 管理**：通过用户输入 + localStorage 持久化（key: `prism_models`，自动迁移自 `aiRoundtable_models`）
- **自定义模型**：在设置面板中添加 endpoint、model、apiKey、systemPrompt

### 3.2 分析 Key 管理（C1 修复）

发言者自评所需的 endpoint 与 API Key 通过后端环境变量 `PRISM_ANALYZER_API_KEYS`（JSON 字符串，结构 `{"model":{"endpoint":url,"key":apiKey}}`，按 model 名匹配）统一管理。前端只传 model 名，不传 endpoint 也不传 Key（C1 修复，避免 SSRF 与 Key 泄漏）。后端端口等配置通过环境变量读取。

### 3.3 共识/分歧分析路径

- **主路径**：发言者自评 LLM（通过 `POST /api/analyze/stream` SSE 流式）
- **回退路径**：Jaccard 启发式分析（自评失败时回退，通过 `POST /api/analyze` 同步返回）
- **阈值同步要求**：Jaccard 回退路径的阈值（当前 HIGH=0.14, LOW=0.11）前后端必须保持一致，改一处必须改另一处
  - 前端：`frontend/src/services/analyzer.ts`
  - 后端：`backend/app/config.py`

### 3.4 后端 API 端点

- `GET /api/health` — 健康检查
- `POST /api/analyze` — Jaccard 同步回退分析
- `POST /api/analyze/stream` — 发言者自评 SSE 流式分析
