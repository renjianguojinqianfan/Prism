# 重构计划：去掉后端 + 分析改前端直连

> 创建时间：2026-07-13
> 状态：待审查

## 一、背景与目标

### 问题根因

当前架构存在三个相互关联的结构性问题，共同根源是"分析的 LLM 调用放在后端代理"：

1. **两个 Key 割裂**：发言 Key 在前端 localStorage，分析 Key 在后端环境变量 `PRISM_ANALYZER_API_KEYS`，调用链路不同导致 Key 物理隔离，自部署自用要填两遍
2. **部署者付分析费**：分析走后端代理，每条发言触发一次自评 LLM 调用，用的是部署者配的 Key
3. **Jaccard 前后端双重实现**：回退链路跨三层（后端 LLM -> 后端 Jaccard -> 前端 Jaccard），每层各带一套 Jaccard，阈值/stopwords/分词逻辑都要人工同步

### 改动目标

1. 分析（LLM 自评）改前端直连：prompt 模板 + `parseLabelJson` 迁移到前端，前端用用户的 `model.endpoint + model.apiKey` 直连模型 API
2. 删除整个后端（`backend/` 目录）
3. 回退链路从三层简化为两层：前端直连 LLM 自评 -> 前端 Jaccard
4. 更新所有配置和文档

### 安全评估结论（已由 security-reviewer 确认）

- **SSRF**：攻击面消除（非绕过）。后端不再发起任何 HTTP 调用，SSRF 的前提不存在
- **Key 泄漏**：与发言模式一致。Key 不经过后端，跟已接受的发言 Key 同构
- **C1 修复**：不是回退，是让修复不再需要。消除了攻击面本身
- **边界情况**：无新增风险。浏览器直连与发言直连同构

## 二、提交规则

| 规则 | 说明 |
|---|---|
| 禁止混合提交 | 每个提交要么纯新增、要么纯删除、要么纯切换调用 |
| 先建新再删旧 | 提交 1-5 只新增函数；提交 6 切换调用；提交 7-9 才删旧 |
| 每轮只改一层 | analyzer.ts 迁移 / DiscussionContext 切换 / analyzer.ts 删旧 / 配置删除 / 后端删除 各自独立 |
| 提交间隙测试 | 每个提交后运行验证命令，通过再继续 |
| commit 格式 | `<type>(<scope>): <subject>`，scope 可选 |

### type 列表

`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`

## 三、详细提交序列（16 个提交）

---

### 第 0 轮：更新 commit-msg hook（基础设施先行）

新正则的 scope 是可选的 `(\(.+\))?`，旧格式 `feat: xxx` 仍匹配，向后兼容，可以先改。

#### Commit 1: ci(hooks): commit-msg 支持 scope 和扩展 type 列表

**文件**：`.git/hooks/commit-msg`

**改动**：
```diff
- pattern='^(feat|fix|style|refactor|docs|chore): .+'
+ pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+'
```
提示信息同步更新 type 列表和格式说明。

**验证**：手动测试 `feat(analyzer): test` 和 `feat: test` 均通过

---

### 第 1 轮：建新 -- analyzer.ts 迁移 parseLabelJson + buildAnalyzerPrompt

#### Commit 2: test(analyzer): 新增 parseLabelJson 和 buildAnalyzerPrompt 测试

**文件**：`frontend/src/services/analyzer.test.ts`

**改动**（纯新增）：
- 新增 `describe('parseLabelJson')` 9 用例（从 `backend/tests/test_analyzer.py` L15-57 移植）：
  - standard / surrounding_text / code_block / no_label / invalid_label / broken_json / missing_evidence / multiple_blocks / empty_string
- 新增 `describe('buildAnalyzerPrompt')` 4 用例（从 `backend/tests/test_analyzer.py` L64-93 移植）：
  - no_prior / truncates_to_last_five / empty_topic / all_placeholders

**状态**：RED（函数未实现）

**验证**：`cd frontend && npm run test:run -- analyzer.test`（确认新测试失败，旧测试全过）

#### Commit 3: feat(analyzer): 迁移 parseLabelJson 和 buildAnalyzerPrompt

