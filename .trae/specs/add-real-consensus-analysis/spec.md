# 棱镜 (Prism) 能力规格 Spec

> change-id: `add-real-consensus-analysis`
> 最后更新：2026-06-30（重构共识/分歧分析为「发言者自评 + SSE 流式 + 三级回退」架构，移除预设模型改为快速添加模板）

## Why

棱镜（Prism）定位为"多 AI 视角碰撞 · 共识/分歧一目了然"的讨论台。项目经历三个演进阶段：
1. **初版单 HTML 原型**（`index.html`，保留对照）：四个模型串行发言，共识/分歧标签为 Mock。
2. **真实共识/分歧分析**：新增 FastAPI 后端，基于关键词 Jaccard 2-gram 相似度给出真实标签；前端本地启发式作为回退。
3. **React + TypeScript 迁移**（`frontend/`，当前主版本）：组件化重构、SSE 流式输出、Markdown 渲染、模拟模式多轮连贯、安全加固。

本 Spec 现作为项目**当前能力规格 + 未来规划**的单一事实来源，覆盖已落地能力与 P1 规划项。

## What Changes

### 已落地（Implemented）
- **前端架构迁移**：从单 `index.html` 迁移到 React 18 + TypeScript（strict）+ Vite + Tailwind CSS；状态管理用 Context + useReducer + useRef，无第三方状态库
- **SSE 流式调用**：`streamChat()` 直连各家 OpenAI 兼容 `/v1/chat/completions`（`stream: true`），逐 token 渲染并支持 AbortController 中断
- **发言者自评 + SSE 流式 + 三级回退**：每条 AI 发言结束后，由该发言者自己的 LLM 对自己发言做共识/分歧/中立评估，后端 `POST /api/analyze/stream` 以 SSE 推回 `delta`/`final`/`fallback` 事件；分析 endpoint 与 Key 通过后端环境变量 `PRISM_ANALYZER_API_KEYS`（JSON 字符串，结构 `{"model":{"endpoint":url,"key":apiKey}}`，按 model 名匹配）统一管理，前端只传 model 名，不传 endpoint 也不传 Key（C1 修复，避免 SSRF 与 Key 泄漏）。第一条 AI 发言作为基准不带标签，从第二条开始评估。三级回退：发言者自评失败 → 后端 Jaccard `/api/analyze`（同步）→ 前端 `localHeuristicAnalyze`
- **预设模型改为快速添加模板**：移除 4 个预设模型，改为用户自填 + 5 个快速添加模板（DeepSeek/Kimi/GLM/通义千问/Mimo），模板只预填端点/模型名/角色设定，API Key 仍由用户手填；首次进入自动展开配置面板
- **模拟模式多轮连贯**：`generateSimReply()` 引用上一条 AI 发言片段，按 `(round-1) % pool.length` 确定性取模板，保证同话题可复现
- **Markdown 渲染 + XSS 防护**：marked v12 + `walkTokens` 转义 HTML token，思考态走纯文本转义 + 打字光标
- **模型复选框选择器**：默认全选，可自由勾选参与讨论的模型
- **讨论控制**：暂停/继续、跳过当前发言者、一键重置、Markdown 导出
- **安全加固**：CORS 收紧为环境变量白名单（`PRISM_CORS_ORIGINS`）、`response.body` 非空防御、setTimeout 定时器追踪与卸载清理、localStorage 键迁移（`aiRoundtable_models` → `prism_models`，含旧键数据迁移）
- **useCallback 优化**：纯 dispatch 回调用 useCallback 包裹稳定引用，依赖 state 的函数移入 useMemo 内部

### 规划中（Planned, P1）
- **观点图谱（D3 力导向图）**：讨论结束后在消息列表上方/侧边渲染节点-边视图，节点 = 每条 AI 发言，边 = 两两 Jaccard 相似度，颜色映射 consensus/divergence/neutral。用户已明确要求引入 D3（豁免 AGENTS.md "禁止图表库"约束）

## Impact

- 受影响 specs：本 Spec 为项目唯一 spec
- 受影响代码：
  - `frontend/src/`（React+TS 全量迁移产物，含 store/services/utils/components）
  - `main.py`、`requirements.txt`、`.env.example`（后端骨架 + CORS 收紧）
  - `readme.md`、`agents.md`（文档同步）
  - `index.html`（早期原型，保留对照，不再演进）

## ADDED Requirements

