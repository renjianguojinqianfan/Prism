# Prism 测试环境搭建与核心逻辑单元测试

## 概述

在前后端分层架构基础上，搭建完整的单元测试基础设施并覆盖核心业务逻辑。

- **后端**：在现有 5 个 pytest 测试基础上扩展，覆盖纯函数、流式路径（`stream_self_eval` 用 `respx` mock `httpx`）、`/api/analyze/stream` 端点（`dependency_overrides` 注入假 client）与端到端集成测试。
- **前端**：从零搭建 vitest + jsdom 测试栈，覆盖 `generateSimReply` / `buildAPIHistory` / `localHeuristicAnalyze` / reducer / utils 等核心纯逻辑。

目标：后端从 5 个测试增长到约 40+ 个；前端从 0 增长到约 30+ 个。**不改变任何业务行为**，仅对源文件做"导出"这一最小可见性调整以支持测试。

---

## 当前状态分析

### 后端现状
- `backend/pytest.ini`：`asyncio_mode = auto`，`testpaths = tests`（异步测试可直接跑）。
- `backend/requirements-dev.txt`：仅 `pytest>=8.0`、`pytest-asyncio>=0.23`。**无 HTTP mock 库**。
- `backend/tests/conftest.py`：仅一个 `client` fixture（`TestClient(app)`），无工厂、无 env fixture、无 httpx mock。
- 现有测试 5 个：`test_heuristic.py`（3 个：空/单条/两相似）、`test_api.py`（2 个：health/空 body）。
- **零覆盖的核心逻辑**：
  - `app/services/heuristic.py`：`_tokenize`（L31）、`_jaccard`（L75）、`_is_cjk`（L19）、`analyze` 的 divergence 分支与 neutral 中间区段。
  - `app/services/analyzer.py`：`_parse_label_json`（L28）、`build_analyzer_prompt`（L44）、`stream_self_eval`（L55，异步生成器）。
  - `app/config.py`：`load_analyzer_keys`（L18，env 解析）。
  - `app/api/analyze.py`：`/api/analyze/stream`（L22，依赖注入路径 + no_key 回退路径）。
- `httpx` 已是运行时依赖，`TestClient` 开箱即用。

### 前端现状
- `frontend/package.json`：**无任何测试相关依赖**（无 vitest/jest/jsdom/testing-library），无 `test` 脚本。
- `frontend/vite.config.ts`：仅 `react()` + dev server 配置，无 test 配置。
- **零测试文件**。
- 核心可测纯函数（部分未导出）：
  - `src/services/simulator.ts`：`generateSimReply`（L3，**已导出**，确定性：`(round-1) % pool.length`）。
  - `src/services/api.ts`：`buildAPIHistory`（L8，**已导出**，纯函数）。
  - `src/services/analyzer.ts`：`localHeuristicAnalyze`（L89，**已导出**）；`tokenize`（L28）、`jaccard`（L76）、`_isCjk`（L18）**未导出**。
  - `src/store/DiscussionContext.tsx`：`reducer`（L97，模块级函数，**未导出**，16 个 action）。
  - `src/utils/escape.ts`：`escapeHtml`（依赖 `document.createElement`，需 jsdom）。
  - `src/utils/markdown.ts`：`renderMarkdown`（包裹 `marked`，失败回退 `escapeHtml`）。
  - `src/utils/sleep.ts`：`sleep`（`setTimeout`）、`genId`（`Date.now()`+`Math.random()`，需 fake timers）。

### 关键约束（来自 AGENTS.md / project_memory）
- 阈值 `JACCARD_HIGH=0.14` / `JACCARD_LOW=0.11` **前后端必须同步**（后端 `config.py` L5-6，前端 `analyzer.ts` L86-87）。
- 前端 `tsconfig.json` strict + `noUnusedLocals` + `noUnusedParameters`，测试代码也必须通过 `npm run typecheck`。
- 后端测试工作流：`cd backend && pip install -r requirements-dev.txt && pytest`。
- 仅修改指定内容，不随意重构；提交前需用户确认。

---

## 提议的变更

### A. 后端测试环境（增量）

