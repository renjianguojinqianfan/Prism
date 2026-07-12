# 棱镜 (Prism) 测试指南

> 本文档描述 Prism 项目的测试体系：单元测试、端到端测试、质量门禁。
> 最后更新：2026-07-12

---

## 1. 测试体系概览

| 层级 | 工具 | 用例数 | 覆盖范围 |
|------|------|--------|----------|
| 前端单元测试 | vitest + jsdom | 105 | 纯函数、reducer、SSE 流式调用层、localStorage 迁移、XSS 防护 |
| 后端单元测试 | pytest + asyncio | 63 | analyzer 解析、heuristic 启发式、config、API 路由、SSE 流式 |
| 端到端测试 | Playwright MCP | 10 | 核心 UI、讨论流程、讨论控制、XSS 防护、持久化、后端集成 |
| 质量门禁 | Makefile | - | `make verify` 一键全检 |

---

## 2. 测试基建

### 2.1 前端

- **配置文件**：`frontend/vitest.config.ts`
- **环境**：jsdom + globals: true + react 插件
- **测试文件约定**：与源码同目录 `*.test.ts`，`describe/it` 中文描述
- **mock 策略**：`vi.stubGlobal('fetch', ...)` + `ReadableStream` 构造 SSE 分块（行尾用 `\n\n` 对齐后端标准 SSE 格式）；`vi.stubGlobal('localStorage', ...)` 提供内存版（规避 Node 22 内置 localStorage API 不完整）

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
})
```

### 2.2 后端

- **配置文件**：`backend/pytest.ini`（`asyncio_mode=auto`）
- **fixture**：`backend/tests/conftest.py`
  - `client`：同步 TestClient，覆盖 `/api/health` 与 `/api/analyze`
  - `patch_analyzer_keys`：设置/清空 `PRISM_ANALYZER_API_KEYS` 环境变量

### 2.3 端到端测试

- **工具**：Playwright MCP（通过 Trae MCP 集成，`playwright_navigate` / `playwright_evaluate` / `playwright_click` / `playwright_fill` / `playwright_screenshot`）
- **前置条件**：
  1. 前端 dev server：`cd frontend && npm run dev`（端口 5173）
  2. 后端 server：`cd backend && uvicorn main:app --port 8000`
  3. 每条测试前通过 `playwright_evaluate` 执行 `localStorage.clear()` + 刷新页面重置状态

---

## 3. 单元测试

### 3.1 前端单元测试（105 用例）

| 测试文件 | 用例数 | 覆盖范围 |
|----------|--------|----------|
| `src/services/api.test.ts` | 14 | `buildAPIHistory`（6）+ `streamChat` 流式调用层（8：正常流/跨buffer/非200/无body/非data行/JSON失败/abort透传/网络错误）|
| `src/services/analyzer.test.ts` | 35 | `_isCjk`/`tokenize`/`jaccard`/`localHeuristicAnalyze` 纯函数（24）+ `streamAnalysis`（7：final/fallback/非200/无body/跨buffer/畸形行/仅delta）+ `fetchAnalysis`（4：ok/非ok/无tags/网络异常）|
| `src/store/reducer.test.ts` | 20 | reducer 纯函数：models/discussion control/messages/toasts/default |
| `src/utils/markdown.test.ts` | 14 | renderMarkdown + XSS 加固（协议白名单/双引号注入防护）|
| `src/utils/escape.test.ts` | 4 | escapeHtml（含引号转义）|
| `src/store/loadModels.test.ts` | 4 | localStorage 迁移（无存储/新key/legacy迁移/损坏）|
| `src/services/simulator.test.ts` | 8 | generateSimReply |
| `src/utils/sleep.test.ts` | 6 | sleep + genId |

### 3.2 后端单元测试（63 用例）

| 测试文件 | 用例数 | 覆盖范围 |
|----------|--------|----------|
| `tests/test_analyzer.py` | 21 | analyze 解析、_parse_label_json、SSE 流式生成 |
| `tests/test_heuristic.py` | 25 | 启发式分析、tokenize、jaccard、阈值边界 |
| `tests/test_api_stream.py` | 7 | `/api/analyze/stream` SSE 端点（no_key 回退/正常自评/跨块边界）|
| `tests/test_config.py` | 8 | 配置读取、PRISM_ANALYZER_API_KEYS 解析 |
| `tests/test_api.py` | 2 | `/api/health` + `/api/analyze` 空消息 |

---

## 4. 端到端测试（10 条）

> 使用 Playwright MCP 驱动浏览器执行。每条测试记录通过/失败。

### A. 基础 UI 与配置

#### A1 空状态首次加载
- **前置**：无模型配置（localStorage 空）
- **步骤**：`playwright_navigate` 到 `http://localhost:5173/`
- **断言**：页面含"配置模型"提示；设置面板自动展开（models.length===0）；显示推荐话题；"0位参与者"
- **状态**：PASS

#### A2 添加 DeepSeek 模板
- **前置**：A1 空状态
- **步骤**：点击 "+ DeepSeek" 按钮
- **断言**：模型卡片出现；显示"未配置"徽章；参与者变为"1位参与者"
- **状态**：PASS

### B. 模拟模式讨论流程

