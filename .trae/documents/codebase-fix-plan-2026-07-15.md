# 棱镜 (Prism) 代码库全面修复计划（最终版）

> 基于 2026-07-15 四路并行代码库检查 + deep-module 架构审查，覆盖安全、质量、架构三个维度。
> 本版本整合了 3 个架构深化候选：引擎自拥控制状态、SSE 提取前置、startDiscussion 双模式拆分。

## 概述

本计划分 5 个阶段执行修复，从安全漏洞到架构重构递进推进。每个阶段可独立验证、独立提交，符合项目"分批次小步提交"约定。

- **Phase 1**：安全修复（index.html XSS + 输入校验）
- **Phase 2**：功能与质量修复（11 项小改动，覆盖全部 HIGH/MEDIUM 级别 + startDiscussion 拆分）
- **Phase 2.5**：SSE 解析提取（引擎重构前置依赖，降低后续搬迁风险）
- **Phase 3**：架构重构（class-based 编排引擎 + 补测试）
- **Phase 4**：低优先级改进（LOW 级别）

---

## 执行状态（2026-08-13 更新：全部完成）

> 本计划已按 13 个语义化提交 + 2 个前置提交 + 1 个 code-review 修复提交全部执行完毕（16 个提交）。

### 提交清单

| # | 提交 | Ticket | 内容 |
|---|------|--------|------|
| 1 | `7b92395` | — | docs: 配置工程技能体系（issue tracker/triage/domain docs） |
| 2 | `5012f5c` | #18 | chore: 同步 package-lock.json 版本号 0.1.1 |
| 3 | `a0418f1` | #19 | fix(security): index.html 三处 XSS（含 title 补充） |
| 4 | `1531697` | #20 | fix(input): 轮次 1-10 钳制 |
| 5 | `7d4ecc4` | #21 | perf(components): MessageBubble React.memo |
| 6 | `ebef7f3` | #22 | fix(simulator): simulatorId 模板匹配 |
| 7 | `8e0cc5b` | #23 | fix(analyzer): abort signal + 错误日志 |
| 8 | `72dc5ae` | #24 | fix(components): RoleBar 讨论中禁用 |
| 9 | `215ef79` | #25 | fix(context): 错误处理/localStorage/空值 |
| 10 | `091a05b` | #26 | fix(services): reader 释放 + skipRequested 重置 |
| 11 | `87664cc` | #27 | refactor(context): start/interject 拆分 |
| 12 | `dbe36db` | #30 | refactor(utils): parseSSEStream 提取 |
| 13 | `c738b63` | #31 | refactor(engine): DiscussionEngine 重构 |
| 14 | `c3638aa` | #28 | fix(services): parseLabelJson + buildAPIHistory 截断 |
| 15 | `94e8fd9` | #29 | refactor(utils): escapeHtml 纯字符串 + 标识符重命名 |
| 16 | `28e6411` | — | fix(engine): code-review 修复（reset 输入/分析残留/空模型状态） |

### 相对原计划的修正（执行时记录）

1. **补充 title 属性转义**：link/image renderer 的 `title` 属性一并转义（原计划仅提 alt/value）
2. **parseLabelJson 现状修正**：实现改为"整体解析 + 括号配对扫描"，覆盖 evidence 含花括号场景
3. **T0 拆分为 2 个提交**（Makefile/.githooks 恢复 + lockfile 版本号同步）；Makefile/.githooks 内容与 HEAD 一致、无需提交
4. **InputBar Enter 键**：拆分 interject 后 Enter 键同步条件调用（防止讨论中按 Enter 误重启讨论）
5. **code-review 修复**：reset 清空输入框、分析中 reset 丢弃结果防误 toast、空模型时 endDiscussion 保持状态一致

### 验证结果（最终）

- `npm run test:run`：**131 用例 / 10 文件全绿**（原 116；新增 sse.test.ts 6 + discussionEngine.test.ts 8 + parseLabelJson 2 + buildAPIHistory 1，迁移删除 2）
- `npm run typecheck`：strict 模式通过
- `npm run build`：构建成功
- 14 个 GitHub tickets（#18-#31）已发布（全部 `ready-for-agent`）并完成

---

## 当前状态分析

### 质量门禁基线（2026-07-15 验证通过）

- `npm run test:run`：8 文件 116 用例通过
- `npm run typecheck`：strict 模式无错误
- `npm run build`：构建成功

### 核心问题清单

