# 测试补充计划报告（生成时间：2026-07-12）

## 0. 扫描范围与假设

- **仓库状态**：`main` 分支仅 1 个 commit（`5ace6b7 fix: index.html modelName XSS 转义修复`），无任何 merge 历史。因此"近期合并的代码"在当前仓库不成立。
- **本次扫描范围**：整个当前代码库（等价于"全部新增代码"）。
- **测试基建**：前端 vitest + jsdom，测试与源码同目录 `*.test.ts`，命名 `describe/it` + 中文描述；后端 pytest（`asyncio_mode=auto`），`tests/` + `conftest.py`（`client`、`patch_analyzer_keys` fixture）。
- **总体结论**：核心纯逻辑模块（`heuristic`、`analyzer` 解析、`markdown` XSS 加固、`reducer`、`simulator`、`buildAPIHistory`）覆盖扎实；**主要缺口集中在"前端 SSE/fetch 流式调用层"与"localStorage 迁移"**，与后端对称路径形成鲜明反差。

---

## 1. 已识别风险行为摘要

| # | 模块 | 风险行为（覆盖缺口） | 业务影响 |
|---|---|---|---|
| R1 | `frontend/src/services/api.ts` `streamChat` | SSE 流式模型调用 + 解析 + 错误分支 + abort 透传，**0 测试** | 主路径：模型发言失败/解析错误→发言丢失或卡死 |
| R2 | `frontend/src/services/analyzer.ts` `streamAnalysis` | 发言者自评 SSE 解析、delta/final/fallback 事件、超时 abort，**0 测试** | 自评失败回退逻辑出错→标签缺失或错误 |
| R3 | `frontend/src/services/analyzer.ts` `fetchAnalysis` | Jaccard 回退端点调用、超时、`tags` 校验、异常→null，**0 测试** | 兜底标签不可用 |
| R4 | `frontend/src/store/DiscussionContext.tsx` `loadModels` | localStorage 迁移（`aiRoundtable_models`→`prism_models`）+ JSON 解析容错，**0 测试**（且函数未导出） | 升级后用户模型配置丢失 |
| R5 | `backend/app/api/analyze.py` `/api/analyze` | 路由仅测空 body，非空多消息未做集成验证 | 路由接线/schema 反序列化回归无防护 |
| R6 | 讨论编排（`runDiscussion`/`generateResponse`/`streamAnalyzeMessage`） | pause/skip/abort/token 并发控制，业务关键但非确定性高 | 标记"需人工复查"，见 §3 |

---

## 2. 建议补充的测试清单（按模块分组）

### 模块 A：`frontend/src/services/api.ts` → 追加 `api.test.ts`

> 现有 `api.test.ts` 仅测 `buildAPIHistory`。`streamChat` 用 `vi.stubGlobal('fetch', ...)` 注入 mock Response，body 用 `new ReadableStream` 构造分块。

| 测试函数名（建议） | 用例描述 | 预期验证点 | 优先级 | 价值 |
|---|---|---|---|---|
| `streamChat_正常流_累积delta并回调` | fetch 返回 200，body 含 3 个 `data: {choices:[{delta:{content:"x"}}]}` + `[DONE]` | `onDelta` 被调 3 次，返回值=`"abc"` 累积全文 | P0 | 高 |
| `streamChat_跨buffer边界拼接` | 把单条 `data:` 行切成两个 ReadableStream chunk | delta 不丢失、不重复 | P0 | 高 |
| `streamChat_非200_抛错含状态码与截断文本` | fetch 返回 500，body=`"server boom"` | 抛 `Error`，message 含 `500` 与 `server boom`（≤100 字符） | P0 | 高 |
| `streamChat_无响应体_抛错` | `response.body` 为 null | 抛 `Error('API响应无响应体')` | P1 | 中 |
| `streamChat_忽略非data行与[DONE]` | body 含注释行、空行、`data: [DONE]` | 不回调 onDelta，返回累积全文 | P1 | 中 |
| `streamChat_单行JSON解析失败_静默跳过` | 一条 `data: not-json` + 一条合法 delta | 跳过非法行，合法 delta 仍回调 | P1 | 中 |
| `streamChat_abort信号透传` | 传入已 `abort()` 的 AbortSignal | fetch 被 `signal` 中断（断言 fetch 被调用时收到该 signal） | P1 | 中 |

