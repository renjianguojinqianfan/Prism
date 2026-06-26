# 棱镜 (Prism) 能力规格 Spec

> change-id: `add-real-consensus-analysis`
> 最后更新：2026-06-26（重新扫描项目，纳入 React 迁移、SSE 流式、Markdown 渲染、安全加固等已落地能力，并规划 P1 观点图谱）

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
- **真实 LLM 分析 + 本地回退**：讨论结束后调用后端 `POST /api/analyze`；失败/超时/模拟模式自动回退到前端 `localHeuristicAnalyze`，前后端停用词与分词逻辑已统一
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

### Requirement: 真实 LLM 分析与本地回退
系统 SHALL 在讨论结束后优先调用后端 `/api/analyze`，失败时回退到前端 `localHeuristicAnalyze`，两者算法（停用词表、2-gram 分词、Jaccard 相似度、阈值 0.14/0.11）MUST 保持一致。

#### Scenario: 后端可用
- **WHEN** 真实模式且 `POST /api/analyze` 返回 200
- **THEN** 用后端返回的 `tags` 写入每条消息的 `msg.tag`

#### Scenario: 后端不可达
- **WHEN** fetch 失败 / 4s 超时 / HTTP 非 2xx / 模拟模式
- **THEN** 回退到 `localHeuristicAnalyze`，toast 提示"已使用本地分析（后端不可用或模拟模式）"

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
原 Mock 策略（第一条共识/最后一条分歧）已被替换为：真实模式走后端 `/api/analyze`，模拟/失败回退走前端 `localHeuristicAnalyze`（Jaccard 2-gram + 阈值 0.14/0.11）。

## REMOVED Requirements

### Requirement: 固定 Mock 标签策略（第一条共识/最后一条分歧）
**Reason**：与产品核心价值"真实多视角碰撞"不符，仅作为初版占位
**Migration**：CSS 类 `.msg-tag.consensus/.divergence/.neutral` 保留，逻辑层由 `analyzeMessages()` 统一接管