| ID | 级别 | 问题 | 文件 |
|----|------|------|------|
| S-M1 | 中危 | index.html image renderer alt 未转义 -> XSS 可窃取 API Key | index.html:1372 |
| S-L2 | 低危 | index.html showToast innerHTML 未转义 | index.html:1434 |
| S-L3 | 低危 | index.html 属性值未转义 | index.html:1227,1232,1237 |
| Q-H1 | 严重 | simulator 模板匹配失效，所有模型回退同一模板 | simulator.ts:43 |
| Q-H2 | 严重 | DiscussionContext 编排逻辑零测试覆盖 | DiscussionContext.tsx:312-546 |
| Q-H3 | 严重 | 流式 delta 全组件树重渲染 | DiscussionContext.tsx:297, MessageBubble.tsx |
| Q-M1 | 中等 | loadModels 无运行时校验 | DiscussionContext.tsx:64 |
| Q-M2 | 中等 | localStorage.setItem 未捕获异常 | DiscussionContext.tsx:293 |
| Q-M3 | 中等 | parseLabelJson 正则无法匹配含花括号的 JSON 值 | analyzer.ts:156 |
| Q-M4 | 中等 | buildAPIHistory 无 token 上限截断 | api.ts:22 |
| Q-M5 | 中等 | RoleBar 讨论中允许切换模型 | RoleBar.tsx:20 |
| Q-M6 | 中等 | (err as Error).message 不安全断言 | DiscussionContext.tsx:381-382 |
| Q-M7 | 中等 | directStreamAnalysis 静默吞掉所有异常 | analyzer.ts:249 |
| Q-M8 | 中等 | 轮次输入框无范围校验 | InputBar.tsx:118 |
| Q-M9 | 中等 | 分析阶段不可中断（无外部 abort signal） | analyzer.ts:196 |
| Q-L1 | 轻微 | SSE 解析逻辑重复 | api.ts:72-95, analyzer.ts:220-243 |
| Q-L2 | 轻微 | escapeHtml 每次创建 DOM 元素 | escape.ts:2 |
| Q-L4 | 轻微 | exportDiscussion msg.round 未做空值检查 | DiscussionContext.tsx:560 |
| Q-L5 | 轻微 | 导出标识符 `_` 前缀与 export 矛盾 | analyzer.ts:9,18 |
| A-C1 | 架构深化 | DiscussionContext 是 God Object，编排逻辑与控制状态耦合 | DiscussionContext.tsx |
| A-C2 | 架构深化 | startDiscussion 双模式行为，接口隐藏行为分叉 | DiscussionContext.tsx:492-546 |

---

## Phase 1：安全修复

### 1.1 index.html XSS 修复（S-M1, S-L2, S-L3）

**文件**：`index.html`

**改动**：

1. **image renderer alt 转义**（第 1372 行）
   - 现状：`alt="${text}"` - text 未经转义，可通过 `![](https://x"onerror=...)` 注入
   - 修复：`alt="${escapeHtml(text)}"` - 与 React 版本 `markdown.ts:25` 保持一致

2. **showToast 改用 textContent**（第 1434 行）
   - 现状：`toast.innerHTML = \`...<span>${message}</span>\``
   - 修复：分两步设置 - `toast.innerHTML = \`<i class="fas ${c.icon}"></i> \`` 然后 `const span = document.createElement('span'); span.textContent = message; toast.appendChild(span)`
   - 原因：icon 部分是内部常量（安全），message 可能含 model.name 或 API 错误文本

3. **renderModelConfigs 属性值转义**（第 1227、1232、1237 行）
   - 现状：`value="${m.endpoint}"` / `value="${m.model}"` / `value="${m.apiKey}"` 未转义
   - 修复：`value="${escapeHtml(m.endpoint)}"` 等三处

### 1.2 轮次输入框范围校验（Q-M8）

**文件**：`frontend/src/components/InputBar.tsx`

**改动**（第 118 行）：
- 现状：`onChange={e => setMaxRounds(parseInt(e.target.value) || 2)}`
- 修复：`onChange={e => setMaxRounds(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 10))}`
- 原因：`parseInt('100')` = 100（truthy），`parseInt('-5')` = -5（truthy），HTML min/max 不约束直接输入

**验证**：`npm run typecheck` + `npm run test:run` 通过

---

## Phase 2：功能与质量修复

### 2.1 MessageBubble React.memo + props 下传（Q-H3）

**文件**：`frontend/src/components/MessageBubble.tsx`、`frontend/src/components/MessageList.tsx`

**问题**：MessageBubble 内部调用 `useDiscussion()` 读取整个 `state` 仅为查 `model` 的 color/icon/name。每次 SSE delta 更新 state.messages 时，所有 MessageBubble 重渲染。

**改动**：

1. **MessageBubble.tsx**：
   - 移除 `const { state } = useDiscussion()`
   - Props 增加 `modelColor`、`modelIcon`、`modelName`（由父组件传入）
   - 用 `React.memo` 包裹，默认浅比较即可（msg 是引用稳定的 reducer 产物，仅在自身更新时引用变化）
   - system 和 user 消息不依赖 model 信息，直接返回

2. **MessageList.tsx**（第 65-66 行）：
   - 从 `useDiscussion()` 取 `state`
   - 在 `.map()` 中查找 model 信息并传给 MessageBubble：
     ```tsx
     {state.messages.map(msg => {
       const model = msg.modelId ? state.models.find(m => m.id === msg.modelId) : undefined
       return (
         <MessageBubble
           key={msg.id}
           msg={msg}
           modelColor={model?.color}
           modelIcon={model?.icon}
           modelName={model?.name || msg.modelName}
         />
       )
     })}
     ```

**效果**：流式 delta 更新某条消息时，仅该条 MessageBubble 重渲染，其余跳过。

### 2.2 simulator 模板匹配修复（Q-H1）

**文件**：`frontend/src/services/simulator.ts`、`frontend/src/config/presetModels.ts`、`frontend/src/store/types.ts`

**问题**：`generateSimReply(model.id, ...)` 用 `templates[modelId]` 查找，但模型 ID 是 `custom_${Date.now()}`，永远匹配不到 `deepseek`/`kimi`/`glm`/`qwen`。

**改动**：

1. **types.ts**：`ModelConfig` 增加可选字段 `simulatorId?: string`

2. **presetModels.ts**：`QuickTemplate` 接口增加 `simulatorId?: string`，四个模板分别填入 `'deepseek'`、`'kimi'`、`'glm'`、`'qwen'`。Mimo 不填（回退 deepseek）。

3. **simulator.ts**：`generateSimReply` 签名改为接收 `ModelConfig`（或 `{ simulatorId?: string; name: string }`），用 `simulatorId` 匹配模板，回退 `deepseek`。