**mock 策略**：`vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, {status:200})))`；`Response.body` 用 `ReadableStream` 自定义 enqueue 分块。`streamChat` 已 `export`，可直接 import。

### 模块 B：`frontend/src/services/analyzer.ts` → 追加 `analyzer.test.ts`

| 测试函数名（建议） | 用例描述 | 预期验证点 | 优先级 | 价值 |
|---|---|---|---|---|
| `streamAnalysis_正常流_返回final标签` | SSE 含 delta + `{"type":"final","label":"consensus","evidence":"x"}` | 返回 `{label:'consensus', evidence:'x'}`，`onDelta` 被调用 | P0 | 高 |
| `streamAnalysis_fallback事件_返回null` | SSE 含 `{"type":"fallback","reason":"no_key"}` | 立即返回 `null`（触发上层 Jaccard 回退） | P0 | 高 |
| `streamAnalysis_非200_返回null` | fetch 返回 404 | 返回 `null`，不读 body | P0 | 高 |
| `streamAnalysis_无body_返回null` | `response.body` 为 null | 返回 `null` | P1 | 中 |
| `streamAnalysis_跨buffer边界拼接` | `data: {type:final...}` 被切成两 chunk | final 仍被解析，返回正确 label | P1 | 中 |
| `streamAnalysis_畸形data行_跳过` | `data: not-json` + 合法 final | 跳过非法行，仍返回 final | P1 | 中 |
| `streamAnalysis_仅delta无final_返回null` | 流结束但无 final 事件 | 返回 `null`（调用方回退） | P1 | 中 |
| `fetchAnalysis_ok含tags_返回tags` | fetch 200，body=`{tags:[...]}` | 返回数组 | P1 | 中 |
| `fetchAnalysis_非ok_返回null` | fetch 500 | 返回 `null` | P1 | 中 |
| `fetchAnalysis_body无tags字段_返回null` | fetch 200，body=`{}` | 返回 `null` | P1 | 中 |
| `fetchAnalysis_网络异常_返回null` | fetch 抛 AbortError/TypeError | 返回 `null`，不抛错 | P1 | 中 |

**mock 策略**：同模块 A，`vi.stubGlobal('fetch', ...)` + `ReadableStream`。`streamAnalysis`/`fetchAnalysis` 均已 `export`，可直接测。

### 模块 C：`frontend/src/store/DiscussionContext.tsx` → 新增 `store/loadModels.test.ts`

> 前置：`loadModels` 与 `initState` 当前为模块私有未导出。建议**导出 `loadModels`**（或通过 `initState` 间接测）后补测。

| 测试函数名（建议） | 用例描述 | 预期验证点 | 优先级 | 价值 |
|---|---|---|---|---|
| `loadModels_无任何存储_返回空数组` | localStorage 空 | `[]` | P1 | 中 |
| `loadModels_新key存在_返回解析结果` | `localStorage.prism_models` = 合法 JSON | 返回对应 ModelConfig[] | P1 | 中 |
| `loadModels_仅legacykey_迁移并清除legacy` | 仅 `aiRoundtable_models` 有值 | 返回迁移后数据；`prism_models` 被写入；`aiRoundtable_models` 被删除 | P1 | 中 |
| `loadModels_新key损坏_返回空数组` | `prism_models` = 非法 JSON | 返回 `[]`，不抛错 | P1 | 中 |

**mock 策略**：jsdom 已提供 `localStorage`；`beforeEach` 清空。无网络/时间依赖，确定性。

### 模块 D：`backend/tests/test_api.py`（追加）

| 测试函数名（建议） | 用例描述 | 预期验证点 | 优先级 | 价值 |
|---|---|---|---|---|
| `test_analyze_multi_messages_through_route` | POST `/api/analyze`，2 条相似 + 1 条不相交 | 200，`tags` 长度 3，含 consensus/divergence 标签与 score | P2 | 中低 |