**文件**：`frontend/src/services/analyzer.ts`

**改动**（纯新增）：
- 新增 `ANALYZER_PROMPT_TEMPLATE` 常量（从 `backend/app/services/analyzer.py` L10-25 迁移）
- 新增 `buildAnalyzerPrompt(topic, priorMessages, currentMessage)` 函数（从 L44-52 迁移）
- 新增 `parseLabelJson(text): { label, evidence } | null` 函数（从 L28-41 迁移）
- 新增相关类型导出

**状态**：GREEN

**验证**：`cd frontend && npm run test:run -- analyzer.test && npm run typecheck`

---

### 第 2 轮：建新 -- analyzer.ts 新增 directStreamAnalysis

#### Commit 4: test(analyzer): 新增 directStreamAnalysis 直连模型测试

**文件**：`frontend/src/services/analyzer.test.ts`

**改动**（纯新增）：
- 新增 `describe('directStreamAnalysis')` 约 10 用例
- mock fetch 返回 OpenAI SSE 格式（`{choices:[{delta:{content}}]}`）
- 覆盖：
  - 成功路径：delta 累积 -> parseLabelJson 解析 -> 返回 {label, evidence}
  - onDelta 回调被正确调用
  - 模型端点非 200 -> 返回 null
  - 模型端点无 body -> 返回 null
  - 网络异常 -> 返回 null
  - 跨 buffer 边界拼接 -> 正确解析
  - 畸形 data 行 -> 跳过
  - LLM 输出不含合法 JSON -> 返回 null
  - 仅 [DONE] 无内容 -> 返回 null

**状态**：RED（函数未实现）

**验证**：`cd frontend && npm run test:run -- analyzer.test`

#### Commit 5: feat(analyzer): 实现 directStreamAnalysis 前端直连模型 API

**文件**：`frontend/src/services/analyzer.ts`

**改动**（纯新增）：
- 新增 `directStreamAnalysis(model, payload, onDelta?, timeoutMs?)` 函数
  - 内部流程：`buildAnalyzerPrompt` 构造 prompt -> `fetch(model.endpoint, { Authorization: Bearer model.apiKey })` 直连 -> 解析 OpenAI SSE delta（复用 `streamChat` 的 buffer 拆分模式）-> 累积全文 -> `parseLabelJson` -> 返回结果或 null
- 新增 `DirectStreamAnalysisPayload` 接口
- 新增 `DirectAnalyzerMessage` 接口（不含 model 字段）

**状态**：GREEN

**验证**：`cd frontend && npm run test:run && npm run typecheck`

> 此时旧 streamAnalysis / fetchAnalysis 仍存在且被测试覆盖，新函数已就位但未被调用。

---

### 第 3 轮：切换 -- DiscussionContext 调用链路

#### Commit 6: refactor(context): 分析链路切换至 directStreamAnalysis

**文件**：`frontend/src/store/DiscussionContext.tsx`

**改动**（纯修改调用，不删旧函数）：
- L15：导入改为 `directStreamAnalysis` + `localHeuristicAnalyze`（移除 `streamAnalysis` / `fetchAnalysis` / `StreamAnalysisPayload`）
- L18-23：删除 `ANALYZE_ENDPOINT` / `ANALYZE_FALLBACK_ENDPOINT` 常量
- L408-432：第一层改为 `directStreamAnalysis(model, payload)`
- L434-449：删除第二层 `fetchAnalysis` 调用
- L451-459：第三层变第二层 `localHeuristicAnalyze`，保留

回退链路变化：
```
改前：streamAnalysis(后端SSE) -> fetchAnalysis(后端Jaccard) -> localHeuristicAnalyze(前端Jaccard)
改后：directStreamAnalysis(前端直连LLM) -> localHeuristicAnalyze(前端Jaccard)
```

**验证**：`cd frontend && npm run test:run && npm run typecheck && npm run build`

> 此时旧 streamAnalysis / fetchAnalysis 仍在 analyzer.ts 中 export，但不再被调用。旧测试仍跑旧函数。

---

### 第 4 轮：删旧 -- analyzer.ts 旧函数

#### Commit 7: refactor(analyzer): 删除旧 streamAnalysis 和 fetchAnalysis