4. **DiscussionContext.tsx**：`addModelFromTemplate` 中 `...template` 自动带入 `simulatorId`。调用处 `generateSimReply(model.id, ...)` 改为 `generateSimReply(model, ...)`。

5. **simulator.test.ts**：更新测试用 `simulatorId` 匹配。

### 2.3 分析阶段接入 abort signal（Q-M9）

**文件**：`frontend/src/services/analyzer.ts`、`frontend/src/store/DiscussionContext.tsx`

**问题**：`directStreamAnalysis` 内部创建独立 AbortController，跳过/重置时无法中止分析请求。

**改动**：

1. **analyzer.ts** `directStreamAnalysis` 签名增加可选参数 `externalSignal?: AbortSignal`：
   ```typescript
   export async function directStreamAnalysis(
     model: { endpoint: string; apiKey: string; model: string },
     payload: DirectStreamAnalysisPayload,
     onDelta?: (delta: string) => void,
     timeoutMs = 30000,
     externalSignal?: AbortSignal
   ): Promise<...>
   ```
   - 内部 `ctrl` 同时监听 `externalSignal`：
     ```typescript
     if (externalSignal) {
       if (externalSignal.aborted) ctrl.abort()
       else externalSignal.addEventListener('abort', () => ctrl.abort(), { once: true })
     }
     ```

2. **DiscussionContext.tsx** `streamAnalyzeMessage`（第 415 行）：调用 `directStreamAnalysis` 前，创建新 AbortController 并赋值给 `controlRef.current.abortController`，使 `nextSpeaker`/`resetDiscussion` 的 `abort()` 能终止分析。

### 2.4 RoleBar 讨论中禁用切换（Q-M5）

**文件**：`frontend/src/components/RoleBar.tsx`

**改动**（第 20 行）：
- 现状：`onClick={() => toggleModelEnabled(m.id)}`
- 修复：`onClick={() => { if (!state.discussionActive) toggleModelEnabled(m.id) }}`

### 2.5 错误处理修复（Q-M6, Q-M2, Q-M1）

**文件**：`frontend/src/store/DiscussionContext.tsx`

**改动**：

1. **(err as Error).message 安全判断**（第 381-382 行）：
   ```typescript
   const errMsg = err instanceof Error ? err.message : String(err)
   fullContent = `[调用失败] ${errMsg}`
   showToast(`${model.name} 调用出错：${errMsg}`, 'error')
   ```

2. **localStorage.setItem 异常捕获**（第 293 行）：
   ```typescript
   const persistModels = () => {
     try {
       localStorage.setItem(STORAGE_KEY, JSON.stringify(state.models))
     } catch {
       showToast('配置保存失败，可能存储空间已满', 'error')
     }
   }
   ```

3. **loadModels 运行时校验**（第 62-68 行）：
   ```typescript
   if (saved) {
     try {
       const parsed = JSON.parse(saved)
       if (Array.isArray(parsed) && parsed.every(m =>
         m && typeof m.endpoint === 'string' && typeof m.model === 'string'
       )) {
         return parsed as ModelConfig[]
       }
     } catch {
       // 损坏数据，返回空
     }
   }
   return []
   ```

### 2.6 reader try/finally 释放 + skipRequested 重置

**文件**：`frontend/src/services/api.ts`、`frontend/src/services/analyzer.ts`、`frontend/src/store/DiscussionContext.tsx`

**改动**：

1. **api.ts streamChat**（第 67-96 行）：用 try/finally 包裹读取循环：
   ```typescript
   const reader = response.body.getReader()
   try {
     // ... while 循环 ...
   } finally {
     reader.cancel().catch(() => {})
   }
   ```

2. **analyzer.ts directStreamAnalysis**（第 216-243 行）：同样用 try/finally 包裹。

3. **DiscussionContext.tsx**：在 `generateResponse` 函数开头加 `controlRef.current.skipRequested = false`，消除真实模式下的状态残留隐患。

### 2.7 exportDiscussion msg.round 空值检查（Q-L4）

**文件**：`frontend/src/store/DiscussionContext.tsx`

**改动**（第 560 行）：
- 修复：`text += \`### ${msg.modelName}${msg.round ? \`（第${msg.round}轮）\` : ''}\n${msg.content}\n\n\``

### 2.8 directStreamAnalysis 错误日志（Q-M7）

**文件**：`frontend/src/services/analyzer.ts`

**改动**（第 249 行）：
```typescript
catch (err) {
  if (err instanceof Error && err.name !== 'AbortError') {
    console.error('[directStreamAnalysis] 分析失败:', err.message)
  }
  return null
}
```

### 2.9 startDiscussion 双模式拆分（A-C2）

**文件**：`frontend/src/store/DiscussionContext.tsx`、`frontend/src/components/InputBar.tsx`

**问题**：`startDiscussion()` 根据 `state.discussionActive` 执行完全不同逻辑（启动新讨论 vs 插话），接口隐藏行为分叉。

**改动**：

1. **DiscussionContext.tsx**：
   - `startDiscussion` 只做启动逻辑（移除 `if (state.discussionActive)` 分支）
   - 新增 `interject` 函数，只做插话逻辑：
     ```typescript
     const interject = useCallback(() => {
       const topic = state.inputText.trim()
       if (!topic) return
       pushMessage({ id: genId(), role: 'user', content: topic, modelId: 'user', modelName: '你' })
       showToast('你的观点已加入讨论', 'success')
       dispatch({ type: 'SET_INPUT', value: '' })
     }, [state.inputText, pushMessage, showToast])
     ```
   - `DiscussionContextValue` 接口增加 `interject: () => void`
   - `value` useMemo 返回值增加 `interject`

