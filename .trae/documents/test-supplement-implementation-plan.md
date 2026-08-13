# 测试补充实现计划（P0 + P1）

> 依据：`docs/test-gap-report-2026-07-12.md`（已核实准确）
> 范围：P0（streamChat / streamAnalysis 核心）+ P1（边界用例 / fetchAnalysis / loadModels）
> 不含：P2 后端 `/api/analyze` 多消息集成（留作后续）、讨论编排（报告 §3 标记人工复查）

---

## 1. 现状分析

### 测试基建（已确认）
- 前端：vitest `jsdom` + `globals: true` + react 插件，`include: ['src/**/*.{test,spec}.{ts,tsx}']`（`frontend/vitest.config.ts`）
- 风格约定：`import { describe, it, expect } from 'vitest'`；`describe/it` 中文描述；复用 `baseModel` 常量（见 `api.test.ts`）
- 后端：pytest + `conftest.py`（`client` / `patch_analyzer_keys` fixture）
- 现有 82 前端 + 63 后端用例，纯函数覆盖扎实

### 缺口（已核实，0 覆盖）
| 函数 | 位置 | export | 测试现状 |
|---|---|---|---|
| `streamChat` | `frontend/src/services/api.ts` L36-97 | ✓ | 0（`api.test.ts` 仅测 `buildAPIHistory`）|
| `streamAnalysis` | `frontend/src/services/analyzer.ts` L174-229 | ✓ | 0（`analyzer.test.ts` 仅测纯函数）|
| `fetchAnalysis` | `frontend/src/services/analyzer.ts` L122-148 | ✓ | 0 |
| `loadModels` | `frontend/src/store/DiscussionContext.tsx` L59-77 | ✗ 未导出 | 0 |

### 连锁风险（来自 git 历史分析）
- `94ba933`(07-09) 超时覆盖流式读取，改 analyzer.ts 54 行，无测试 -> 同日即返工
- 后端对称流式逻辑已有 8 测试，前端 0 -> 前后端不对称是回归温床
- 补齐前端侧后，`streamChat`/`streamAnalysis` 的跨 buffer 解析、错误分支、fallback 决策将受测试保护

---

## 2. 源码改动（仅 1 处，零行为变化）

### 2.1 导出 `loadModels` 以支持单测
- **文件**：`frontend/src/store/DiscussionContext.tsx` L59
- **改动**：`function loadModels(): ModelConfig[] {` → `export function loadModels(): ModelConfig[] {`
- **理由**：`loadModels` 为纯函数（仅读 `localStorage`），导出不影响行为；有先例 `3a10313`（"导出 analyzer/reducer 内部函数以支持单元测试（零行为变化）"）
- **typecheck 影响**：新增 export 不会破坏现有引用

---

## 3. 新增/追加测试（3 个文件，共 22 用例）

### 模块 A：`frontend/src/services/api.test.ts`（追加 7 用例）

> 在现有 `buildAPIHistory` describe 块之后追加新 describe 块。复用现有 `baseModel`。

**共享 helper（置于文件顶部或 describe 内）**：
```typescript
function makeSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach(c => controller.enqueue(new TextEncoder().encode(c)))
      controller.close()
    }
  })
}
function mockFetch(body: ReadableStream | string | null, status = 200) {
  const resp = body === null
    ? { ok: status < 400, status, body: null, text: async () => '' }
    : new Response(body, { status })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resp))
}
```

**用例清单**（对应 `api.ts` 分支）：

| # | 用例 | 覆盖分支 | 断言要点 |
|---|---|---|---|
| A1 | 正常流累积 delta 并回调 | L86-88 累积+回调 | 3 个 `data:{delta}` + `[DONE]`；`onDelta` 调 3 次；返回 `"abc"` |
| A2 | 跨 buffer 边界拼接 | L75-77 split/pop | 单条 `data:` 行切成两 chunk；delta 不丢失不重复 |
| A3 | 非 200 抛错含状态码与截断文本 | L58-60 | status=500 + body `"server boom"`；抛 `Error`，message 含 `500` 与 `server boom` |
| A4 | 无响应体抛错 | L63-64 | `body=null`；抛 `Error('API响应无响应体')` |
| A5 | 忽略非 data 行与 [DONE] | L80/82 | 注释行+空行+`data: [DONE]`；不回调；返回累积全文 |
| A6 | 单行 JSON 解析失败静默跳过 | L90 catch | `data: not-json` + 合法 delta；跳过非法行，合法 delta 仍回调 |
| A7 | abort 信号透传 | L55 signal | 传入已构造的 `AbortSignal`；断言 `fetch.mock.calls[0][1].signal === signal` |

**清理**：每个用例 `afterEach(() => vi.unstubAllGlobals())`（或 describe 级）。

### 模块 B：`frontend/src/services/analyzer.test.ts`（追加 11 用例）

> 在现有 `localHeuristicAnalyze` describe 之后追加。复用 `makeSSEStream`（可提取到 `__testutils__` 或在本文件内重复定义，倾向本文件内定义保持低耦合）。

**streamAnalysis 用例（7 个，对应 L190-222）**：

