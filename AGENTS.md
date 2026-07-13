# AGENTS.md - 棱镜 (Prism)

> 本文件为 AI 编程助手的核心指令集，优先级高于所有口头约定。
> 深层上下文（架构、约定）见 [docs/context.md](docs/context.md)。

## 1. 项目快照

- **项目名称**：棱镜 (Prism)
- **一句话描述**：多 AI 讨论台。用户提问后，用户自填的多个 AI 模型依次参与讨论，每条发言由发言者自己的 LLM 做共识/分歧自评（实时流式）。
- **项目类型**：`web`（纯前端 SPA）
- **技术栈**：
  - React 18 + TypeScript（strict）+ Vite + Tailwind CSS；状态管理用 Context + useReducer；Markdown 渲染用 marked
  - 模型调用：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），发言与分析均前端直连，未配 Key 的模型自动跳过

## 2. 常用命令

```bash
# 前端开发
cd frontend && npm install
npm run dev          # 开发服务器 → http://localhost:5173
npm run test:run     # vitest 一次性运行所有用例（npm test 进入 watch 模式）
npm run typecheck    # TS 严格模式检查（提交前必须通过）
npm run build        # 构建（tsc + vite 打包，产物在 frontend/dist/）

# 一键质量门禁（推荐提交前运行）
make verify
# Windows 无 make 时的等价命令：
# cd frontend && npm run test:run && npm run typecheck && npm run build
```

## 3. 目录结构（概要）

- `frontend/` - React+TS 前端主版本（日常开发目录）
- `index.html` - 单 HTML 原型（演示 demo，**禁止删除**）
- `docs/context.md` - 深层上下文（架构、约定）
- `.githooks/` - Git hooks（commit-msg + pre-commit，通过 `core.hooksPath` 配置）
- `Makefile` - 质量门禁命令
- `.github/` - CI/CD 配置（GitHub Actions workflows + Dependabot）
- `.trae/specs/` - Spec 驱动开发的规格文档
- `.trae/documents/` - 发版流程等规划文档

## 4. 关键约定

### 必须遵守
- **改代码前先说明计划**：不得直接改代码，必须先向用户确认方案
- **一个对话 = 一个任务**：不混杂多个不相关的改动
- **TypeScript 严格模式**：`frontend/tsconfig.json` 开启 `strict`、`noUnusedLocals`、`noUnusedParameters`，新增代码必须通过 `npm run typecheck`
- **UI 风格锁定**：深色赛博朋克主题（`App.css` 中的 CSS 变量 `--bg/--fg/--accent` 等），全局动效（背景光、浮动光点、发言脉冲、消息入场、打字光标）不得擅自移除或改色
- **无第三方状态库**：状态统一在 `DiscussionContext.tsx` 中用 `useReducer`+`useRef` 管理，不要引入 Redux/Zustand/Jotai 等
- **组件拆分原则**：按现有目录约定放置，新增组件放 `frontend/src/components/`，纯逻辑放 `services/` 或 `utils/`，类型集中在 `store/types.ts`
- **禁止硬编码密钥**：发言和分析用 API Key 均通过用户输入 + localStorage 持久化，前端直连模型 API，Key 不经过服务器

### 禁止事项
- 禁止提交未经用户确认的代码
- 禁止在前端引入除 marked 之外的大型依赖（如 UI 组件库、图表库）除非用户明确要求
- 禁止执行 `git push`，除非用户在单次对话中明确提出 push

## 5. 行为边界

- ✅ **允许**：修改 `frontend/src/` 下代码；运行测试与类型检查；编写单元测试
- ⚠️ **需确认**：修改 `package.json` 依赖

## 6. 完成定义（Definition of Done）

一个任务真正"完成"的标志（全部满足）：

1. `npm run typecheck` 通过（如涉及前端改动）
2. `npm run test:run` 全部通过（如涉及前端改动）
3. `npm run build` 成功（如涉及构建改动）
4. 已获用户确认（**禁止未经确认的提交**）

等价快捷方式：`make verify` 一键全检通过（test + typecheck + build）。

## 7. 上下文维护

每次开发完成后，必须检查以下文件是否需要同步：

- **AGENTS.md** - 行为边界、约定、命令等有变化时更新
- **docs/context.md** - 架构说明有变化时同步（文件清单不再手动维护，直接用 Glob/LS 扫描）

Git hooks 位于 `.githooks/` 目录（通过 `core.hooksPath` 配置），自动执行质量门禁，无需手动维护：

- `pre-commit` - 提交前运行前端 `test:run` + `typecheck`，失败阻止提交
- `commit-msg` - 校验 commit message 格式（`<type>(<scope>): <subject>`），不符合阻止提交

## 8. Git 提交规范

- commit message 格式：`<type>(<scope>): <subject>`
- type 可选：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`
- scope（可选）：标识改动范围，如 `analyzer` / `context` / `hooks` / `ci` 等
- subject 用中文，一句话说清改动
- 示例：`feat(analyzer): 迁移至前端直连分析`
- **分批次多次小步提交**：每个逻辑独立的小改动单独一个 commit，不要把多个不相关的修复堆在一个 commit 里