**fixture**：复用 `client`。`analyze()` 已单测，本用例只验证路由接线 + schema 反序列化。

---

## 3. 需人工复查的建议（非确定性，已排除最终推荐）

- **讨论编排逻辑**（`runDiscussion`/`generateResponse`/`streamAnalyzeMessage`，`frontend/src/store/DiscussionContext.tsx` L319-L512）：业务关键流程，含 pause/skip/abort/token 并发控制。但依赖 `Math.random()`（sleep 抖动 `20+Math.random()*30`）、多层 `setTimeout`、`AbortController`、`useRef` 可变状态与 React effect 时序，难以隔离为确定性单测。**建议**：若要覆盖，需先重构注入时间器（fake timers + 注入 sleep 工厂），属较大改动，超出"补测试"范围 → **本轮排除**，标记需人工复查。
- **`genId`**（`frontend/src/utils/sleep.ts` L5-L7）：依赖 `Date.now()` + `Math.random()`。现有测试仅校验结构（前缀/段数/长度），未断言具体值，属可接受的弱确定性，**保留**，无需新增。
- **`exportDiscussion`**（`frontend/src/store/DiscussionContext.tsx` L570-L595）：依赖 `new Date().toLocaleString('zh-CN')`、`URL.createObjectURL`、`a.click()` DOM 副作用 → 非确定性 + DOM 副作用，**本轮排除**，标记需人工复查。

---

## 4. 优先级与回归防护价值总览

| 优先级 | 测试项 | 价值 | 理由 |
|---|---|---|---|
| **P0** | `streamChat` 正常流/跨buffer/非200 | 高 | 模型调用主路径，后端对称逻辑已有 8 测试，前端 0 |
| **P0** | `streamAnalysis` final/fallback/非200 | 高 | 自评主路径前端侧，回退决策依赖其返回值 |
| **P1** | `streamChat` 无body/忽略非data行/解析失败/abort透传 | 中 | 边界与容错分支 |
| **P1** | `streamAnalysis` 无body/跨buffer/畸形行/仅delta | 中 | 边界与容错分支 |
| **P1** | `fetchAnalysis` 4 用例 | 中 | 兜底标签路径，影响最终可用性 |
| **P1** | `loadModels` 4 用例 | 中 | 数据迁移，下游全部模型配置依赖 |
| **P2** | `/api/analyze` 多消息集成 | 中低 | `analyze()` 已单测，仅补路由接线 |

---

## 5. 计划审查（静态执行核查）

- **确定性核查**：§2 全部建议均通过 `vi.stubGlobal('fetch')` + `ReadableStream` + jsdom `localStorage` 隔离，无真实网络/时间依赖，可独立运行、结果确定。
- **覆盖核查**：
  - `streamChat` 7 用例覆盖了 `frontend/src/services/api.ts` L58-L96 的 `!response.ok`、`!response.body`、`[DONE]`、JSON catch、delta 累积、buffer 拆分 6 个分支。
  - `streamAnalysis` 7 用例覆盖了 `frontend/src/services/analyzer.ts` L190-L222 的 `!resp.ok`、`!resp.body`、delta/final/fallback 三分支、buffer 拆分、JSON catch、流结束无 final 6 个分支。
  - `loadModels` 4 用例覆盖了 `frontend/src/store/DiscussionContext.tsx` L59-L77 的无存储/新key/legacy迁移/解析失败 4 个分支。
- **跳过项复核**：`SettingsPanel`/`ModelSelector`/`MessageBubble`/`InputBar`/`App.tsx` 经核查为纯渲染/接线或其安全行为已由 `markdown.test.ts`/`escape.test.ts` 覆盖；`presetModels.ts` 为纯数据常量；`index.html`（XSS 修复所在）为演示原型——均按规格跳过。

---

## 6. 结论

**本轮未发现需补充的测试缺口**：否。已识别 4 个 P0/P1 缺口（前端 SSE 调用层 + localStorage 迁移），均为业务关键且当前 0 覆盖，建议优先补齐 P0 的 6 个用例，再按优先级推进 P1/P2。