2. **InputBar.tsx**（第 102-108 行）：
   - 按钮 onClick 改为条件调用：
     ```tsx
     <button onClick={state.discussionActive ? interject : startDiscussion}>
       {state.discussionActive ? '插话' : '发起'}
     </button>
     ```
   - 从 `useDiscussion()` 解构增加 `interject`

**验证**：`npm run typecheck` + `npm run test:run` 通过

---

## Phase 2.5：SSE 解析提取（引擎重构前置）

> **架构审查深化点**：将 SSE 解析从 Phase 4 提前到引擎重构之前。`streamChat` 和 `directStreamAnalysis` 各有 ~24 行重复 SSE 逻辑，先提取公共函数，引擎搬迁时搬的是已简洁的调用，降低重构风险。

### 2.5.1 提取 parseSSEStream 公共函数（Q-L1）

**新建文件**：`frontend/src/utils/sse.ts`

```typescript
/**
 * 解析 SSE 流，对每个 data: 行的 payload 调用 onData。
 * 处理跨 chunk 边界的 buffer 拆分。
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onData: (data: string) => void
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      onData(data)
    }
  }
}
```

**改动**：

1. **api.ts streamChat**（第 67-96 行）：用 `parseSSEStream` 替换内联解析，回调中做 JSON parse + delta 提取：
   ```typescript
   const reader = response.body.getReader()
   try {
     await parseSSEStream(reader, (data) => {
       try {
         const json = JSON.parse(data)
         const delta: string = json.choices?.[0]?.delta?.content || ''
         if (delta) {
           fullContent += delta
           onDelta(delta, fullContent)
         }
       } catch { /* 忽略解析错误 */ }
     })
   } finally {
     reader.cancel().catch(() => {})
   }
   return fullContent
   ```
   注意：Phase 2.6 已加的 try/finally 保留，parseSSEStream 嵌套在内。

2. **analyzer.ts directStreamAnalysis**（第 216-243 行）：同样替换。

3. **新建 `frontend/src/utils/sse.test.ts`**：测试 parseSSEStream 的跨 chunk 边界、`data:` 前缀过滤、`[DONE]` 跳过。

**删除测试**：SSE 解析相关用例从 `api.test.ts` 和 `analyzer.test.ts` 迁移到 `sse.test.ts`（replace, don't layer 原则）。

**验证**：`npm run typecheck` + `npm run test:run` 通过

---

## Phase 3：架构重构

> **架构审查深化点**：引擎采用 class-based `DiscussionEngine`，控制状态（active/paused/skipRequested/abortController/discussionToken）为 private 实现，不暴露在接口上。接口只有 `start(config) / pause() / skip() / reset()` 四个命令。测试只需 mock 4 个 callbacks 并直接调命令方法。

### 3.1 抽离 reducer 到 store/reducer.ts

**新建文件**：`frontend/src/store/reducer.ts`

从 DiscussionContext.tsx 移出（纯函数/纯类型，无 React 依赖）：
- `State` 接口（L18-30）
- `Action` 类型（L32-50）
- `loadModels` 函数（L52-70，含 Phase 2.5 的运行时校验）
- `initState` 函数（L72-88）
- `reducer` 函数（L90-140）

### 3.2 创建 class-based DiscussionEngine

**新建文件**：`frontend/src/services/discussionEngine.ts`