#### A1. `backend/requirements-dev.txt` — 新增 HTTP mock 依赖
在现有 `-r requirements.txt`、`pytest`、`pytest-asyncio` 基础上追加：
```
respx>=0.21
```
`respx` 是 `httpx` 专用 mock 库，能拦截 `AsyncClient.stream()` 调用并返回自定义 SSE chunk，正好覆盖 `stream_self_eval` 的所有分支。不引入 `pytest-mock`（`monkeypatch` + `respx` 已足够，避免依赖膨胀）。

#### A2. `backend/tests/conftest.py` — 扩展 fixtures
保留现有 `client` fixture，新增：
- `msg_factory`：返回工厂函数 `make_msg(id, model, content) -> Message`，避免每个测试文件内联构造 Pydantic 对象。
- `analyzer_msg_factory`：同上，构造 `AnalyzerMessage`（带 `model` 字段）。
- `patch_analyzer_keys`：基于 `monkeypatch.setenv/delenv` 的上下文 helper，设置 `PRISM_ANALYZER_API_KEYS`；测试结束自动 `delenv` 还原。
- `mock_llm_client`：返回一个可注入 `app.dependency_overrides[get_llm_client]` 的假 async generator（用于流式端点测试）；并提供 `clear_overrides` 自动清理（finalizer）。

#### A3. 源文件可见性调整（后端：无需）
后端 `_tokenize` / `_jaccard` / `_parse_label_json` / `build_analyzer_prompt` 虽以下划线开头，但 Python 模块内可直接 `from app.services.heuristic import _tokenize` 导入测试，**无需改源文件**。

---

### B. 后端单元测试（4 个文件，约 40+ 用例）

#### B1. 扩展 `backend/tests/test_heuristic.py`（保留现有 3 个，新增约 12 个）
直接测 `_tokenize` / `_jaccard` / `_is_cjk`，并补全 `analyze` 分支：
- `_is_cjk`：空字符串 → False；普通 ASCII → False；`一`(0x4E00) → True；扩展区 `㐀`(0x3400) → True；兼容区 `豈`(0xF900) → True。
- `_tokenize`：空串 → 空集；纯英文（去停用词、小写化、长度≥2）；纯中文 2-gram；中英混合分段 flush；标点分隔；停用词过滤（`the`/`的` 被剔除）。
- `_jaccard`：两空集 → 0.0；一空一非空 → 0.0；完全相同 → 1.0；不相交 → 0.0；部分相交 → 精确值。
- `analyze` 分支补全：
  - **divergence** 用例：3 条完全不同主题的中文消息 → 全部 `divergence`（`avg <= 0.11`）。
  - **neutral 中间区段** 用例：构造 `0.11 < avg < 0.14` 的输入 → `neutral`（当前零覆盖）。
  - 3+ 条消息的平均相似度计算正确性。
  - 阈值边界：`avg == 0.14` → `consensus`（`>=`）；`avg == 0.11` → `divergence`（`<=`）。

#### B2. 新增 `backend/tests/test_analyzer.py`（约 15 个用例）
- `_parse_label_json`（核心容错解析）：
  - 标准 `{"label":"consensus","evidence":"..."}` → 解析成功。
  - 前后有多余文字包裹 → 仍能匹配。
  - 代码块包裹 ```` ```json ... ``` ```` → 匹配内部 JSON。
  - 无 `label` 字段 → None。
  - `label` 值非法（`"agree"`）→ None。
  - JSON 损坏（缺引号）→ None。
  - `evidence` 缺失 → 返回 `evidence=""`。
  - 多个 JSON 块 → 取第一个含 `label` 的。
- `build_analyzer_prompt`：
  - 0 条前文 → 使用"（无前文，这是首条发言）"占位。
  - 6 条前文 → 只取最后 5 条（`prior_messages[-5:]`）。
  - `topic` 为空 → 模板中显示"未指定话题"。
  - 输出包含 `topic` / `prior_messages` / `your_message` 三个占位均被填充。