**文件**：`frontend/src/services/analyzer.ts` + `frontend/src/services/analyzer.test.ts`

**改动**（纯删除）：
- analyzer.ts：删除 `streamAnalysis`、`fetchAnalysis`、`AnalyzePayload`、`StreamAnalysisPayload`（旧版）、`StreamAnalyzerMessage`（旧版）、`StreamAnalysisResult`
- analyzer.test.ts：删除 `describe('streamAnalysis')` 7 用例、`describe('fetchAnalysis')` 4 用例、`makeSSEStream` helper、旧测试数据

**验证**：`cd frontend && npm run test:run && npm run typecheck`

---

### 第 5 轮：删旧 -- 前端配置

#### Commit 8: refactor(config): 删除分析端点环境变量

**文件**：`frontend/src/vite-env.d.ts` + `frontend/.env.example`

**改动**（纯删除）：
- vite-env.d.ts：删除 `VITE_ANALYZE_ENDPOINT` 类型声明
- frontend/.env.example：整个文件删除

**验证**：`cd frontend && npm run typecheck && npm run build`

---

### 第 6 轮：删旧 -- 后端

#### Commit 9: refactor(backend): 删除整个后端服务

**文件**：整个 `backend/` 目录（共 19 个文件）

**删除清单**：
```
backend/
├── main.py
├── .env.example
├── requirements.txt
├── requirements-dev.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── analyze.py
│   │   ├── deps.py
│   │   └── health.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── analyzer.py
│   │   └── heuristic.py
│   ├── config.py
│   └── schemas.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_analyzer.py
    ├── test_api.py
    ├── test_api_stream.py
    ├── test_heuristic.py
    └── test_config.py
```

**验证**：`cd frontend && npm run test:run && npm run typecheck && npm run build`

---

### 第 7 轮：更新构建配置

#### Commit 10: ci(hooks): pre-commit 移除后端测试步骤

**文件**：`.git/hooks/pre-commit`

**改动**：
```diff
- powershell.exe -NoProfile -Command "cd frontend; npm run test:run; ...; cd ../backend; python -m pytest; ..."
+ powershell.exe -NoProfile -Command "cd frontend; npm run test:run; ...; npm run typecheck; ...; Write-Host 'All checks passed'"
```
删除 `cd ../backend; python -m pytest` 部分。

**验证**：手动触发一次 commit 确认 hook 只跑前端

#### Commit 11: ci: 移除后端 CI 测试任务

**文件**：`.github/workflows/ci.yml`

**改动**（纯删除）：
- 删除 `backend` job（L42-63）
- 仅保留 `frontend` job

#### Commit 12: chore(makefile): 简化 verify 移除后端步骤

**文件**：`Makefile`

**改动**：
- L1：`.PHONY` 删除 `test-backend`、`dev-backend`
- L4：`verify: test-frontend typecheck-frontend build-frontend`（删除 `test-backend`）
- 删除 `test-backend` target（L19-21）
- 删除 `dev-backend` target（L27-29）

**验证**：`make verify`

---

### 第 8 轮：更新文档

#### Commit 13: docs(agents): 更新为纯前端架构

**文件**：`AGENTS.md`

**改动**：
- §1 技术栈：删除 FastAPI 后端，改为纯前端 SPA
- §2 常用命令：删除后端命令，简化 `make verify`
- §3 目录结构：删除 `backend/` 条目
- §4 禁止硬编码密钥：删除 `PRISM_ANALYZER_API_KEYS`，改为分析复用发言 Key
- §4 阈值同步：整条删除
- §5 行为边界：删除 `backend/app/`
- §6 完成定义：删除 pytest 条目
- §8 提交规范：格式改为 `<type>(<scope>): <subject>`，扩展 type 列表

#### Commit 14: docs(context): 更新分析链路说明

**文件**：`docs/context.md`

**改动**：
- §2.1：分析流程改为前端直连
- §2.2 C1 修复：整段重写
- §2.3：三级回退改两级
- §2.4 后端 API 端点：整段删除
- §3.3 质量门禁：更新 pre-commit / commit-msg 描述