```typescript
import type { Message, ModelConfig, ToastType } from '../store/types'
import type { Action, State } from '../store/reducer'
import { buildAPIHistory, streamChat } from './api'
import { generateSimReply } from './simulator'
import { directStreamAnalysis, localHeuristicAnalyze, type DirectStreamAnalysisPayload } from './analyzer'
import { sleep, genId } from '../utils/sleep'

/** 引擎回调 - 仅 4 个副作用出口，测试只需 mock 这些 */
export interface EngineCallbacks {
  onMessage: (msg: Message) => void
  onUpdate: (id: string, patch: Partial<Message>) => void
  onDispatch: (action: Action) => void
  onToast: (message: string, type?: ToastType) => void
}

/** 讨论配置 - 启动时传入的数据快照 */
export interface DiscussionConfig {
  models: ModelConfig[]
  simulate: boolean
  maxRounds: number
  topic: string
}

/**
 * 讨论编排引擎。
 * 控制状态（active/paused/skipRequested/abortController/discussionToken）是 private 实现，
 * 不暴露在接口上。调用方通过 start/pause/skip/reset 命令控制。
 */
export class DiscussionEngine {
  // --- 控制状态（private，不暴露） ---
  private active = false
  private paused = false
  private skipRequested = false
  private token: string | null = null
  private abortCtrl: AbortController | null = null

  // --- 数据 ref（private，引擎自拥） ---
  private messages: Message[] = []
  private topic = ''

  constructor(private cb: EngineCallbacks) {}

  /** 启动新讨论 */
  start(config: DiscussionConfig): void {
    this.active = true
    this.paused = false
    this.skipRequested = false
    this.token = genId()
    this.topic = config.topic
    this.messages = []

    this.cb.onDispatch({ type: 'SET_DISCUSSION_ACTIVE', value: true })
    this.cb.onDispatch({ type: 'SET_PAUSED', value: false })
    this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: 0 })

    // 推送 system + user 消息
    this.pushMessage({ id: genId(), role: 'system', content: `讨论话题：${config.topic}`, modelId: null, modelName: '' })
    this.pushMessage({ id: genId(), role: 'user', content: config.topic, modelId: 'user', modelName: '你' })

    void this.runDiscussion(config)
  }

  /** 暂停/继续 */
  togglePause(): void {
    this.paused = !this.paused
    this.cb.onDispatch({ type: 'SET_PAUSED', value: this.paused })
  }

  /** 跳过当前发言者 */
  skip(): void {
    this.skipRequested = true
    this.abortCtrl?.abort()
    this.cb.onToast('已跳过当前发言者', 'info')
  }

  /** 重置讨论 */
  reset(): void {
    this.active = false
    this.paused = false
    this.token = null
    this.abortCtrl?.abort()
    this.messages = []
    this.cb.onDispatch({ type: 'CLEAR_MESSAGES' })
    this.cb.onDispatch({ type: 'SET_DISCUSSION_ACTIVE', value: false })
    this.cb.onDispatch({ type: 'SET_PAUSED', value: false })
    this.cb.onDispatch({ type: 'SET_SPEAKING', id: null })
    this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: 0 })
    this.cb.onToast('讨论已重置', 'info')
  }

  /** 插话：向进行中的讨论追加 user 消息 */
  interject(topic: string): void {
    this.pushMessage({ id: genId(), role: 'user', content: topic, modelId: 'user', modelName: '你' })
    this.cb.onToast('你的观点已加入讨论', 'success')
  }

  // --- 以下为 private 实现 ---

  private pushMessage(msg: Message): void {
    this.messages = [...this.messages, msg]
    this.cb.onMessage(msg)
  }

  private updateMessage(id: string, patch: Partial<Message>): void {
    this.messages = this.messages.map(m => (m.id === id ? { ...m, ...patch } : m))
    this.cb.onUpdate(id, patch)
  }

  private endDiscussion(): void {
    this.active = false
    this.paused = false
    this.token = null
    this.cb.onDispatch({ type: 'SET_DISCUSSION_ACTIVE', value: false })
    this.cb.onDispatch({ type: 'SET_PAUSED', value: false })
    this.cb.onDispatch({ type: 'SET_SPEAKING', id: null })
    this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: 0 })
  }

  private async generateResponse(model: ModelConfig, round: number, simulate: boolean): Promise<void> {
    // ... 从 DiscussionContext.tsx L312-386 迁移 ...
    // 关键变化：
    // - controlRef.current.active -> this.active
    // - controlRef.current.paused -> this.paused
    // - controlRef.current.skipRequested -> this.skipRequested
    // - controlRef.current.abortController -> this.abortCtrl
    // - controlRef.current.discussionToken -> this.token
    // - messagesRef.current -> this.messages
    // - topicRef.current -> this.topic
    // - pushMessage/updateMessage/dispatch/showToast -> this.cb.onMessage/onUpdate/onDispatch/onToast
  }

  private async streamAnalyzeMessage(
    currentMsg: Message,
    priorAiMsgs: Message[],
    isBaseline: boolean,
    simulate: boolean,
    models: ModelConfig[]
  ): Promise<void> {
    // ... 从 DiscussionContext.tsx L388-438 迁移 ...
    // 关键变化：
    // - state.models.find -> models.find（参数传入）
    // - 调用 directStreamAnalysis 前创建新 AbortController 赋值给 this.abortCtrl
  }

  private async runDiscussion(config: DiscussionConfig): Promise<void> {
    const enabledModels = config.models.filter(m => m.enabled)
    if (enabledModels.length === 0) return

    for (let round = 1; round <= config.maxRounds; round++) {
      this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: round })
      for (const model of enabledModels) {
        while (this.paused) {
          await sleep(200)
          if (!this.active || this.token !== this.token) return
        }
        if (!this.active || this.token !== this.token) return

        if (!config.simulate && !model.apiKey) {
          this.pushMessage({ id: genId(), role: 'system', content: `${model.name} 未配置API Key，跳过`, modelId: null, modelName: '' })
          continue
        }

        this.cb.onDispatch({ type: 'SET_SPEAKING', id: model.id })
        await this.generateResponse(model, round, config.simulate)
        this.cb.onDispatch({ type: 'SET_SPEAKING', id: null })
        if (this.token !== this.token) return

        // 实时增量分析
        const aiMsgs = this.messages.filter(m => m.role === 'assistant' && !m.thinking)
        if (aiMsgs.length > 0) {
          const current = aiMsgs[aiMsgs.length - 1]
          const prior = aiMsgs.slice(0, -1)
          const isBaseline = aiMsgs.length === 1
          await this.streamAnalyzeMessage(current, prior, isBaseline, config.simulate, config.models)
        }

        await sleep(600)
      }
    }

    this.pushMessage({ id: genId(), role: 'system', content: '讨论结束', modelId: null, modelName: '' })
    this.endDiscussion()
  }
}
```

**架构决策说明**：

- **接口**：`start(config) / togglePause() / skip() / reset() / interject(topic)` — 5 个命令，参数简单
- **实现**：~190 行编排逻辑 + 控制状态管理，全部 private
- **深度**：小接口 + 大实现 = 深模块
- **seam**：EngineCallbacks 是唯一的 external seam（4 个回调），控制状态是 internal seam（private）
- **删除测试**：删除 DiscussionEngine -> 190 行编排逻辑 + 5 个控制状态字段重新散落回 DiscussionContext 的 useMemo + controlRef。复杂度重现 -> 通过

### 3.3 改造 DiscussionContext.tsx

**文件**：`frontend/src/store/DiscussionContext.tsx`

**改动**：

