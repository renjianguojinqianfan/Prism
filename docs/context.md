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

## 2. 架构说明

### 2.1 模型调用流程

- **发言用模型调用**：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过
- **发言用 API Key 管理**：通过用户输入 + localStorage 持久化（key: `prism_models`，自动迁移自 `aiRoundtable_models`）
- **自定义模型**：在设置面板中添加 endpoint、model、apiKey、systemPrompt
- **分析（共识/分歧自评）**：前端直连模型 API，复用发言 Key，不经过后端

### 2.2 分析 Key 管理

分析复用发言 Key，前端直连模型 API，不经过后端。原 C1 修复的 SSRF/Key 泄漏威胁因后端退出调用链而消除。

### 2.3 共识/分歧分析路径

- **主路径**：前端直连 LLM 自评（流式 SSE）
- **回退路径**：前端 Jaccard 启发式分析（自评失败时回退，见 `frontend/src/services/analyzer.ts` 的 `localHeuristicAnalyze`）
- **阈值**：Jaccard 回退路径的阈值（当前 HIGH=0.14, LOW=0.11）仅在前端一份，见 `frontend/src/services/analyzer.ts`

## 3. CI/CD架构

### 3.1 GitHub Actions

- **CI**（`.github/workflows/ci.yml`）：push / PR 到 main 时触发，运行前端 typecheck + test + build，权限最小化 `permissions: contents: read`
- **CodeQL**（`.github/workflows/codeql.yml`）：push / PR 到 main 时触发，扫描 TypeScript 代码漏洞

### 3.2 Dependabot

- **配置文件**：`.github/dependabot.yml`
- **两生态**：npm（`/frontend`）/ github-actions（`/`）
- **策略**：每周一检查，最多 5 个 PR，忽略 major 版本升级，commit 前缀 `chore`

### 3.3 质量门禁

- **Makefile** `verify` 目标：test:run + typecheck + build
- **pre-commit hook**（`.githooks/pre-commit`）：提交前运行前端 `test:run` + `typecheck`
- **commit-msg hook**（`.githooks/commit-msg`）：校验 commit message 格式（`<type>(<scope>): <subject>`）

### 3.4 发版流程

发版相关文档位于 `.trae/documents/`：

- `release-workflow.md` - 完整发版流程
- `release-doc-checklist.md` - 文档检查清单
- `release-e2e-test.md` - 端到端测试方法
- `release-checklist-record.md` - 发版检查记录模板
