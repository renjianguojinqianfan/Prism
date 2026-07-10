# Prism 深层上下文 (Context)

> 本文件为 AGENTS.md 的补充，提供架构说明。
> AI 在需要理解架构细节时查阅本文件。文件清单不再手动维护，直接用 Glob/LS 扫描。

## 1. 目录结构

### 1.1 前端分层

- `src/components/` - UI 组件（Header / RoleBar / ModelSelector / MessageList / MessageBubble / InputBar / SettingsPanel / Toast）
- `src/store/` - 状态管理（Context + useReducer，类型集中在 types.ts）
- `src/services/` - 业务逻辑（API 调用 `api.ts` / 分析器 `analyzer.ts` / 模拟器 `simulator.ts`）
- `src/utils/` - 工具函数（HTML 转义 `escape.ts` / Markdown 封装 `markdown.ts` / 延时 `sleep.ts`）
- `src/config/` - 预设模型配置（`presetModels.ts`，5 个快速添加模板）
- `src/App.css` - 全局深色赛博朋克主题（CSS 变量 `--bg/--fg/--accent` 等），全局动效

### 1.2 后端分层

- `main.py` - 后端入口（re-export `app.main:app` 供 `uvicorn main:app` 加载）
- `app/main.py` - FastAPI app 实例 + CORS + 路由注册
- `app/api/` - 路由层（`health.py` 健康检查 / `analyze.py` 分析端点 / `deps.py` 依赖注入）
- `app/services/` - 业务层（`heuristic.py` Jaccard 启发式 / `analyzer.py` 流式自评）
- `app/config.py` - 配置层（CORS 来源 / 阈值 / `load_analyzer_keys()`）
- `app/schemas.py` - Pydantic 模型（Message / Tag / AnalyzeRequest 等）
- `tests/` - pytest 测试（conftest + 5 个测试模块）

## 2. 架构说明

### 2.1 模型调用流程

- **发言用模型调用**：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过
- **发言用 API Key 管理**：通过用户输入 + localStorage 持久化（key: `prism_models`，自动迁移自 `aiRoundtable_models`）
- **自定义模型**：在设置面板中添加 endpoint、model、apiKey、systemPrompt

### 2.2 分析 Key 管理（C1 修复）

发言者自评所需的 endpoint 与 API Key 通过后端环境变量 `PRISM_ANALYZER_API_KEYS`（JSON 字符串，结构 `{"model":{"endpoint":url,"key":apiKey}}`，按 model 名匹配）统一管理。前端只传 model 名，不传 endpoint 也不传 Key（C1 修复，避免 SSRF 与 Key 泄漏）。后端端口等配置通过环境变量读取。

### 2.3 共识/分歧分析路径

- **主路径**：发言者自评 LLM（通过 `POST /api/analyze/stream` SSE 流式）
- **回退路径**：Jaccard 启发式分析（自评失败时回退，通过 `POST /api/analyze` 同步返回）
- **阈值同步要求**：Jaccard 回退路径的阈值（当前 HIGH=0.14, LOW=0.11）前后端必须保持一致，改一处必须改另一处
  - 前端：`frontend/src/services/analyzer.ts`
  - 后端：`backend/app/config.py`

### 2.4 后端 API 端点

- `GET /api/health` - 健康检查
- `POST /api/analyze` - Jaccard 同步回退分析
- `POST /api/analyze/stream` - 发言者自评 SSE 流式分析