1. **导入变更**：
   - 从 `./reducer` 导入 `State`/`Action`/`reducer`/`loadModels`/`initState`（不再本地定义）
   - 从 `../services/discussionEngine` 导入 `DiscussionEngine`/`DiscussionConfig`/`EngineCallbacks`

2. **删除**：
   - `State`/`Action`/`loadModels`/`initState`/`reducer` 定义（已移到 reducer.ts）
   - `controlRef` 定义（控制状态移入引擎）
   - `messagesRef`/`topicRef` 定义（数据 ref 移入引擎）
   - `generateResponse`/`streamAnalyzeMessage`/`runDiscussion`（已移入引擎）
   - `togglePause`/`nextSpeaker`/`resetDiscussion` 旧实现（改为委托引擎）
   - Phase 2.9 的 `interject` 独立函数（移入引擎）

3. **新增**：引擎实例 + 回调装配：
   ```typescript
   // 创建引擎实例（useRef 保持单例）
   const engineRef = useRef<DiscussionEngine | null>(null)
   if (!engineRef.current) {
     const callbacks: EngineCallbacks = {
       onMessage: (msg) => dispatch({ type: 'ADD_MESSAGE', message: msg }),
       onUpdate: (id, patch) => dispatch({ type: 'UPDATE_MESSAGE', id, patch }),
       onDispatch: dispatch,
       onToast: showToast,
     }
     engineRef.current = new DiscussionEngine(callbacks)
   }
   const engine = engineRef.current
   ```

4. **命令委托**：
   ```typescript
   const startDiscussion = useCallback(() => {
     const topic = state.inputText.trim()
     if (!topic) { showToast('请输入话题或想法', 'warning'); return }
     const enabledModels = state.models.filter(m => m.enabled)
     if (enabledModels.length === 0) { showToast('请至少启用一个模型', 'warning'); return }

     const config: DiscussionConfig = {
       models: state.models,
       simulate: state.simulate,
       maxRounds: state.maxRounds,
       topic,
     }
     dispatch({ type: 'CLEAR_MESSAGES' })
     dispatch({ type: 'SET_INPUT', value: '' })
     engine.start(config)
   }, [state.inputText, state.models, state.simulate, state.maxRounds, engine, showToast])

   const interject = useCallback(() => {
     const topic = state.inputText.trim()
     if (!topic) return
     dispatch({ type: 'SET_INPUT', value: '' })
     engine.interject(topic)
   }, [state.inputText, engine])

   const togglePause = useCallback(() => engine.togglePause(), [engine])
   const nextSpeaker = useCallback(() => engine.skip(), [engine])
   const resetDiscussion = useCallback(() => engine.reset(), [engine])
   ```

5. **`value` useMemo**：仅保留 `saveSettings`/`openSettings`/`closeSettings`/`startDiscussion`/`interject`/`togglePause`/`nextSpeaker`/`resetDiscussion`/`exportDiscussion`/`showToast`/`dismissToast` + 简单 dispatcher。不再包含编排逻辑。

6. **预估**：DiscussionContext.tsx 从 624 行降至约 200 行。

**依赖关系（无循环）**：
```
store/types.ts              ← 领域类型（不变）
store/reducer.ts            ← State, Action, reducer, loadModels（纯函数）
utils/sse.ts                ← parseSSEStream（纯函数）
services/api.ts             ← streamChat（依赖 sse.ts）
services/analyzer.ts        ← directStreamAnalysis（依赖 sse.ts）
services/simulator.ts       ← generateSimReply（纯函数）
services/discussionEngine.ts ← DiscussionEngine class（依赖 reducer.ts + types.ts + services/）
store/DiscussionContext.tsx  ← Provider（依赖 reducer.ts + discussionEngine.ts）
```

### 3.4 更新现有测试引用

**文件**：`frontend/src/store/reducer.test.ts`、`frontend/src/store/loadModels.test.ts`

- import 从 `./DiscussionContext` 改为 `./reducer`

### 3.5 为 DiscussionEngine 补充单测（Q-H2）

**新建文件**：`frontend/src/services/discussionEngine.test.ts`

**测试策略**（replace, don't layer）：
- mock 4 个 EngineCallbacks（onMessage/onUpdate/onDispatch/onToast）用 `vi.fn()`
- mock `generateSimReply` 用 `vi.fn()` 返回固定字符串
- mock `directStreamAnalysis`/`localHeuristicAnalyze` 用 `vi.fn()`
- mock `streamChat` 用 `vi.fn()`
- 直接调用引擎的 `start`/`togglePause`/`skip`/`reset` 方法测试控制流
- 断言 callbacks 被调用的序列和参数，不检查内部状态

**测试用例**：

1. **正常完成一轮讨论**：1 个模型、1 轮、模拟模式 -> 验证 onMessage 调用序列（system 话题 -> user -> assistant -> system 结束）
2. **中途 reset**：`start()` 后立即 `reset()` -> 验证后续不调用 onMessage（token 失效）
3. **中途 skip**：模拟模式下 `start()` 后 `skip()` -> 验证当前发言提前输出完整内容（skipRequested 生效）
4. **paused 状态**：`start()` 后 `togglePause()` -> 验证循环阻塞；再 `togglePause()` -> 验证恢复
5. **未配 Key 跳过**：真实模式下 apiKey 为空 -> 验证 onMessage 推送跳过提示
6. **interject**：讨论进行中调用 `interject()` -> 验证 onMessage 追加 user 消息 + onToast 提示

**验证**：`npm run test:run` 全部通过 + 新增测试覆盖编排核心路径

---

## Phase 4：低优先级改进

### 4.1 parseLabelJson 健壮性改进（Q-M3）