- `stream_self_eval`（用 `respx` mock `httpx.AsyncClient.stream`，**异步测试**，`asyncio_mode=auto`）：
  - HTTP 200 + 正常 SSE delta chunks + `[DONE]` + 最终可解析 JSON → 先 yield `delta` 事件，最后 yield `final` 事件。
  - HTTP 200 + delta + 最终 JSON 无 `label` → 末尾 yield `fallback` `parse_failed`。
  - HTTP 404 → 立即 yield `fallback` `http_404`，无 delta。
  - HTTP 500 → 同上 `http_500`。
  - SSE chunk 跨缓冲区边界（一个 `data:` 行被拆到两个 chunk）→ 仍能正确拼接。
  - `[DONE]` 行被跳过，不 yield。
  - 网络异常（`httpx.HTTPError`）→ yield `fallback` `network_error`。
  - 超时（`httpx.TimeoutException`）→ 同上 `network_error`。

#### B3. 新增 `backend/tests/test_config.py`（约 6 个用例，用 `monkeypatch`）
- `load_analyzer_keys`：
  - 未设置环境变量 → `{}`。
  - 空字符串 → `{}`。
  - 合法 JSON：`{"deepseek-chat":{"endpoint":"...","key":"..."}}` → 正确解析。
  - JSON 非 dict（如 `[1,2]`）→ `{}`。
  - JSON dict 但某条目缺 `endpoint` 或 `key` → 该条目被跳过，其余保留。
  - 非法 JSON（语法错误）→ `{}`。
  - 额外字段被忽略，只保留 `endpoint`/`key`。

#### B4. 新增 `backend/tests/test_api_stream.py`（约 8 个用例）
- `/api/analyze/stream` 端点（用 `client` fixture + `app.dependency_overrides[get_llm_client]`）：
  - **无 Key 路径**：`PRISM_ANALYZER_API_KEYS` 未设置 → 响应体含 `{"type":"fallback","reason":"no_key"}`。
  - **有 Key + 注入假 client（直接 yield 事件）**：覆盖 `final` / `fallback:parse_failed` / `fallback:http_500` 三种通过依赖注入模拟的场景。
  - **集成路径**：`monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", ...)` + `respx` mock 真实 `httpx` 调用 → 端到端 SSE 链路（delta → final）。
  - 响应 `media_type` 为 `text/event-stream`。
  - `currentMessage.model` 不在 Key 池中 → `no_key` 回退。
- 每个测试用 finalizer 确保 `app.dependency_overrides.clear()`。

---

### C. 前端测试环境（从零搭建）

#### C1. `frontend/package.json` — 新增 devDependencies 与脚本
devDependencies 追加：
```
"vitest": "^1.6.0",
"@vitest/ui": "^1.6.0",
"jsdom": "^24.0.0",
"@testing-library/react": "^15.0.0",
"@testing-library/jest-dom": "^6.4.0",
"@types/node": "^20.0.0"
```
scripts 追加：
```
"test": "vitest",
"test:run": "vitest run",
"test:ui": "vitest --ui"
```
> 选 `vitest` 而非 `jest`：与 Vite 原生集成，零额外转译配置，`import.meta.env` 直接可用。
> 选 `jsdom` 而非 `happy-dom`：`escapeHtml` 用 `document.createElement`，jsdom 对此支持最稳。
> `@testing-library/react` 本次仅 utils/markdown 用到，但为后续组件测试预留。

