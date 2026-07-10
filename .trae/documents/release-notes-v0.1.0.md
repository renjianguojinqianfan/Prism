# 棱镜 (Prism) v0.1.0 Release Notes

**发布日期**：2026-07-10
**版本号**：v0.1.0（首次正式 release）
**Tag 名**：`v0.1.0`
**总提交数**：58 commits

---

## 项目简介

棱镜 (Prism) 是一个多 AI 讨论台。用户提问后，用户自填的多个 AI 模型依次参与讨论，每条发言由发言者自己的 LLM 做共识/分歧自评（实时流式 SSE）。

- **项目类型**：前后端分离 SPA + 轻量 FastAPI 后端
- **技术栈**：
  - 前端：React 18 + TypeScript（strict）+ Vite + Tailwind CSS；状态管理用 Context + useReducer；Markdown 渲染用 marked
  - 后端：FastAPI（分层架构）+ httpx
- **模型调用**：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过

---

## 功能特性

### 核心功能

- **多 AI 讨论台**：用户配置多个 AI 模型，提问后各模型依次发言参与讨论
- **流式 SSE 发言**：浏览器端直连 OpenAI 兼容 API，实时流式渲染每条发言
- **共识/分歧自评**：每条发言由发言者自己的 LLM 评估与历史观点的共识或分歧关系
- **SSE 流式分析**：自评结果通过后端 `POST /api/analyze/stream` 实时流式返回
- **三级回退机制**：发言者自评 LLM → Jaccard 启发式分析 → 默认标签，保证分析链路不中断
- **多轮讨论**：支持多轮循环讨论，每轮基于完整历史上下文
- **模拟模式**：未配置 API Key 时可使用内置模拟器体验完整讨论流程
- **预设模型**：内置 5 个快速添加模板（主流 AI 模型）
- **自定义模型**：在设置面板中添加 endpoint、model、apiKey、systemPrompt
- **深色赛博朋克主题**：全局动效（背景光、浮动光点、发言脉冲、消息入场、打字光标）

### 后端 API 端点

- `GET /api/health` — 健康检查
- `POST /api/analyze` — Jaccard 同步回退分析
- `POST /api/analyze/stream` — 发言者自评 SSE 流式分析

---

## 安全加固

### 漏洞修复

- **XSS 防护**：marked HTML 转义，防止 Markdown 注入恶意脚本
- **Markdown 链接协议白名单**：限制 `href` 允许的协议，防止 `javascript:` 等协议注入
- **Markdown 链接/图片 href 转义**：防止通过属性注入绕过 XSS 防护
- **escapeHtml 增强**：增加双引号和单引号转义，堵住属性注入入口
- **SSRF 修复 + Key 泄漏修复（C1）**：发言者自评的 endpoint 与 API Key 改由后端环境变量 `PRISM_ANALYZER_API_KEYS` 统一管理，前端只传 model 名，不传 endpoint 也不传 Key
- **CORS 收紧**：修复 CORS 配置过于宽松问题，限定允许的来源

### 安全工程化

- **Dependabot 配置**：三生态（npm / pip / github-actions）每周自动检查依赖更新，忽略 major 版本
- **CI 权限最小化**：GitHub Actions workflow 设置 `permissions: contents: read`
- **CodeQL 代码安全扫描**：覆盖 TypeScript + Python 双语言，push 和 PR 均触发

---

## 依赖升级

### 前端

| 依赖 | 升级前 | 升级后 | 说明 |
|------|--------|--------|------|
| vite | 5.x | 8.1.4 | 消除 esbuild 漏洞链（1 critical + 1 high + 2 moderate） |
| vitest | 1.x | 4.1.10 | 配合 vite 升级 |
| @vitejs/plugin-react | 4.x | 6.0.3 | 配合 vite 升级 |

### 后端