**文件**：`frontend/src/services/analyzer.ts`

**改动**（第 155-167 行）：
- 先尝试 `JSON.parse(text)` 整体解析
- 失败后再用正则提取，正则改为 `/\{[\s\S]*?"label"[\s\S]*?\}/`
- 需配合括号配对验证，避免贪婪匹配过多

### 4.2 buildAPIHistory token 截断（Q-M4）

**文件**：`frontend/src/services/api.ts`

**改动**（第 22-28 行）：
- 在 `messages.forEach` 后，对 history 做截断：保留 system 消息 + 最近 N 条（如 20 条）
- 实现：`return [history[0], ...history.slice(-21)]`（保留 system + 最近 20 条 + 最后一条 user 提示）

### 4.3 escapeHtml 纯字符串实现（Q-L2）

**文件**：`frontend/src/utils/escape.ts`

**改动**：
```typescript
const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ESCAPE_MAP[ch]!)
}
```
- 更新 `escape.test.ts` 确保行为一致

### 4.4 导出标识符去 `_` 前缀（Q-L5）

**文件**：`frontend/src/services/analyzer.ts`、`frontend/src/services/analyzer.test.ts`

- `_STOPWORDS` -> `STOPWORDS`
- `_isCjk` -> `isCjk`
- 更新所有引用

---

## 假设与决策

1. **不引入 DOMPurify**：需修改 `package.json` 依赖（项目约定"需确认"）。当前 walkTokens + renderer 方案经源码验证有效，暂不引入。
2. **不拆分 Context**：React.memo 已解决最紧急的性能问题。Context 拆分收益相对小、改动大，留作后续按需优化。
3. **State/Action 移到 store/reducer.ts**：而非 types.ts，因为 types.ts 是领域类型，State/Action 是状态机定义，职责不同。
4. **simulatorId 方案**：在 ModelConfig 增加可选字段，而非改用 name 匹配，因为 name 可被用户修改。
5. **引擎采用 class 而非函数 + deps bag**：控制状态（active/paused/skipRequested/abortController/discussionToken）是引擎的实现，不是接口。class 使其 private，seam 只暴露 start/pause/skip/reset 命令。测试只需 mock 4 个 callbacks，不再需要构造 ref 对象。（架构审查候选 1）
6. **SSE 提取前置**：在引擎重构前先提取 parseSSEStream，使引擎搬迁时搬的是已简洁的调用，避免对同一段代码做两次结构性修改。（架构审查候选 2）
7. **startDiscussion 拆分为 start + interject**：消除隐式行为分叉，接口直接表达行为。interject 逻辑移入引擎，Context 仅做输入校验后委托。（架构审查候选 3）
8. **每个子项独立提交**：遵循项目 commit 规范 `<type>(<scope>): <subject>`。

---

## 验证步骤

### 每个阶段完成后
```bash
cd frontend
npm run typecheck    # TS 严格模式检查
npm run test:run     # 全部测试通过
npm run build        # 构建成功
```

### 全部完成后
```bash
make verify          # 一键门禁（等价于上述三条）
```

### 提交规范

开发时按 26 个小步提交（每步可独立验证），全部完成后按 [squash-and-split.md](../../docs/squash-and-split.md) 流程压缩为 13 个语义化提交。commit message 格式：`<type>(<scope>): <subject>`

**开发期小步提交（26 步，每步独立可验证）**：

<details>
<summary>点击展开完整 20 步列表</summary>

1. `fix(security): 修复 index.html image renderer alt 未转义 XSS`
2. `fix(security): 修复 index.html showToast innerHTML 未转义`
3. `fix(security): 修复 index.html 属性值未转义`
4. `fix(input): 轮次输入框增加范围校验`
5. `perf(components): MessageBubble 包裹 React.memo 减少流式重渲染`
6. `fix(simulator): 修复模拟模式模板匹配失效问题`
7. `fix(analyzer): 分析阶段接入外部 abort signal`
8. `fix(components): RoleBar 讨论中禁用模型切换`
9. `fix(context): (err as Error).message 改为安全类型判断`
10. `fix(context): localStorage.setItem 异常捕获`
11. `fix(context): loadModels 运行时校验`
12. `fix(api): streamChat reader try/finally 释放`
13. `fix(analyzer): directStreamAnalysis reader try/finally 释放`
14. `fix(context): generateResponse 开头重置 skipRequested`
15. `fix(context): exportDiscussion msg.round 空值检查`
16. `fix(analyzer): directStreamAnalysis 非 Abort 错误记录日志`
17. `refactor(context): 拆分 startDiscussion 为 start 和 interject`
18. `refactor(utils): 提取 SSE 解析公共函数 parseSSEStream`
19. `refactor(context): 抽离 reducer 到 store/reducer.ts`
20. `refactor(engine): 创建 class-based DiscussionEngine 编排引擎`
21. `refactor(context): DiscussionContext 委托引擎，移除 controlRef`
22. `test(engine): 为 DiscussionEngine 编排逻辑补充单测`
23. `fix(analyzer): parseLabelJson 健壮性改进`
24. `fix(api): buildAPIHistory 增加历史消息截断`
25. `perf(utils): escapeHtml 改用纯字符串替换`
26. `refactor(analyzer): 移除导出标识符下划线前缀`

</details>

**压缩后语义化提交（13 个，按 squash-and-split 分组原则合并）**：