| # | 用例 | 覆盖分支 | 断言要点 |
|---|---|---|---|
| B1 | 正常流返回 final 标签 | L213/215 | delta + `{"type":"final","label":"consensus","evidence":"x"}`；返回 `{label:'consensus',evidence:'x'}`；`onDelta` 被调 |
| B2 | fallback 事件返回 null | L217 | `{"type":"fallback","reason":"no_key"}`；立即返回 `null` |
| B3 | 非 200 返回 null | L190 | status=404；返回 `null`，不读 body |
| B4 | 无 body 返回 null | L190 | `body=null`；返回 `null` |
| B5 | 跨 buffer 边界拼接 | L200-202 | final event 切两 chunk；仍正确解析返回 label |
| B6 | 畸形 data 行跳过 | L210 catch | `data: not-json` + 合法 final；跳过非法，返回 final |
| B7 | 仅 delta 无 final 返回 null | L222 | 流结束无 final；返回 `null`（调用方回退）|

**fetchAnalysis 用例（4 个，对应 L122-148）**：

| # | 用例 | 覆盖分支 | 断言要点 |
|---|---|---|---|
| B8 | ok 含 tags 返回 tags | L137-139 | 200 + `{tags:[{...}]}`；返回数组 |
| B9 | 非 ok 返回 null | L137/141 | 500；返回 `null` |
| B10 | body 无 tags 字段返回 null | L139/141 | 200 + `{}`；返回 `null` |
| B11 | 网络异常返回 null | L145 catch | `fetch` 抛 `TypeError`；返回 `null`，不抛错 |

**fetchAnalysis mock 策略**：`vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {status})))`；B11 用 `vi.fn().mockRejectedValue(new TypeError('fetch failed'))`。`timeoutMs` 传大值（如 10000）避免超时副作用，或默认值即可（fetch mock 立即 resolve，`finally` 会 `clearTimeout`）。

### 模块 C：`frontend/src/store/loadModels.test.ts`（新建，4 用例）

> 前置：§2.1 导出 `loadModels` 后。`loadModels` 读 `localStorage`（jsdom 原生提供）。

**导入**：
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { loadModels } from './DiscussionContext'
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '../config/presetModels'
import type { ModelConfig } from './types'
```

**用例**（对应 L59-77）：

| # | 用例 | 覆盖分支 | 断言要点 |
|---|---|---|---|
| C1 | 无任何存储返回空数组 | L76 | localStorage 空；返回 `[]` |
| C2 | 新 key 存在返回解析结果 | L69-71 | `prism_models` 存合法 JSON；返回对应 `ModelConfig[]` |
| C3 | 仅 legacy key 迁移并清除 | L62-67 | 仅 `aiRoundtable_models` 有值；返回迁移数据；`prism_models` 被写入；legacy 被删除 |
| C4 | 新 key 损坏返回空数组 | L72-73 | `prism_models` = 非法 JSON；返回 `[]`，不抛错 |

**mock**：`beforeEach(() => localStorage.clear())`，jsdom 提供 `localStorage`，无网络/时间依赖。

---

## 4. 假设与决策

1. **mock `fetch` 用 `vi.stubGlobal`**：jsdom 默认不提供 `fetch`，stub 后注入 `Response`+`ReadableStream`（Node 18+ 提供）。已确认 vitest 配置 jsdom 环境。
2. **`Response`/`ReadableStream` 可用性**：vitest 测试实际跑在 Node 进程，Node 18+ 全局提供 `Response`/`ReadableStream`/`TextEncoder`，无需 polyfill。
3. **`loadModels` 导出为零行为改动**：仅加 `export` 关键字，不修改函数体，符合 `3a10313` 先例与 AGENTS.md "纯逻辑放 services/utils" 约定。
4. **不引入 fake timers**：streamAnalysis/fetchAnalysis 的 `setTimeout` 在测试中由 mock fetch 立即 resolve + `finally clearTimeout` 覆盖，不会真触发超时。超时触发场景（如服务端挂起）不在本轮用例（报告未要求）。
5. **不测讨论编排**：`runDiscussion`/`generateResponse`/`streamAnalyzeMessage` 依赖 `Math.random`/`setTimeout`/`useRef`/AbortController 时序，按报告 §3 排除，留作后续小重构（抽 `isTokenActive` 纯函数）后补。
6. **风格对齐**：所有新用例沿用现有 `describe/it` 中文描述、`baseModel` 复用、`expect` 断言风格。

---

## 5. 验证步骤

执行顺序（每步须通过）：

1. **改源码导出**：`DiscussionContext.tsx` L59 加 `export` -> `npm run typecheck` 通过
2. **写模块 A**（api.test.ts +7）-> `npm run test:run` 通过
3. **写模块 B**（analyzer.test.ts +11）-> `npm run test:run` 通过
4. **写模块 C**（loadModels.test.ts +4）-> `npm run test:run` 通过
5. **全量门禁**：`npm run test:run && npm run typecheck && npm run build` 全绿
6. **用例计数**：前端从 82 -> 104（+22），后端不变 63

等价快捷方式：`make verify`（含后端 pytest，本轮未改后端，应保持 63 通过）。

---

## 6. 实施顺序与提交建议

按 AGENTS.md "小步提交" 原则，分 3-4 次提交（每模块一次，源码导出可并入模块 C 或单独）：

1. `test: 补充 streamChat 流式调用层 7 用例`（模块 A）
2. `test: 补充 streamAnalysis/fetchAnalysis 11 用例`（模块 B）
3. `refactor: 导出 loadModels 支持单测（零行为变化）`（§2.1）
4. `test: 补充 loadModels localStorage 迁移 4 用例`（模块 C）

每次提交 pre-commit hook 会跑 `make verify`，须全绿。