| 依赖 | 升级前 | 升级后 | 说明 |
|------|--------|--------|------|
| fastapi | >=0.110 | >=0.139.0 | Dependabot security update (#6) |
| pydantic | >=2.5 | >=2.13.4 | Dependabot security update (#10) |
| uvicorn[standard] | >=0.27 | >=0.51.0 | 安全升级 |
| respx | >=0.21 | >=0.23.1 | Dependabot security update (#8) |
| pytest-asyncio | >=0.23 | >=1.4.0 | 安全升级 |

---

## 工程化与 CI/CD

- **GitHub Actions CI**：自动运行前后端测试（push / PR 触发）
- **CodeQL 安全扫描**：TypeScript + Python 双语言静态分析
- **Dependabot**：三生态依赖自动更新监控
- **Makefile 质量门禁**：`make verify` 一键运行 typecheck + test + build + pytest
- **Git Hooks**：pre-commit 自动运行质量门禁，commit-msg 校验提交信息格式
- **后端分层架构**：`app/main` + `app/api` + `app/services` + `app/config` + `app/schemas` + `tests`
- **AGENTS.md 规范**：AI 编程助手核心指令集，含行为边界、完成定义、上下文维护规范

---

## 测试覆盖

| 维度 | 测试框架 | 测试文件数 | 用例数 | 状态 |
|------|----------|-----------|--------|------|
| 前端 | vitest + jsdom | 7 | 82 | 全部通过 |
| 后端 | pytest + respx | 5 | 63 | 全部通过 |

前端测试覆盖：services（analyzer / api / simulator）、store（reducer）、utils（escape / markdown / sleep）

后端测试覆盖：heuristic（Jaccard 分析）、analyzer（流式自评）、config（配置加载）、api_stream（SSE 流式端点）

---

## 质量状态

- `npm run typecheck`：通过（TypeScript strict 模式）
- `npm run test:run`：82/82 通过
- `npm run build`：成功
- `pytest`：63/63 通过
- CI：GitHub Actions 自动跑前后端测试
- 安全扫描：CodeQL + Dependabot 已配置

---

## 已知问题

- 分析 Key 需通过后端环境变量 `PRISM_ANALYZER_API_KEYS` 配置（JSON 字符串格式），未配置时自动回退至 Jaccard 启发式分析
- Jaccard 回退路径阈值（HIGH=0.14, LOW=0.11）前后端需保持一致，修改时需同步 `frontend/src/services/analyzer.ts` 与 `backend/app/config.py`

---

## 完整 Changelog（58 commits）

### Features (7)

- `474e56e` feat: 棱镜核心功能改造完成
- `9091c1a` feat: 真实共识/分歧分析 + FastAPI后端骨架
- `72a8d8c` feat: 模拟模式多轮连贯对话 + Markdown 渲染 + 文档同步
- `f4ec5fe` feat: 前端迁移至 React+TypeScript(Vite)，修复模拟模式连贯性bug，同步文档
- `4fa7f56` feat: 共识/分歧分析升级为发言者自评+SSE流式+三级回退，修复SSRF与Key泄漏漏洞(C1)
- `5f8c2cc` feat: 原型HTML功能对齐React版 + 精简readme
- `9b88a81` feat: 原型HTML模拟模式同步React版调用后端Jaccard并提示本地分析

### Bug Fixes (7)

- `fed0562` fix: 修复XSS安全漏洞（marked HTML转义）和CORS配置过于宽松问题
- `2095d8f` fix: 代码审查问题修复（定时器清理/响应体防御检查/localStorage键迁移/前后端分析逻辑一致/useCallback优化）
- `a8ab5a8` fix: 原型 index.html 与 React 版对齐（XSS防护/localStorage迁移/响应体防御检查/停用词统一）
- `9cb3942` fix: 移除原型HTML讨论结束时批量分析对LLM自评标签的覆盖
- `0d06521` fix: 修复讨论循环三个编排缺陷（历史污染/跳过/思考中状态）
- `94ba933` fix: streamAnalysis/fetchAnalysis 超时覆盖流式读取阶段
- `6b4a6d4` fix: 讨论循环引入 token 防并发 + streamChat 超时兜底

### Security Fixes (4)

- `0ffd1a9` fix: Markdown 链接协议白名单防 XSS
- `37caac4` fix: escapeHtml 增加双引号和单引号转义
- `7fc3a3a` fix: Markdown 链接/图片 href 转义防 XSS 属性注入
- `66b838e` fix: make verify 添加 build 步骤并同步文档

### Refactoring (2)

- `088da1c` refactor!: 将 main.py 拆分为 backend/ 分层架构
- `3a10313` refactor: 导出 analyzer/reducer 内部函数以支持单元测试（零行为变化）

### Tests (4)

- `ee4a3af` test: 添加 backend pytest 脚手架与示例测试
- `5e787f8` test: 搭建前端 vitest 测试基础设施（jsdom + globals）
- `1cc48dc` test: 扩展后端测试覆盖至 63 用例（analyzer/config/api_stream）
- `a89bc77` test: 添加前端 75 个单元测试（services/store/utils）

### Security Hardening (3)

- `de5deb4` chore: 添加 dependabot 版本更新配置
- `8ad5080` chore: CI workflow 权限最小化
- `c24f658` chore: 添加 CodeQL 代码安全扫描

### Dependency Upgrades (7)

- `a9fb178` chore: 升级 vite 5->7 和 vitest 1->4 消除 esbuild 漏洞
- `c5c382d` chore: 升级 vite 7->8 和 @vitejs/plugin-react 4->6
- `570c64a` chore: update respx requirement from >=0.21 to >=0.23.1 in /backend (#8)
- `7201fb4` chore: update pydantic requirement from >=2.5 to >=2.13.4 in /backend (#10)
- `2e5395e` chore: update fastapi requirement from >=0.110 to >=0.139.0 in /backend (#6)
- `aa31a76` chore: 升级 uvicorn 版本下限至 0.51.0
- `5bca22a` chore: 升级 pytest-asyncio 版本下限至 1.4.0

### CI/CD & Tooling (8)

- `02303b5` chore: 添加 render.yaml 后端部署蓝图
- `9b6ae66` chore: 添加 Procfile 供 Railway 识别 FastAPI 启动命令
- `ad425ea` chore: 移除 Procfile 和 render.yaml 部署配置文件
- `22ca797` chore: 新增 Makefile 统一质量门禁命令
- `18d3bca` chore: 新增 .harness/progress.json 跨会话状态记录
- `1eb8bd4` chore: 删除 progress.json 并精简 context.md 移除文件清单
- `cf8c231` chore: 新增 GitHub Actions CI 自动跑前后端测试
- `ed43243` chore: 将 agents.md 和 readme.md 重命名为大写

### Documentation (14)

- `5c5754a` docs: 同步 readme 与 agents 文档与代码现状
- `24cc075` docs: 同步 readme 与代码现状并补充快速演示章节
- `e395f72` docs: 重写 spec 反映 React迁移/SSE流式/LLM分析等已落地能力并规划 P1 观点图谱
- `ce6d020` docs: 在 tasks.md 记录 esbuild/vite 开发服务器漏洞为 P2 待办
- `30eb423` docs: 同步 AGENTS.md 与 readme 指向 backend/ 分层结构
- `4ba0a50` docs: 归档后端分层重构计划与历史任务文档
- `9fe392c` docs: 同步 agents/readme 测试基础设施与原型 demo 定位
- `8c0982c` docs: 新增 context.md 承接 AGENTS.md 迁出的文件清单与架构说明
- `5983196` docs: AGENTS.md 对齐 PBH 标准（精简文件清单+补全行为边界与完成定义）
- `c520f3c` docs: AGENTS.md Git 提交规范补充小步提交原则
- `59437f1` docs: 同步 context.md 文件描述与 progress.json 跨会话状态
- `8644e24` docs: AGENTS.md 新增第7章上下文维护规范
- `df6cc25` docs: AGENTS.md 更新上下文维护章节移除 progress.json 引用
- `efdcc3e` docs: 删除 AGENTS.md 中 9 处内部冗余指令

### Initial Commit (2)

- `62dd2e3` Initial commit (agents.md, lengjing.html)
- `0d6b91f` new file: readme.md
