# Prism AGENTS.md 对齐 PBH 标准改造计划

> **历史文档**：以下内容反映创建时的状态。后续变更：
> - 前端测试从 75 增长至 82 个用例
> - Makefile verify 已添加 build 步骤
> - `.harness/progress.json` 已删除，改用 `.trae/` 目录
> - 当前以 AGENTS.md 实际内容为准

> 参考标准：[Project-Bootstrap-Harness (PBH)](https://github.com/renjianguojinqianfan/Project-Bootstrap-Harness)
> 改造范围：完整 PBH 基础设施（AGENTS.md 重构 + docs/context.md + .harness/progress.json + Makefile）
> 语言：中文（保持现有风格）

---

## 一、现状分析

### 1.1 当前 AGENTS.md 结构（112 行）

| 章节 | 行数 | 占比 | PBH 评价 |
|------|------|------|----------|
| 1. 项目快照 | 16 行 | 14% | ✅ 符合"项目说明"要求 |
| 2. 关键规则（必须遵守 + 禁止事项） | 18 行 | 16% | ✅ 规则清晰，但缺三级边界结构 |
| 3. 文件清单（前端 + 后端表格） | 55 行 | 49% | ❌ 过于冗长，违反"地图而非百科全书"原则 |
| 4. 开发工作流 | 8 行 | 7% | ⚠️ 命令未用代码块，不便 AI 复制 |
| 5. Git 提交规范 | 6 行 | 5% | ✅ 符合要求 |
| 缺失：完成定义 | — | — | ❌ PBH 强制要求 |
| 缺失：行为边界三级结构 | — | — | ❌ PBH 推荐 |
| 缺失：统一质量门禁命令 | — | — | ❌ PBH 推荐 `make verify` |

### 1.2 主要问题

1. **文件清单冗长**：55 行表格（占全文 49%）属于"项目百科全书"内容，应迁移至 `docs/context.md`
2. **命令未代码块化**：开发工作流用行内格式（`cd frontend && npm run dev`），PBH 最佳实践要求用 fenced code block 便于 AI 直接复制
3. **缺"完成定义"**：PBH 强制要求明确的 Definition of Done（typecheck/test/build 通过 + 用户确认）
4. **边界结构不清晰**：现有"必须遵守"与"禁止事项"二分，PBH 推荐三级结构（✅允许 / ⚠️需确认 / 🚫禁止）
5. **缺配套基础设施**：无 `docs/context.md`（深层上下文）、无 `.harness/progress.json`（跨会话状态）、无 `Makefile`（统一质量门禁）

### 1.3 必须保留的内容（用户明确要求）

- 项目快照（名称、一句话描述、类型、技术栈概要）
- 所有"必须遵守"和"禁止事项"规则**原文**（关键约束，不迁移、不删减）
- 开发工作流（常用命令）
- Git 提交规范
- 中文语言与现有风格

---

## 二、改造方案

### 2.1 新增文件清单

| 文件 | 类型 | 用途 |
|------|------|------|
| `docs/context.md` | 新增 | 承接 AGENTS.md 迁出的文件清单表格 + 深层架构说明 |
| `.harness/progress.json` | 新增 | PBH 跨会话状态记录（AI 新会话第一站） |
| `Makefile` | 新增 | 统一质量门禁：`make verify` = 后端测试 + 前端测试 + 前端类型检查 |
| `AGENTS.md` | 重构 | 精简至 ~80 行，按 PBH 标准章节重组 |

### 2.2 新 AGENTS.md 章节结构（PBH 标准）

```
# AGENTS.md - 棱镜 (Prism)

> 本文件为 AI 编程助手的核心指令集，优先级高于所有口头约定。
> 深层上下文（文件清单、架构、约定）见 [docs/context.md](docs/context.md)。
> 跨会话状态见 .harness/progress.json。

## 1. 项目快照              ← 保留原文（精简技术栈细节到概要级）
## 2. 常用命令              ← 新增：fenced code block，含 make verify
## 3. 目录结构（概要）       ← 精简：仅顶层目录 + 指向 context.md
## 4. 关键约定              ← 保留：必须遵守 + 禁止事项（原文不改动）
## 5. 行为边界              ← 新增：✅允许 / ⚠️需确认 / 🚫禁止 三级结构
## 6. 完成定义              ← 新增：PBH 强制要求的 Definition of Done
## 7. Git 提交规范           ← 保留原文
```

### 2.3 各文件详细改造内容

#### 文件 1：`AGENTS.md`（重构）

**改造目标**：从 112 行精简至 ~80 行，按 PBH 标准章节重组，规则原文不改动。

**具体改动**：

1. **顶部声明**（新增 2 行）
   - 在标题下方增加指向 `docs/context.md` 和 `.harness/progress.json` 的引用

2. **第 1 章 项目快照**（保留，微调）
   - 保留项目名称、一句话描述、项目类型
   - 技术栈保留概要级描述（前端 React+TS+Vite+Tailwind；后端 FastAPI+httpx）
   - 删除过于详细的端点描述（`GET /api/health` 等）→ 迁移至 context.md
   - 目录约定精简为顶层目录列表，详细说明迁移至 context.md

3. **第 2 章 常用命令**（重构为代码块）
   ```bash
   # 前端开发
   cd frontend && npm install
   npm run dev          # 开发服务器 → http://localhost:5173
   npm run test:run     # vitest 一次性运行所有用例
   npm run typecheck    # TS 严格模式检查（提交前必须通过）
   npm run build        # 构建（产物在 frontend/dist/）

   # 后端开发
   cd backend && pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   pip install -r requirements-dev.txt && pytest

   # 一键质量门禁（推荐提交前运行）
   make verify
   # Windows 无 make 时的等价命令：
   # cd frontend && npm run test:run && npm run typecheck && cd ../backend && pytest
   ```

4. **第 3 章 目录结构（概要）**（精简，仅保留顶层）
   - `frontend/` — React+TS 前端主版本（日常开发目录）
   - `backend/` — FastAPI 后端（分层：app/main + services + api + tests）
   - `index.html` — 单 HTML 原型（演示 demo，**禁止删除**）
   - `docs/context.md` — 深层上下文（完整文件清单、架构、约定）
   - `.harness/progress.json` — 跨会话状态记录
   - `Makefile` — 质量门禁命令
   - **详细文件清单见 [docs/context.md](docs/context.md)**

5. **第 4 章 关键约定**（保留原文，不改动）
   - 4.1 必须遵守（保留全部 8 条原文）
   - 4.2 禁止事项（保留全部 5 条原文）

6. **第 5 章 行为边界**（新增，PBH 三级结构）
   - ✅ **允许**：修改 `frontend/src/` 与 `backend/app/` 下代码；运行测试与类型检查；编写单元测试
   - ⚠️ **需确认**：改代码前必须先说明计划并获用户确认；提交代码前必须获用户确认；修改 `package.json` / `requirements.txt` 依赖；修改阈值（前后端必须同步）
   - 🚫 **禁止**：见第 4 章"禁止事项"全部条目

7. **第 6 章 完成定义（Definition of Done）**（新增）
   一个任务真正"完成"的标志（全部满足）：
   1. `npm run typecheck` 通过（前端，如涉及前端改动）
   2. `npm run test:run` 全部通过（前端，如涉及前端改动）
   3. `npm run build` 成功（前端，如涉及构建改动）
   4. `pytest` 通过（后端，如涉及后端改动）
   5. 已获用户确认（**禁止未经确认的提交**）
   - 等价快捷方式：`make verify` 一键全检通过

8. **第 7 章 Git 提交规范**（保留原文）
   - commit message 格式：`<type>: <描述>`
   - type 可选：`feat` / `fix` / `style` / `refactor` / `docs` / `chore`
   - 描述用中文，一句话说清改动
   - 示例：`feat: 迁移至 React+TypeScript`
   - **禁止提交未经用户确认的代码**

#### 文件 2：`docs/context.md`（新增）

**改造目标**：承接从 AGENTS.md 迁出的文件清单表格 + 深层架构说明。

**内容结构**：
```markdown
# Prism 深层上下文 (Context)

> 本文件为 AGENTS.md 的补充，提供完整的文件清单、目录结构与架构说明。
> AI 在需要查找具体文件或理解架构细节时查阅本文件。

## 1. 完整文件清单

### 1.1 前端（frontend/）
（迁移 AGENTS.md 原表格，保留全部 27 行文件描述）

### 1.2 后端（backend/）与根目录
（迁移 AGENTS.md 原表格，保留全部 17 行文件描述）

## 2. 目录结构详解

### 2.1 前端分层
- src/components/ — UI 组件
- src/store/ — 状态管理（Context + useReducer）
- src/services/ — 业务逻辑（API 调用、分析器、模拟器）
- src/utils/ — 工具函数（转义、Markdown、延时）
- src/config/ — 预设模型配置

### 2.2 后端分层
- app/main.py — FastAPI app 实例 + CORS + 路由注册
- app/api/ — 路由层（health / analyze / deps）
- app/services/ — 业务层（heuristic / analyzer）
- app/config.py — 配置层
- app/schemas.py — Pydantic 模型
- tests/ — pytest 测试

## 3. 架构说明

### 3.1 模型调用流程
（迁移 AGENTS.md 中关于浏览器直连 OpenAI 兼容 API 的说明）

### 3.2 分析 Key 管理（C1 修复）
（迁移 AGENTS.md 中关于 PRISM_ANALYZER_API_KEYS 的详细说明）

### 3.3 共识/分歧分析路径
（迁移 AGENTS.md 中关于主路径与 Jaccard 回退的说明）

### 3.4 后端 API 端点
- GET /api/health — 健康检查
- POST /api/analyze — Jaccard 同步回退
- POST /api/analyze/stream — 发言者自评 SSE 流式
```

#### 文件 3：`.harness/progress.json`（新增）

**改造目标**：PBH 跨会话状态记录文件，AI 新会话第一站。

**初始内容**：
```json
{
  "current_stage": "plan",
  "plans": [],
  "last_updated": "2026-07-09T00:00:00Z",
  "project": "Prism",
  "notes": "PBH 基础设施初始化完成，AGENTS.md 已对齐 PBH 标准"
}
```

#### 文件 4：`Makefile`（新增）

**改造目标**：统一质量门禁，`make verify` = 后端测试 + 前端测试 + 前端类型检查。

**内容**：
```makefile
.PHONY: verify test-frontend typecheck-frontend test-backend build-frontend

# 一键质量门禁（推荐提交前运行）
verify: test-frontend typecheck-frontend test-backend
	@echo "✔ 验证通过"

# 前端测试
test-frontend:
	cd frontend && npm run test:run

# 前端类型检查（TS 严格模式）
typecheck-frontend:
	cd frontend && npm run typecheck

# 前端构建（可选，发布前运行）
build-frontend:
	cd frontend && npm run build

# 后端测试
test-backend:
	cd backend && pytest

# 前端开发服务器
dev-frontend:
	cd frontend && npm run dev

# 后端开发服务器
dev-backend:
	cd backend && uvicorn main:app --reload --port 8000
```

**Windows 兼容性说明**（写入 AGENTS.md 第 2 章）：
- Windows 用户若未安装 make，可运行等价命令：
  `cd frontend && npm run test:run && npm run typecheck && cd ../backend && pytest`
- 安装 make：`winget install GnuWin32.Make`

---

## 三、改造前后对比

### 3.1 行数对比

| 文件 | 改造前 | 改造后 | 变化 |
|------|--------|--------|------|
| AGENTS.md | 112 行 | ~80 行 | -32 行（精简 29%） |
| docs/context.md | 0（不存在） | ~90 行 | 新增 |
| .harness/progress.json | 0 | 7 行 | 新增 |
| Makefile | 0 | ~25 行 | 新增 |

### 3.2 PBH 标准对齐情况

| PBH 要求 | 改造前 | 改造后 |
|----------|--------|--------|
| AGENTS.md 作为"地图"而非"百科全书" | ❌ 文件清单占 49% | ✅ 迁出至 context.md |
| 项目说明（概要级） | ✅ | ✅ |
| 常用命令（代码块） | ❌ 行内格式 | ✅ fenced code block |
| 目录结构（概要 + 指向深层文档） | ❌ 详细表格 | ✅ 概要 + 指向 context.md |
| 编码规范/约定 | ✅ | ✅ 保留原文 |
| 行为边界（三级结构） | ❌ 二分 | ✅ ✅允许/⚠️需确认/🚫禁止 |
| 禁止事项 | ✅ | ✅ 保留原文 |
| 完成定义（Definition of Done） | ❌ | ✅ 新增 |
| Git 工作流 | ✅ | ✅ 保留原文 |
| docs/context.md 深层上下文 | ❌ | ✅ 新增 |
| .harness/progress.json 跨会话状态 | ❌ | ✅ 新增 |
| make verify 质量门禁 | ❌ | ✅ 新增 |

---

## 四、假设与决策

### 4.1 假设
1. 项目运行于 Windows 环境（用户系统），Makefile 提供但附 Windows 等价命令
2. 用户已安装 Node.js 与 Python 环境（现有开发工作流已验证）
3. `docs/` 目录不存在，需创建（当前 LS 未发现）
4. `.harness/` 目录不存在，需创建

### 4.2 决策
1. **规则原文不改**：用户明确要求保留所有"必须遵守"和"禁止事项"原文，仅调整章节归属
2. **文件清单迁移不删减**：所有文件描述信息迁移至 context.md，不丢失任何信息
3. **Makefile 优先 Unix 风格**：PBH 标准使用 Unix make，Windows 等价命令写入 AGENTS.md
4. **progress.json 初始化为 plan 阶段**：符合 PBH 初始状态约定
5. **不引入 harness/ 骨架代码**：PBH 的 runner/evaluator/state/workflow 骨架是 Python 项目专用，Prism 是前后端分离项目，不适用，仅采用协议层（AGENTS.md + context.md + progress.json）

---

## 五、验证步骤

### 5.1 改造后自检清单

- [ ] AGENTS.md 行数 ≤ 90 行（PBH 推荐范围）
- [ ] AGENTS.md 包含 7 个章节（项目快照/常用命令/目录结构/关键约定/行为边界/完成定义/Git 规范）
- [ ] AGENTS.md 所有"必须遵守"规则原文保留（8 条）
- [ ] AGENTS.md 所有"禁止事项"规则原文保留（5 条）
- [ ] AGENTS.md 常用命令使用 fenced code block
- [ ] AGENTS.md 包含指向 docs/context.md 的链接
- [ ] AGENTS.md 包含指向 .harness/progress.json 的引用
- [ ] docs/context.md 包含完整的前端文件清单表格（27 行）
- [ ] docs/context.md 包含完整的后端文件清单表格（17 行）
- [ ] docs/context.md 包含目录结构详解与架构说明
- [ ] .harness/progress.json 为有效 JSON 格式
- [ ] Makefile 包含 verify 目标（test-frontend + typecheck-frontend + test-backend）
- [ ] Makefile 包含 .PHONY 声明

### 5.2 功能验证

1. **AGENTS.md 可读性**：AI 新会话能仅凭 AGENTS.md 理解项目概要与规则
2. **context.md 完整性**：查阅 context.md 能找到所有文件的具体用途
3. **make verify 可运行**：
   - 前提：`cd frontend && npm install` + `cd backend && pip install -r requirements-dev.txt`
   - 执行：`make verify`
   - 预期：输出 "✔ 验证通过"，exit code 0
4. **Windows 等价命令**：
   - 执行：`cd frontend && npm run test:run && npm run typecheck && cd ../backend && pytest`
   - 预期：全部通过
5. **progress.json 有效**：JSON 可解析，包含 current_stage / plans / last_updated 字段

### 5.3 不破坏现有约束

- [ ] TypeScript 严格模式仍生效（`npm run typecheck` 通过）
- [ ] 前端测试仍通过（`npm run test:run` 75 用例全过）
- [ ] 后端测试仍通过（`pytest` 63 用例全过）
- [ ] UI 风格未改动（未触碰 App.css 与组件代码）
- [ ] 未引入新的第三方依赖（Makefile 与 markdown 文件无依赖）

---

## 六、执行顺序

1. 创建 `docs/` 目录与 `docs/context.md`（承接迁出内容）
2. 创建 `.harness/` 目录与 `.harness/progress.json`
3. 创建根目录 `Makefile`
4. 重构 `AGENTS.md`（精简文件清单、重组章节、补全 PBH 标准章节）
5. 自检：对照第五节验证清单逐项检查
6. 提交用户审阅（不自动 commit）