#### Commit 15: docs(readme): 删除后端相关说明

**文件**：`README.md`

**改动**：
- 功能描述：三级回退改两级
- 后端部署要点：删除
- 环境变量 `PRISM_ANALYZER_API_KEYS`：删除
- `VITE_ANALYZE_ENDPOINT` / `FALLBACK`：删除
- 测试覆盖：更新
- 联调验证：删除后端部分

---

### 第 9 轮：同步原型

#### Commit 16: refactor(prototype): index.html 分析逻辑改为前端直连

**文件**：`index.html`

**改动**：
- 删除 `ANALYZE_ENDPOINT` / `ANALYZE_FALLBACK_ENDPOINT` 常量
- 重写 `streamAnalysis` 为前端直连模型 API
- `analyzeSingleMessage` 三层回退改两层
- 新增 `parseLabelJson` / `buildAnalyzerPrompt`（与 React 版一致）

**验证**：`cd frontend && npm run typecheck`

---

## 四、总览

| 轮次 | 提交 | 类型 | 层/模块 | 验证命令 |
|---|---|---|---|---|
| 0 | 1 | ci(hooks) | commit-msg 格式 | 手动测试 |
| 1 建新 | 2-3 | test/feat(analyzer) | parseLabelJson + buildAnalyzerPrompt | test:run + typecheck |
| 2 建新 | 4-5 | test/feat(analyzer) | directStreamAnalysis | test:run + typecheck |
| 3 切换 | 6 | refactor(context) | DiscussionContext 调用链路 | test:run + typecheck + build |
| 4 删旧 | 7 | refactor(analyzer) | 删旧 streamAnalysis + fetchAnalysis | test:run + typecheck |
| 5 删旧 | 8 | refactor(config) | 删环境变量配置 | typecheck + build |
| 6 删旧 | 9 | refactor(backend) | 删整个后端 | test:run + typecheck + build |
| 7 构建 | 10 | ci(hooks) | pre-commit 移除后端 | 手动触发 commit |
| 7 构建 | 11 | ci | 移除后端 CI job | - |
| 7 构建 | 12 | chore(makefile) | 简化 verify | make verify |
| 8 文档 | 13 | docs(agents) | AGENTS.md | - |
| 8 文档 | 14 | docs(context) | context.md | - |
| 8 文档 | 15 | docs(readme) | README.md | - |
| 9 原型 | 16 | refactor(prototype) | index.html | typecheck |

## 五、测试用例变化

| | 改前 | 删除 | 新增 | 改后 |
|---|---|---|---|---|
| 后端 | 63 | 63 | 0 | 0（整个 backend/ 删除） |
| 前端 analyzer.test.ts | 34 | 11（streamAnalysis 7 + fetchAnalysis 4） | 23（parseLabelJson 9 + buildAnalyzerPrompt 4 + directStreamAnalysis 10） | 46 |
| 前端其他 | 61 | 0 | 0 | 61 |

## 六、风险和注意事项

| 风险 | 缓解 |
|---|---|
| 前端 SSE 解析 + JSON 提取有 bug | 移植后端已验证的测试用例，覆盖正常/畸形/跨 buffer 场景 |
| 某些模型 API 不支持 CORS | 发言已验证可用则分析同链路可用；不可用时 fallback 到 Jaccard |
| parseLabelJson 正则迁移有差异 | 逐行对照后端实现，移植相同的 9 个测试用例验证 |
| index.html 原型同步遗漏 | 第 9 轮统一处理，对照 React 版改动 |
| DiscussionContext 编排层无测试 | 建议提取纯函数 resolveTag 使其可测（可选，非阻塞） |

## 七、连锁收益

| 问题 | 是否解决 |
|---|---|
| 两个 Key 割裂（自部署填两遍） | 解决，一个 Key 干两件事 |
| 部署者付分析费 | 解决，用用户的 Key |
| SSRF 攻击面 | 解决，后端不代调 |
| Jaccard 前后端同步 | 解决，只有一份 |
| AGENTS.md 阈值同步约定 | 可删除 |
| release notes 两个已知问题 | 可删除 |
| 后端维护负担 | 解决，CI/测试/依赖全部简化 |
