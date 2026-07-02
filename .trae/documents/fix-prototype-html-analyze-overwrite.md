# 修复方案：原型 HTML 讨论结束时批量分析覆盖 LLM 自评标签

## 1. 问题摘要

原型 `index.html` 在提交 `5f8c2cc` 中引入了增量分析 `analyzeSingleMessage()`（每条 AI 发言后即时显示 LLM 自评标签），但**未删除旧的结束时批量分析 `analyzeMessages()`**。该批量分析仍向 SSE 流式端点 `/api/analyze/stream` 发送旧格式 payload `{topic, messages}`，触发 Pydantic 422（缺少必填 `currentMessage`），回退到本地 Jaccard 启发式后，通过 `applyTags()` 用 `innerHTML` 覆盖所有 `.msg-tag-slot`，**物理抹除**讨论过程中已显示的 LLM 自评标签与「X 自评」后缀。

最终用户感知：始终是本地关键词重合度标签，而非 LLM 自评结果 —— C1 提交的核心功能在原型 HTML 上失效。

## 2. 现状分析（基于 Phase 1 探索）

### 原型 HTML 当前行为
- 每条 AI 发言后 [L906](file:///e:/code/Prism/index.html#L906) 调用 `analyzeSingleMessage()`（正确，与 React 版等价）
  - SSE 路径 [L1055-L1058](file:///e:/code/Prism/index.html#L1055-L1058)：成功则 `applySingleTag()` 显示「X 自评」标签
  - Jaccard 回退 [L1064-L1087](file:///e:/code/Prism/index.html#L1064-L1087)：成功或本地启发式都调 `applySingleTag()` 显示「本地启发式自评」
- 讨论结束 [L772](file:///e:/code/Prism/index.html#L772) 调用 `analyzeMessages()`（**问题点**）
  - [L1115](file:///e:/code/Prism/index.html#L1115) 向 `/api/analyze/stream` 发送 `{topic, messages}` → 422
  - [L1128-L1130](file:///e:/code/Prism/index.html#L1128-L1130) 回退到 `localHeuristicAnalyze()`
  - [L1132](file:///e:/code/Prism/index.html#L1132) `applyTags()` 用 `innerHTML` 覆盖所有标签（**且新内容不带 analyzer 后缀**）

### React 版参照行为
[DiscussionContext.tsx#L380-L431](file:///e:/code/Prism/frontend/src/store/DiscussionContext.tsx#L380-L431) 显示 React 版**只有** `streamAnalysis`（SSE）+ `fetchAnalysis`（Jaccard 回退）+ `localHeuristicAnalyze`（前端兜底）三级，**没有讨论结束时的批量分析**。每条消息发言后即时落定标签，之后不再覆盖。

### 受影响函数依赖图
- `analyzeMessages()` 仅在 [L772](file:///e:/code/Prism/index.html#L772) 被调用一次
- `applyTags()` 仅在 [L1132](file:///e:/code/Prism/index.html#L1132) 由 `analyzeMessages()` 调用一次
- `localHeuristicAnalyze()` 同时被 `analyzeSingleMessage()` [L1082](file:///e:/code/Prism/index.html#L1082) 和 `analyzeMessages()` [L1129](file:///e:/code/Prism/index.html#L1129) 使用 —— **不能删除**

## 3. 选择方案：方案 B（删除批量分析调用，对齐 React 版）

### 为何不选方案 A（仅改端点为 FALLBACK）
方案 A 将 [L1115](file:///e:/code/Prism/index.html#L1115) 的 `ANALYZE_ENDPOINT` 改为 `ANALYZE_FALLBACK_ENDPOINT`，虽然能避免 422，但 `analyzeMessages()` 仍会运行 Jaccard 启发式并通过 `applyTags()` 覆盖 LLM 自评标签 —— **核心问题（覆盖）依然存在**，只是覆盖源从本地 Jaccard 变为后端 Jaccard。这不能真正修复功能退化。

### 方案 B 改动内容

#### 改动 1：删除讨论结束时的批量分析调用
**文件**：`e:\code\Prism\index.html`
**位置**：[L770-L773](file:///e:/code/Prism/index.html#L770-L773)
**改动**：删除 `await analyzeMessages();` 这一行，保留前后两行（系统消息 `讨论结束` 与 `endDiscussion()` 调用）。

#### 改动 2：清理改动 1 造成的孤儿函数
按用户规则「Remove imports/variables/functions that YOUR changes made unused」，删除以下两个函数（它们因改动 1 变为孤儿）：

**函数 A**：`analyzeMessages()` —— 整个函数 [L1100-L1133](file:///e:/code/Prism/index.html#L1100-L1133)
**函数 B**：`applyTags()` —— 整个函数 [L1186-L1195](file:///e:/code/Prism/index.html#L1186-L1195)

**不删除**：
- `localHeuristicAnalyze()` —— 仍被 `analyzeSingleMessage()` [L1082](file:///e:/code/Prism/index.html#L1082) 使用
- `applySingleTag()` —— 仍被 `analyzeSingleMessage()` [L1057/L1086](file:///e:/code/Prism/index.html#L1057) 使用
- `streamAnalysis()` —— 仍被 `analyzeSingleMessage()` [L1055](file:///e:/code/Prism/index.html#L1055) 使用
- 常量 `ANALYZE_ENDPOINT` / `ANALYZE_FALLBACK_ENDPOINT` —— 仍被 `analyzeSingleMessage()` 使用
- `analyzeSingleMessage()` 自身 —— 不改动

## 4. 假设与决策

| 项 | 假设/决策 | 依据 |
|---|---|---|
| 是否对齐 React 版行为 | 是 | React 版无结束时批量分析，标签在每条发言后即落定 |
| 是否保留 `analyzeMessages` 函数体以备后用 | 否 | YAGNI 原则，React 版无对应实现，且当前需求是修复退化而非扩展 |
| 是否调整 `applySingleTag` 的 analyzer 字段 | 否 | 改动应最小化，仅修复 Bug 本身 |
| 是否处理 `applyTags` 不带 analyzer 后缀的次要问题 | 否 | 该函数将被删除，无需修复 |
| `endDiscussion()` 调用是否保留 | 是 | 与本次 Bug 无关，保留原有控制流 |
| 模拟模式分支是否受影响 | 否 | `analyzeMessages()` 中模拟模式分支也走 `localHeuristicAnalyze()`，与 `analyzeSingleMessage()` 的本地兜底路径重复；删除后模拟模式每条发言已由 `analyzeSingleMessage()` 落定标签，行为不变 |

## 5. 验证步骤

### 静态验证（无需运行）
1. **`grep -n "analyzeMessages\|applyTags" index.html`** —— 应返回 0 行匹配（确认函数已彻底删除且无残留调用）。
2. **`grep -n "applySingleTag\|localHeuristicAnalyze\|streamAnalysis" index.html`** —— 应仍有多处匹配，确认未误删仍在用的工具函数。
3. **`grep -n "analyzeSingleMessage" index.html`** —— 应保留 L906 调用点 + L1032 定义，确认主路径完整。

### 动态验证（用户验证）
1. **真实 API 路径**（关闭模拟模式 + 配置 API Key + 后端 `PRISM_ANALYZER_API_KEYS` 已设）：
   - 发起一次 2-3 轮多模型讨论
   - 讨论过程中：每条 AI 发言后即时显示「X 自评」标签（共识/分歧/中立 + 「· X 自评」后缀）
   - 讨论结束「讨论结束」系统消息显示后：**所有标签保持不变，不被覆盖**
   - 浏览器 Network 面板：讨论过程中可见 `/api/analyze/stream` 流式请求成功；讨论结束后**不再有** `/api/analyze/stream` 或 `/api/analyze` 请求
2. **Jaccard 回退路径**（关闭模拟模式 + 配置 API Key + 后端 `PRISM_ANALYZER_API_KEYS` 故意不配当前模型）：
   - 每条 AI 发言后 SSE 返回 fallback，落定「· 本地启发式自评」标签
   - 讨论结束后标签保持不变
3. **模拟模式**（开启模拟模式）：
   - 每条 AI 发言后 `analyzeSingleMessage()` 因 `priorMsgs.length === 0` 直接 return（首条），或走本地兜底分支落定标签
   - 讨论结束后标签保持不变
4. **后端控制台**：整个讨论过程不再看到 422 错误日志（原 Bug 触发时会打印）。

## 6. 改动后预期 Git Diff 概览

```diff
@@ -769,7 +769,6 @@
     // 讨论结束
     renderMessage({ role: 'system', content: '讨论结束' });
-    // 调用真实分析（后端优先，失败时本地启发式回退）
-    await analyzeMessages();
     endDiscussion();
 }

@@ -1099,35 +1099,6 @@
-async function analyzeMessages() {
-    const aiMsgs = messages.filter(m => m.role === 'assistant');
-    if (aiMsgs.length === 0) return;
-    ...（整函数删除）
-}

@@ -1186,10 +1157,0 @@
-function applyTags(tags) {
-    const TEXT = { ... };
-    tags.forEach(t => { ... });
-}
```

总计：**1 行调用删除 + 2 个孤儿函数删除**（约 40 行），无新增、无功能扩展。