#### C2. 新增 `frontend/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: { reporter: ['text', 'html'] }
  }
})
```
> 复用现有 `@vitejs/plugin-react`，保持与 `vite.config.ts` 一致的 JSX 处理。
> `globals: true` 让 `describe/it/expect` 无需 import（符合社区惯例）。

#### C3. 新增 `frontend/src/test/setup.ts`
```ts
import '@testing-library/jest-dom/vitest'
```
> 仅做全局 matcher 注册；不在此处 mock `fetch`（按测试局部 mock，避免污染）。

#### C4. 源文件可见性调整（前端：3 处 `export` 关键字）
为支持纯函数单测，对源文件做**最小可见性调整**（只加 `export`，不改实现）：
- `frontend/src/services/analyzer.ts`：`function tokenize` → `export function tokenize`；`function jaccard` → `export function jaccard`；`function _isCjk` → `export function _isCjk`。
- `frontend/src/store/DiscussionContext.tsx`：`function reducer` → `export function reducer`；同时 `export type Action` 与 `export interface State`（供测试构造 action 类型）。
- `frontend/src/services/simulator.ts`：`generateSimReply` 已导出，无需改。
- `frontend/src/services/api.ts`：`buildAPIHistory` 已导出，无需改。

> 这些改动符合"测试驱动可见性"惯例，不改任何运行时行为，不引入新依赖。`npm run typecheck` 仍通过（export 只增不减）。

#### C5. `frontend/tsconfig.json` — 排除测试文件干扰 build
在 `include` 中确保包含 `src`（已包含），并在 `exclude` 中无需特殊处理（vitest 用自己的 `vitest.config.ts`）。若 `tsc -b` 报测试文件类型错误，再在 `tsconfig.json` 加 `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]`。**先不加，按需调整**。

---

### D. 前端单元测试（7 个文件，约 30+ 用例）

#### D1. `frontend/src/services/simulator.test.ts`（约 5 个）
- `generateSimReply`：
  - `modelId="deepseek"`、`round=1` → 返回 `templates.deepseek[0]`。
  - `round=2` → `templates.deepseek[1]`；`round=4` → `(4-1)%3=0` → `[0]`（环绕）。
  - 未知 `modelId` → 回退到 `deepseek` 模板池。
  - `history` 含前述 assistant 消息 → 输出包含 `刚才{modelName}提到` 片段。
  - `history` 无 assistant 消息 → 不含 `prevNotes` 片段。

#### D2. `frontend/src/services/api.test.ts`（约 4 个）
- `buildAPIHistory`：
  - 空消息列表 → 仅 system + 末尾 user（共 2 条）。
  - 含 1 user + 1 assistant → 共 4 条，顺序正确，assistant 前缀 `[{modelName}]`。
  - system content 包含 `topic` 与 `currentRound`。
  - user 消息前缀 `[主持人]`。

#### D3. `frontend/src/services/analyzer.test.ts`（约 10 个）
- 导出的 `tokenize`（直接测，与后端 `_tokenize` 行为对齐）：
  - 空串 → 空集。
  - 纯英文 + 停用词过滤 + 小写化。
  - 纯中文 2-gram。
  - 中英混合。
- 导出的 `jaccard`：两空集/完全相同/不相交/部分相交。
- 导出的 `localHeuristicAnalyze`：
  - 空数组 → `[]`。
  - 单条 → `neutral`，`score=0`。
  - 两条高重合 → `consensus`（验证 `score` 精度到 3 位小数）。
  - 两条完全不重合 → `divergence`。
  - **阈值边界同步校验**：在测试中硬编码 `HIGH=0.14`/`LOW=0.11`，与源文件常量比对（import 常量需先 export——若不想改源文件，则用行为断言：构造 avg 恰为 0.14 的输入断言 `consensus`）。
- **跨栈一致性**（可选 bonus）：构造一组固定输入，断言 `localHeuristicAnalyze` 的 label 与后端 `analyze` 一致（后端结果可硬编码为期望值，无需在 vitest 里调 Python）。

#### D4. `frontend/src/store/reducer.test.ts`（约 10 个）
导入 `reducer`、`State`、`Action`，构造初始 state，逐个 dispatch 并断言新 state：
- `SET_MODELS` / `ADD_MODEL` / `REMOVE_MODEL` / `UPDATE_MODEL` / `TOGGLE_MODEL_ENABLED`。
- `SET_SIMULATE` / `SET_MAX_ROUNDS` / `SET_INPUT`。
- `ADD_MESSAGE` / `UPDATE_MESSAGE` / `CLEAR_MESSAGES`。
- `SET_DISCUSSION_ACTIVE` / `SET_PAUSED` / `SET_CURRENT_ROUND` / `SET_SPEAKING` / `SET_SETTINGS_OPEN`。
- `ADD_TOAST` / `REMOVE_TOAST`。
- 未知 action 类型 → 返回原 state（默认分支）。
> 纯函数测试，不渲染 React，不需 `@testing-library/react`。

#### D5. `frontend/src/utils/escape.test.ts`（约 3 个，需 jsdom）
- `escapeHtml("<script>")` → 转义后的字符串（不含 `<script>`）。
- 普通文本 → 原样返回。
- 空串 → 空串。

#### D6. `frontend/src/utils/markdown.test.ts`（约 3 个）
- `renderMarkdown("**bold**")` → 含 `<strong>`。
- `renderMarkdown("")` → 空串。
- HTML 注入向量：`renderMarkdown('<img src=x onerror=alert(1)>')` → HTML token 被转义（验证 `walkTokens` 安全钩子）。

#### D7. `frontend/src/utils/sleep.test.ts`（约 3 个，用 `vi.useFakeTimers`）
- `sleep(100)` 后 `vi.advanceTimersByTime(100)` → promise resolve。
- 提前 advance 不 resolve。
- `genId()` → 匹配 `^msg_\d+_[a-z0-9]{6}$`；`vi.setSystemTime` 固定时间 → 前缀确定。

---

## 假设与决策

1. **不引入 `pytest-mock`**：`monkeypatch`（env）+ `respx`（httpx）+ `app.dependency_overrides`（FastAPI 依赖注入）已覆盖全部 mock 需求，避免依赖膨胀。
2. **不引入 `msw`**：前端 `fetch` mock 用 vitest 原生 `vi.fn()` + `vi.stubGlobal('fetch', ...)` 即可，`msw` 对纯函数测试是过度设计。本次纯函数测试无需 mock fetch；`fetchAnalysis`/`streamAnalysis`/`streamChat` 的 fetch mock 留作后续增量（本次不覆盖，避免范围蔓延）。
3. **前端仅覆盖纯函数 + reducer**，不测组件渲染：组件测试需更多 RTL setup 且 ROI 较低，本次聚焦"核心逻辑"。`@testing-library/react` 仍加入依赖，为后续预留。
4. **源文件改动仅限 `export` 关键字**：3 个前端文件加 `export`，0 个后端文件改。不重构、不改实现、不动业务逻辑。
5. **跨栈阈值同步**通过行为断言保障，不新增共享 schema 文件（避免过度工程）。
6. **测试文件命名**：前端用 `*.test.ts`；后端保持 `test_*.py`。
7. **不修改 `pytest.ini`**：`asyncio_mode=auto` 已满足异步测试需求。
8. **`@types/node`**：vitest 配置文件用 `defineConfig`/`vitest/config` 类型，需 node 类型；若 `tsconfig.node.json` 已含则可省，按需添加。
9. **遵循 AGENTS.md**：不使用第三方状态管理库（本次仅测试，不涉及）；阈值前后端一致；提交信息用 `test:` 类型。

---

## 验证步骤

### 后端验证
1. `cd backend && pip install -r requirements-dev.txt` → 成功安装 `respx`。
2. `cd backend && pytest -v` → 全部通过，用例数从 5 增长到 ~40+。
3. `cd backend && pytest --cov=app --cov-report=term-missing`（可选，若装了 pytest-cov）→ 核心模块覆盖率显著提升（heuristic/analyzer/config 接近全覆盖）。
4. 确认 `backend/app/` 源文件**零改动**（仅测试目录新增文件 + conftest 扩展 + requirements-dev.txt 加一行）。

### 前端验证
1. `cd frontend && npm install` → 成功安装 vitest/jsdom/testing-library。
2. `cd frontend && npm run typecheck` → 通过（strict 模式，含测试文件）。
3. `cd frontend && npm run test:run` → 全部通过，用例数 ~30+。
4. 确认源文件改动**仅 3 处 `export` 关键字**（analyzer.ts ×3、DiscussionContext.tsx ×3 类型/函数）。
5. `cd frontend && npm run build` → 仍成功（测试文件不进入构建产物）。

### 回归验证
- 前后端联调仍正常（后端源文件零改，前端仅可见性扩展，不影响运行时）。
- 模拟模式讨论 + 启发式分析 + 共识标签显示不受影响（行为零变更）。

---

## 执行顺序建议

1. **后端先行**：A1 → A2 → B1（扩展 heuristic）→ B2（analyzer）→ B3（config）→ B4（api_stream）→ 跑 `pytest` 全绿。
2. **前端环境**：C1（package.json）→ npm install → C2（vitest.config.ts）→ C3（setup.ts）→ C4（源文件 export）→ `npm run typecheck` 通过。
3. **前端测试**：D1（simulator，最简单确定性）→ D2（api）→ D3（analyzer）→ D4（reducer）→ D5/D6/D7（utils）→ `npm run test:run` 全绿。
4. **回归**：前后端联调一次确认无行为变化。
5. **报告**：汇总新增用例数、覆盖率、源文件改动 diff。