### Requirement: SSE 流式聊天
系统 SHALL 通过 `streamChat()` 以 SSE 方式调用 OpenAI 兼容端点，逐 token 回调更新消息内容，并支持 `AbortSignal` 中断。

#### Scenario: 正常流式
- **WHEN** 真实模式下调用某模型且 `response.ok`
- **THEN** 逐 token 拼接 `fullContent` 并通过 `onDelta(delta, full)` 回调，气泡实时渲染，`[DONE]` 结束

#### Scenario: 响应体缺失
- **WHEN** `response.body` 为 null
- **THEN** 抛出 `Error('API响应无响应体')`，由上层 catch 转为 toast 错误提示

#### Scenario: 用户跳过
- **WHEN** 用户点击"跳过"触发 `abortController.abort()`
- **THEN** 流式读取中断，`AbortError` 被静默吞掉，不弹错误 toast

### Requirement: 发言者自评流式分析与三级回退
系统 SHALL 在每条 AI 发言结束后，由该发言者自己的 LLM 对自己发言做共识/分歧/中立评估，通过后端 `POST /api/analyze/stream`（SSE 流式）推回结果。分析 endpoint 与 Key 由后端环境变量 `PRISM_ANALYZER_API_KEYS`（JSON 字符串，结构 `{"model":{"endpoint":url,"key":apiKey}}`，按 model 名匹配）统一管理，前端只传 model 名，不传 endpoint 也不传 Key（C1 修复，避免 SSRF 与 Key 泄漏）。第一条 AI 发言作为基准不带标签，从第二条开始评估。失败时按「后端 Jaccard `/api/analyze`（同步）→ 前端 `localHeuristicAnalyze`」三级回退。

#### Scenario: 第一条发言作为基准
- **WHEN** 讨论进行中且当前消息是第一条 AI 发言
- **THEN** 跳过分析，消息不携带 `tag`，后续发言以此为基准进行对比

#### Scenario: 发言者自评成功
- **WHEN** 第二条及以后发言结束，且后端能在 `PRISM_ANALYZER_API_KEYS` 中按该发言者 model 名查到 `{"endpoint":url,"key":apiKey}` 配置
- **THEN** 后端以后端配置的 endpoint + Key 调用其 LLM（endpoint 不来自前端，杜绝 SSRF），SSE 推送 `delta`（流式证据片段）与 `final`（`{label, evidence, analyzer}` JSON）事件，前端写入 `msg.tag`，标签内附加「· {analyzer}自评」子文案

#### Scenario: 自评失败回退到后端 Jaccard
- **WHEN** 无对应 model 配置 / 上游 LLM 调用失败 / 解析失败
- **THEN** 后端推送 `fallback` 事件，前端转调同步 `POST /api/analyze`（Jaccard 2-gram + 阈值 0.14/0.11）写入 `msg.tag`（不含 `analyzer` 字段）

#### Scenario: 后端 Jaccard 仍不可达
- **WHEN** 同步回退 fetch 失败 / 超时 / HTTP 非 2xx / 模拟模式
- **THEN** 进一步回退到前端 `localHeuristicAnalyze`，算法（停用词表、2-gram 分词、Jaccard 相似度、阈值 0.14/0.11）与后端 Jaccard 保持一致

#### Scenario: 前文上下文裁剪
- **WHEN** `priorMessages` 超过 5 条
- **THEN** 后端仅取最近 5 条作为对比上下文构建 prompt，避免 token 超限

### Requirement: 模拟模式多轮连贯
系统 SHALL 在模拟模式下让后发言模型引用前一条 AI 发言的前 60 字，保证多轮对话连贯。

#### Scenario: 有前序 AI 发言
- **WHEN** `generateSimReply()` 找到 `prevAi`
- **THEN** 模板内插入「刚才{modelName}提到「{lastPoint}」」片段

#### Scenario: 无前序 AI 发言（首轮首位）
- **WHEN** 未找到 `prevAi`
- **THEN** 模板内不插入引用片段，正常输出首轮观点

### Requirement: Markdown 渲染与 XSS 防护
系统 SHALL 用 marked 渲染 AI 回复的 Markdown，并通过 `walkTokens` 对 `type === 'html'` 的 token 调用 `escapeHtml` 转义，防止 XSS。

#### Scenario: 正常 Markdown
- **WHEN** AI 回复含加粗/列表/代码块/引用
- **THEN** 经 marked 渲染为 HTML，通过 `dangerouslySetInnerHTML` 注入气泡