#### B1 单模型单轮讨论
- **前置**：1个 DeepSeek 模型 + 模拟模式 + maxRounds=1
- **步骤**：填入话题"测试话题" + 点击"发起" + 等待 4s
- **断言**：消息序列含"讨论话题：测试话题" -> user 话题 -> DeepSeek 第1轮发言 -> "讨论结束"；控制按钮（暂停/跳过/重置）消失
- **状态**：PASS

#### B2 双模型单轮讨论+标签
- **前置**：2个模型（DeepSeek + Kimi）+ maxRounds=1
- **步骤**：填入话题"双模型测试" + 发起 + 等待 6s
- **断言**：DeepSeek 与 Kimi 依次发言；第二条发言有标签（consensus/divergence/neutral）；标签 analyzer 为"本地启发式"（后端无 API Key 走 Jaccard 回退）；"讨论结束"
- **状态**：PASS

### C. 讨论控制时序

#### C1 暂停/继续
- **前置**：双模型 + 模拟模式
- **步骤**：发起讨论 -> 等 400ms -> 点击"暂停" -> 等 2s 记录内容长度 -> 点击"继续"
- **断言**：暂停时内容长度不变（567=567）；按钮从"暂停"切换为"继续"
- **状态**：PASS

#### C3 重置
- **前置**：讨论进行中
- **步骤**：发起讨论 -> 等 600ms -> 点击"重置" -> 等 800ms
- **断言**：消息清空（"讨论话题"消失）；控制按钮消失；"发起"按钮重现；toast 含"已重置"
- **状态**：PASS

### D. XSS 防护

> 通过 `playwright_evaluate` 动态 `import('/src/utils/markdown.ts')` 直接调用 `renderMarkdown`，验证输出 HTML。

#### D1 javascript 链接拦截
- **输入**：`[click](javascript:alert(1))`
- **断言**：输出不含 `javascript:`；`href=""` 置空
- **状态**：PASS

#### D2 script 标签转义 + 属性注入阻断
- **输入**：`<script>alert(1)</script>` 和 `[x](<https://evil.com" onmouseover="alert(1)>)`
- **断言**：`<script>` 转义为 `&lt;script&gt;`；输出不含 `onmouseover` 独立属性
- **状态**：PASS

### E. 数据持久化

#### E1 localStorage 保存持久化
- **前置**：2个模型已配置
- **步骤**：点击"保存配置" -> 刷新页面
- **断言**：保存后 `localStorage.prism_models` 含 2 个模型；刷新后页面仍显示 DeepSeek + Kimi；"2位参与者"
- **状态**：PASS

### F. 后端集成

#### F1+F2 health + analyze 端点
- **步骤**：`fetch('http://localhost:8000/api/health')` + `fetch('/api/analyze', {method:POST, body: 2条相同消息})`
- **断言**：health 返回 `{status:"ok"}`；analyze 返回 tags 数组（2个 consensus 标签，含 score）
- **状态**：PASS

---

## 5. 运行命令

### 5.1 单元测试

```bash
# 前端
cd frontend && npm run test:run        # 一次性运行所有用例
cd frontend && npm test                # watch 模式
cd frontend && npm run test:run -- src/services/api.test.ts  # 单文件

# 后端
cd backend && pytest
cd backend && pytest tests/test_analyzer.py  # 单文件

# 一键质量门禁（推荐提交前运行）
make verify
# Windows 无 make 时等价命令：
# cd frontend && npm run test:run && npm run typecheck && npm run build && cd ../backend && pytest
```

### 5.2 端到端测试

```bash
# 1. 启动前端 dev server
cd frontend && npm run dev

# 2. 启动后端 server
cd backend && uvicorn main:app --port 8000

# 3. 通过 Playwright MCP 执行测试
#    在 Trae 中启用 Playwright MCP，按 §4 用例逐条执行
```

### 5.3 提交前检查清单

- [ ] `npm run typecheck` 通过（TS 严格模式）
- [ ] `npm run test:run` 全部通过
- [ ] `npm run build` 成功
- [ ] `pytest` 通过
- [ ] 端到端测试核心路径通过（B1/B2/C1/C3）
- [ ] 已获用户确认（禁止未经确认的提交）

等价快捷方式：`make verify` 一键全检通过。

---

## 6. 测试设计原则

1. **纯函数优先**：可确定性的纯函数（tokenize/jaccard/reducer/renderMarkdown）有完整测试覆盖，且带测试的修复未再回归。
2. **流式调用层对称**：前端 streamChat/streamAnalysis 与后端 test_api_stream.py 对称覆盖，SSE mock 行尾用 `\n\n` 对齐后端实际输出，防止单侧回归与 wire format 漂移。
3. **e2e 聚焦核心路径**：不追求全覆盖，聚焦讨论流程、控制时序、XSS 防护、持久化、后端集成 5 类高风险区域。
4. **XSS 防护三层验证**：单元测试（markdown.test.ts）+ e2e（动态 import 模块）+ 代码审查（index.html 对齐 React 版）。
5. **讨论编排暂排除单测**：runDiscussion/generateResponse 依赖 Math.random/setTimeout/useRef 时序，非确定性高，标记需人工复查。token 竞态校验可后续抽纯函数后补测。