| # | commit message | 合并来源 | 阶段 |
|---|---------------|----------|------|
| 1 | `fix(security): 修复 index.html 三处 XSS 漏洞` | 1+2+3 | P1 |
| 2 | `fix(input): 轮次输入框增加范围校验` | 4 | P1 |
| 3 | `perf(components): MessageBubble 包裹 React.memo 减少流式重渲染` | 5 | P2 |
| 4 | `fix(simulator): 修复模拟模式模板匹配失效问题` | 6 | P2 |
| 5 | `fix(analyzer): 分析健壮性改进（abort signal + 错误日志）` | 7+16 | P2 |
| 6 | `fix(components): RoleBar 讨论中禁用模型切换` | 8 | P2 |
| 7 | `fix(context): 修复错误处理、localStorage 异常和空值检查` | 9+10+11+15 | P2 |
| 8 | `fix(services): reader 显式释放和 skipRequested 重置` | 12+13+14 | P2 |
| 9 | `refactor(context): 拆分 startDiscussion 为 start 和 interject` | 17 | P2 |
| 10 | `refactor(utils): 提取 SSE 解析公共函数 parseSSEStream` | 18 | P2.5 |
| 11 | `refactor(engine): 抽离 DiscussionEngine 编排引擎并补充单测` | 19+20+21+22 | P3 |
| 12 | `fix(services): parseLabelJson 健壮性 + buildAPIHistory 截断` | 23+24 | P4 |
| 13 | `refactor(utils): escapeHtml 纯字符串实现 + 标识符重命名` | 25+26 | P4 |

**合并依据**（遵循 squash-and-split 分组原则：按功能模块/变更性质划分，非按文件类型）：

- **#1**：三处 XSS 同属 index.html 安全修复，同一变更性质
- **#5**：abort signal 和错误日志同属 analyzer 健壮性改进，同一文件同一关注点
- **#7**：错误类型判断、localStorage 异常、loadModels 校验、空值检查同属 DiscussionContext 边界修复
- **#8**：reader 释放（api.ts + analyzer.ts）和 skipRequested 重置同属资源管理 + 状态清理
- **#11**：reducer 抽离 + 引擎创建 + Context 委托 + 补测试为**原子重构**，四步缺一不可，单独提交无法通过 typecheck
- **#12**：parseLabelJson 和 buildAPIHistory 同属 services 层健壮性改进
- **#13**：escapeHtml 纯字符串和标识符重命名同属 utils/analyzer 轻量清理

---

## 执行顺序与依赖关系

```
Phase 1 (安全) ──────────────────────────────────────── 可独立执行
  ├─ 1.1 index.html XSS
  └─ 1.2 InputBar 校验

Phase 2 (质量修复) ──────────────────────────────────── 可独立执行（与 Phase 1 无依赖）
  ├─ 2.1 MessageBubble memo     ← 不碰 DiscussionContext
  ├─ 2.2 simulator 修复         ← 不碰 DiscussionContext（碰 types.ts + presetModels.ts）
  ├─ 2.3 analyzer abort signal  ← 碰 analyzer.ts + DiscussionContext
  ├─ 2.4 RoleBar guard          ← 不碰 DiscussionContext
  ├─ 2.5 错误处理               ← 碰 DiscussionContext
  ├─ 2.6 reader 释放            ← 碰 api.ts + analyzer.ts + DiscussionContext
  ├─ 2.7 exportDiscussion       ← 碰 DiscussionContext
  ├─ 2.8 错误日志               ← 碰 analyzer.ts
  └─ 2.9 startDiscussion 拆分   ← 碰 DiscussionContext + InputBar

Phase 2.5 (SSE 提取) ────────────────────────────────── 依赖 Phase 2 完成（api.ts/analyzer.ts 已稳定）
  └─ 2.5.1 parseSSEStream 提取  ← 新建 sse.ts，改 api.ts + analyzer.ts

Phase 3 (重构) ──────────────────────────────────────── 依赖 Phase 2 + 2.5 完成
  ├─ 3.1 抽离 reducer.ts        ← 纯迁移
  ├─ 3.2 创建 DiscussionEngine  ← 新建 discussionEngine.ts
  ├─ 3.3 改造 DiscussionContext  ← 委托引擎，移除 controlRef/messagesRef/topicRef
  ├─ 3.4 更新测试引用            ← reducer.test.ts + loadModels.test.ts
  └─ 3.5 补编排测试              ← 新建 discussionEngine.test.ts

Phase 4 (低优先级) ──────────────────────────────────── 依赖 Phase 3 完成
  ├─ 4.1 parseLabelJson
  ├─ 4.2 buildAPIHistory 截断
  ├─ 4.3 escapeHtml 纯字符串
  └─ 4.4 导出标识符重命名
```

### 关键架构变化对比

| 维度 | 改造前 | 改造后 |
|------|--------|--------|
| 控制状态位置 | controlRef（Context 内）+ dispatch（镜像到 state） | DiscussionEngine private 字段 |
| 消息 ref | messagesRef（Context 内）+ state.messages（双写） | DiscussionEngine private messages |
| 编排逻辑 | useMemo 闭包内，无法测试 | DiscussionEngine class 方法，可独立测试 |
| 控制命令 | togglePause/nextSpeaker/resetDiscussion 操作 controlRef | engine.togglePause()/skip()/reset() |
| 引擎接口 | N/A（逻辑在闭包内） | start(config) / togglePause() / skip() / reset() / interject(topic) |
| 测试 mock | N/A | 4 个 callbacks（onMessage/onUpdate/onDispatch/onToast）|
| SSE 解析 | api.ts + analyzer.ts 各 24 行重复 | utils/sse.ts parseSSEStream（单份） |
| startDiscussion | 一个函数两种行为（隐式分叉） | start() + interject() 各司其职 |