#### Scenario: 含 HTML 标签的恶意输入
- **WHEN** 回复含 `<script>alert(1)</script>` 或 `<img onerror=...>`
- **THEN** `walkTokens` 将 HTML token 文本转义为纯文本，不执行脚本

#### Scenario: 思考态
- **WHEN** `msg.thinking === true`
- **THEN** 走 `escapeHtml(content) + '<span class="typing-cursor"></span>'`，不经过 marked

### Requirement: 定时器与内存清理
系统 SHALL 追踪 `showToast` 创建的所有 setTimeout，在组件卸载或手动关闭 toast 时清理，避免卸载后 setState。

#### Scenario: 组件卸载
- **WHEN** Provider 卸载
- **THEN** `toastTimersRef` 中所有定时器被 `clearTimeout` 并清空 Map

#### Scenario: 手动关闭 toast
- **WHEN** 用户点击关闭按钮触发 `dismissToast(id)`
- **THEN** 对应定时器被清理并从 Map 删除

### Requirement: localStorage 键迁移
系统 SHALL 将模型配置存储键从旧品牌名 `aiRoundtable_models` 迁移到 `prism_models`，并在首次读取时自动迁移旧键数据。

#### Scenario: 首次加载存在旧键
- **WHEN** `prism_models` 不存在但 `aiRoundtable_models` 存在
- **THEN** 读取旧键数据写入新键，旧键保留不删（避免数据丢失争议）

#### Scenario: 新键已存在
- **WHEN** `prism_models` 已存在
- **THEN** 直接读取新键，不触发迁移

### Requirement: CORS 白名单配置
系统 SHALL 通过环境变量 `PRISM_CORS_ORIGINS`（逗号分隔）配置允许的来源，不再使用 `allow_origins=["*"]`。

#### Scenario: 默认本地开发
- **WHEN** 未设置环境变量
- **THEN** 默认允许 `http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173`

#### Scenario: 生产部署
- **WHEN** 设置 `PRISM_CORS_ORIGINS=https://prism.example.com`
- **THEN** 仅允许该来源，方法限定 `GET/POST/OPTIONS`，头限定 `Content-Type/Authorization`

## PLANNED Requirements (P1)

### Requirement: 观点图谱可视化
系统 SHALL 在讨论结束后提供 D3 力导向图视图，将发言关系可视化。

#### Scenario: 图谱渲染
- **WHEN** 讨论结束且 `analyzeMessages()` 产出 tags
- **THEN** 渲染力导向图：节点 = 每条 AI 发言（颜色按 label），边 = 两两 Jaccard 相似度（边宽/透明度映射 score），可拖拽、可 hover 高亮邻接节点

#### Scenario: 图谱与列表联动
- **WHEN** 用户点击图谱某节点
- **THEN** 消息列表滚动到对应气泡并高亮

#### Scenario: 图谱关闭
- **WHEN** 用户点击关闭或发起新讨论
- **THEN** 图谱收起，不阻塞列表交互

> 注：本 Requirement 涉及引入 D3 依赖，已获用户明确授权，豁免 AGENTS.md "禁止引入图表库"约束。

## MODIFIED Requirements

### Requirement: 前端架构
原单 `index.html` 文件改为 React + TypeScript + Vite 工程化项目（`frontend/`），组件按 `components/`、纯逻辑按 `services/`/`utils/`、类型集中在 `store/types.ts`，状态统一在 `DiscussionContext.tsx` 用 useReducer + useRef 管理。

### Requirement: 共识/分歧标签来源
原 Mock 策略（第一条共识/最后一条分歧）已被替换为「发言者自评」架构：第一条 AI 发言作为基准不带标签，从第二条起由发言者自己的 LLM 对自己发言做评估，经后端 `POST /api/analyze/stream`（SSE）推回；自评失败时三级回退到后端 Jaccard `/api/analyze`（同步）→ 前端 `localHeuristicAnalyze`（Jaccard 2-gram + 阈值 0.14/0.11）。标签内附加「· {analyzer}自评」子文案以区分自评成功与回退路径。

## REMOVED Requirements

### Requirement: 固定 Mock 标签策略（第一条共识/最后一条分歧）
**Reason**：与产品核心价值"真实多视角碰撞"不符，仅作为初版占位
**Migration**：CSS 类 `.msg-tag.consensus/.divergence/.neutral` 保留，逻辑层由 `analyzeMessages()` 统一接管
