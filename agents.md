# AGENTS.md - 棱镜 (Prism)

> 本文件为 AI 编程助手的核心指令集，优先级高于所有口头约定。
> 深层上下文（文件清单、架构、约定）见 [docs/context.md](docs/context.md)。
> 跨会话状态见 [.harness/progress.json](.harness/progress.json)。

## 1. 项目快照

- **项目名称**：棱镜 (Prism)
- **一句话描述**：多 AI 讨论台。用户提问后，用户自填的多个 AI 模型依次参与讨论，每条发言由发言者自己的 LLM 做共识/分歧自评（实时流式）。
- **项目类型**：`web`（前后端分离 SPA + 轻量 FastAPI 后端）
- **技术栈**：
  - 前端：React 18 + TypeScript（strict）+ Vite + Tailwind CSS；状态管理用 Context + useReducer；Markdown 渲染用 marked
  - 后端：FastAPI（`backend/` 分层包）+ httpx（3 个端点详见 [docs/context.md](docs/context.md#34-后端-api-端点)）
  - 模型调用：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过

## 2. 常用命令

```bash
# 前端开发
cd frontend && npm install
npm run dev          # 开发服务器 → http://localhost:5173
npm run test:run     # vitest 一次性运行所有用例（npm test 进入 watch 模式）
npm run typecheck    # TS 严格模式检查（提交前必须通过）
npm run build        # 构建（tsc + vite 打包，产物在 frontend/dist/）

# 后端开发
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pip install -r requirements-dev.txt && pytest

# 一键质量门禁（推荐提交前运行）
make verify
# Windows 无 make 时的等价命令：
# cd frontend && npm run test:run && npm run typecheck && cd ../backend && pytest
```

## 3. 目录结构（概要）

- `frontend/` — React+TS 前端主版本（日常开发目录）
- `backend/` — FastAPI 后端（分层：`app/main` + `app/services` + `app/api` + `tests`）
- `index.html` — 单 HTML 原型（演示 demo，**禁止删除**）
- `docs/context.md` — 深层上下文（完整文件清单、架构、约定）
- `.harness/progress.json` — 跨会话状态记录
- `Makefile` — 质量门禁命令
- `.trae/specs/` — Spec 驱动开发的规格文档

**详细文件清单与架构说明见 [docs/context.md](docs/context.md)。**

## 4. 关键约定

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
- 禁止删除根目录 `index.html`（早期原型，作为演示 demo 保留）
- 禁止在前端引入除 marked 之外的大型依赖（如 UI 组件库、图表库）除非用户明确要求

## 5. 行为边界

- ✅ **允许**：修改 `frontend/src/` 与 `backend/app/` 下代码；运行测试与类型检查；编写单元测试
- ⚠️ **需确认**：改代码前必须先说明计划并获用户确认；提交代码前必须获用户确认；修改 `package.json` / `requirements.txt` 依赖；修改阈值（前后端必须同步）
- 🚫 **禁止**：见第 4 章"禁止事项"全部条目

## 6. 完成定义（Definition of Done）

一个任务真正"完成"的标志（全部满足）：

1. `npm run typecheck` 通过（前端，如涉及前端改动）
2. `npm run test:run` 全部通过（前端，如涉及前端改动）
3. `npm run build` 成功（前端，如涉及构建改动）
4. `pytest` 通过（后端，如涉及后端改动）
5. 已获用户确认（**禁止未经确认的提交**）

等价快捷方式：`make verify` 一键全检通过。

## 7. Git 提交规范

- commit message 格式：`<type>: <描述>`
- type 可选：`feat` / `fix` / `style` / `refactor` / `docs` / `chore`
- 描述用中文，一句话说清改动
- 示例：`feat: 迁移至 React+TypeScript`
- **分批次多次小步提交**：每个逻辑独立的小改动单独一个 commit，不要把多个不相关的修复堆在一个 commit 里
- **禁止提交未经用户确认的代码**
