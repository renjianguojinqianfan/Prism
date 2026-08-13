# 棱镜 (Prism) 测试指南

> 本文档描述 Prism 项目的测试体系：单元测试、端到端测试、质量门禁。
> 最后更新：2026-08-13

---

## 1. 测试体系概览

| 层级 | 工具 | 用例数 | 覆盖范围 |
|------|------|--------|----------|
| 前端单元测试 | vitest + jsdom | 131 | 纯函数、reducer、编排引擎、SSE 流式调用层、localStorage 迁移、XSS 防护 |
| 端到端测试 | Playwright MCP | 10 | 核心 UI、讨论流程、讨论控制、XSS 防护、持久化 |
| 质量门禁 | Makefile / hooks | - | `make verify` 一键全检；pre-commit 自动跑 test + typecheck |

> 注：后端已整体移除（2026-07-13 `590397d`），测试体系为纯前端。`docs/testing.md` 中后端相关内容已同步清除。

---

## 2. 测试基建

### 2.1 前端

- **配置文件**：`frontend/vitest.config.ts`
- **环境**：jsdom + globals: true + react 插件
- **测试文件约定**：与源码同目录 `*.test.ts`，`describe/it` 中文描述
- **mock 策略**：
  - fetch/SSE：`vi.stubGlobal('fetch', ...)` + `ReadableStream` 构造 SSE 分块（行尾 `\n\n` 对齐 OpenAI SSE 格式）
  - localStorage：`vi.stubGlobal('localStorage', ...)` 提供内存版（规避 Node 内置 API 不完整）
  - 编排引擎：mock 4 个 EngineCallbacks + `simulator` / `analyzer` / `api` 模块

---

## 3. 单元测试（131 用例 / 10 文件）

| 测试文件 | 用例数 | 覆盖范围 |
|----------|--------|----------|
| `src/services/analyzer.test.ts` | 47 | `isCjk`/`tokenize`/`jaccard`/`localHeuristicAnalyze` 纯函数、`parseLabelJson`（含含花括号 evidence 的配对扫描）、`buildAnalyzerPrompt`、`directStreamAnalysis` 全链路 |
| `src/store/reducer.test.ts` | 20 | reducer 纯函数：models/discussion control/messages/toasts/default |
| `src/utils/markdown.test.ts` | 14 | renderMarkdown + XSS 加固（协议白名单/双引号注入防护）|
| `src/services/api.test.ts` | 13 | `buildAPIHistory`（7：含超长历史截断）+ `streamChat` 流式调用层（6：正常流/非200/无body/JSON失败/abort透传/网络错误）|
| `src/services/discussionEngine.test.ts` | 9 | 编排引擎：正常完成/reset/skip/paused/未配Key/interject/模拟vs真实/空模型状态 |
| `src/services/simulator.test.ts` | 8 | generateSimReply（simulatorId 匹配 + 缺失回退）|
| `src/utils/sleep.test.ts` | 7 | sleep + genId |
| `src/utils/sse.test.ts` | 6 | parseSSEStream（多条/跨chunk/非data行/DONE/空流/前缀切片）|
| `src/store/loadModels.test.ts` | 4 | localStorage 迁移（无存储/新key/legacy迁移/损坏数据回退）|
| `src/utils/escape.test.ts` | 4 | escapeHtml（纯字符串映射实现）|

---

## 4. 端到端测试（10 条）

> 使用 Playwright MCP 驱动浏览器执行（本地 dev server `http://localhost:5173`），覆盖核心 UI、模拟讨论流程、讨论控制时序、XSS 防护、localStorage 持久化 5 类高风险区域。用例详情与记录见 `.trae/documents/e2e-test-handoff.md`（原「后端集成」F 套件已随后端移除作废）。

---

## 5. 运行命令

### 5.1 单元测试

```bash
# 前端
cd frontend && npm run test:run        # 一次性运行所有用例
cd frontend && npm test                # watch 模式
cd frontend && npm run test:run -- src/services/api.test.ts  # 单文件

# 一键质量门禁（推荐提交前运行）
make verify
# Windows 无 make 时等价命令：
# cd frontend && npm run test:run && npm run typecheck && npm run build
```

### 5.2 端到端测试

```bash
# 启动前端 dev server
cd frontend && npm run dev
# 通过 Playwright MCP 执行 §4 用例
```

### 5.3 提交前检查清单

- [ ] `npm run typecheck` 通过（TS 严格模式）
- [ ] `npm run test:run` 全部通过
- [ ] `npm run build` 成功
- [ ] 端到端测试核心路径通过（B1/B2/C1/C3）
- [ ] 已获用户确认（禁止未经确认的提交）

等价快捷方式：`make verify` 一键全检通过（pre-commit hook 自动执行 test + typecheck，失败阻止提交）。

---

## 6. 测试设计原则

1. **纯函数优先**：可确定性的纯函数（tokenize/jaccard/reducer/parseSSEStream/renderMarkdown）有完整测试覆盖，且带测试的修复未再回归。
2. **编排引擎可测**：讨论编排抽到 class-based `DiscussionEngine` 后，控制状态 private、副作用经 4 个回调出口，测试只需 mock 回调与 services 模块即可覆盖 start/pause/skip/reset/interject 等核心路径（此前因闭包 + ref 时序不可测，见 `discussionEngine.test.ts`）。
3. **流式调用层对称**：`streamChat` / `directStreamAnalysis` 共用 `parseSSEStream`（`utils/sse.ts`），底层跨 chunk / 前缀过滤 / `[DONE]` 由 `sse.test.ts` 单独覆盖（SSE 相关用例从 api/analyzer 测试迁移而非叠加）。
4. **e2e 聚焦核心路径**：聚焦讨论流程、控制时序、XSS 防护、持久化 4 类高风险区域（后端集成已移除）。
5. **XSS 防护三层验证**：单元测试（markdown.test.ts + escape.test.ts）+ e2e（动态 import 模块）+ 代码审查（index.html 与 React 版对齐）。
