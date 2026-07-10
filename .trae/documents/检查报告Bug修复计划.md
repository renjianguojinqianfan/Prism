# 检查报告 Bug 修复计划

> **历史文档**：以下内容反映修复时的状态。后续变更：
> - 前端测试从 75 增长至 82 个用例
> - 后端测试维持 63 个用例
> - 当前以实际测试文件为准

> 对应报告：`e:\code\Prism\.trae\documents\检查报告.md`
> 核实结论：报告中 4 个问题（Bug #1/#2/#3 + 安全建议）**全部真实存在**，已逐行核对源码确认。
> 遵循 AGENTS.md：改代码前先说明计划；TS 严格模式；不引入新依赖；最小改动原则。

## 一、Summary（概要）

按报告优先级顺序修复 4 个问题，其中 3 个为 DiscussionContext.tsx 内的编排缺陷，1 个为 markdown.ts 的 XSS 加固。修复 4（XSS）新增单元测试覆盖协议白名单；Bug #1/#2/#3 因 `generateResponse` 在 `useMemo` 闭包内未导出，按 AGENTS.md「禁止不必要重构」原则不做导出式改造，依靠联调验证。

## 二、Current State Analysis（现状分析）

| Bug | 文件:行号 | 根因（已逐行核对） |
|-----|-----------|------|
| #1 🔴 | `DiscussionContext.tsx:340-360` | 非模拟路径先 `pushMessage` 空占位（同步更新 `messagesRef.current`，见 [L216](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx#L216)）后 `buildAPIHistory`，导致空 `[ModelName] ` 被纳入 payload（[buildAPIHistory L22-28](file:///e/code/Prism/frontend/src/services/api.ts#L22-L28) 不检查 `thinking`）。模拟路径（L319-320）顺序正确，对比成立。 |
| #2 🟡 | `DiscussionContext.tsx:275-278, 319-339` | `nextSpeaker` 仅 `abortController?.abort()`；模拟路径不创建 `AbortController`，循环只检查 `active`/`paused`，`?.abort()` 静默空操作，Toast 仍弹"已跳过"。 |
| #3 🟡 | `DiscussionContext.tsx:361-365` | `catch` 块 `AbortError` 分支 `return` 跳过 L367 `updateMessage(..., thinking:false)`，消息永久 `thinking:true`，被 L466 `!m.thinking` 过滤排除分析，又被 buildAPIHistory 纳入历史（与 #1 叠加）。 |
| 安全 ⚠️ | `markdown.ts:9-15` + `MessageBubble.tsx:92` | `marked.use` 仅 `walkTokens` 转义 `html` token，未对 link/image `href` 做协议白名单；`marked@^12.0.2` 默认对 `javascript:`/`data:`/`vbscript:` 过滤不完整；`dangerouslySetInnerHTML` 直接注入。 |

## 三、Proposed Changes（修复方案）

### 修复 1：Bug #1 — 调换非模拟路径顺序

**文件**：[frontend/src/store/DiscussionContext.tsx](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx#L340-L360)

**What**：将 `buildAPIHistory` 与 `new AbortController()` 调用移到 `pushMessage` 占位消息之前，与模拟路径（L319-320）顺序一致。

**Why**：`pushMessage`（L216）同步更新 `messagesRef.current`，若先 push 空占位则该占位会被 `buildAPIHistory` 纳入 payload，造成 LLM 历史污染。调换顺序后，构建历史时 `messagesRef.current` 不含当前发言的占位消息，问题消除。

**How（替换 L340-L360 的 else 分支）**：
```typescript
} else {
    // 先构建 API 历史（此时 messagesRef.current 不含当前发言的占位消息）
    controlRef.current.abortController = new AbortController()
    const history = buildAPIHistory(model, round, topicRef.current, messagesRef.current)

    // 再推占位消息用于 UI 流式显示
    pushMessage({
        id: msgId,
        role: 'assistant',
        content: '',
        modelId: model.id,
        modelName: model.name,
        round,
        thinking: true
    })

    fullContent = await streamChat(
        model,
        history,
        controlRef.current.abortController.signal,
        (_delta, full) => {
            updateMessage(msgId, { content: full, thinking: true })
        }
    )
}
```

**测试**：无单元测试（`generateResponse` 在 `useMemo` 闭包内未导出，按 AGENTS.md 不重构导出）。依靠联调验证（Network 面板）。

---

### 修复 2：Bug #2 — 模拟模式跳过

**文件**：[frontend/src/store/DiscussionContext.tsx](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx)

**What**：在 `controlRef` 中新增 `skipRequested` 标志位；`nextSpeaker` 设置该标志；模拟打字循环检查该标志，命中则立即显示完整回复并跳出循环，循环外重置标志。

**Why**：模拟路径不创建 `AbortController`，`abort()` 为空操作；循环只看 `active`/`paused`，无法响应跳过。新增标志位是最小侵入式修复，避免为模拟路径引入不必要的 AbortController。

**How（3 处改动）**：

1. **[controlRef 定义 L179-183](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx#L179-L183)** 增加 `skipRequested: false`：
```typescript
const controlRef = useRef({
    active: false,
    paused: false,
    skipRequested: false,
    abortController: null as AbortController | null
})
```

2. **[nextSpeaker L275-278](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx#L275-L278)** 设置标志：
```typescript
const nextSpeaker = useCallback(() => {
    controlRef.current.skipRequested = true
    controlRef.current.abortController?.abort()
    showToast('已跳过当前发言者', 'info')
}, [showToast])
```

3. **[模拟打字循环 L330-339](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx#L330-L339)** 增加跳过检查 + 循环外重置：
```typescript
for (let i = 0; i < reply.length; i++) {
    if (!controlRef.current.active) return
    if (controlRef.current.skipRequested) {
        fullContent = reply
        updateMessage(msgId, { content: fullContent, thinking: true })
        break
    }
    while (controlRef.current.paused) {
        await sleep(100)
        if (!controlRef.current.active) return
    }
    fullContent += reply[i]
    updateMessage(msgId, { content: fullContent, thinking: true })
    await sleep(20 + Math.random() * 30)
}
controlRef.current.skipRequested = false
```
（注：`return` 提前退出时由调用方上下文决定，不在此重置；正常讨论流程下 `skipRequested` 在循环末尾或 break 后被重置。若 `!active` 提前 return，整个讨论已结束，标志位残留无害，下次 `startDiscussion` 时 `controlRef.current.active = true` 不重置 `skipRequested`——需在 `startDiscussion` L513-514 增加 `controlRef.current.skipRequested = false` 以保证状态干净。）

**补充改动**：[startDiscussion L513-514](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx#L513-L514) 增加重置：
```typescript
controlRef.current.active = true
controlRef.current.paused = false
controlRef.current.skipRequested = false
```

**测试**：无单元测试（同 #1 原因）。依靠联调验证。

---

### 修复 3：Bug #3 — AbortError 后补全消息状态

**文件**：[frontend/src/store/DiscussionContext.tsx 第 361-365 行](file:///e/code/Prism/frontend/src/store/DiscussionContext.tsx#L361-L365)

**What**：在 `AbortError` 提前 return 之前补全消息最终状态（`thinking: false`，content 取已输出部分或 `[已跳过]`）。

**Why**：当前 `return` 跳过 L367 `updateMessage(..., thinking:false)`，消息永久 `thinking:true`，UI 显示"思考中"动画且被分析流程过滤排除。

**How（替换 L361-365 的 catch 块）**：
```typescript
} catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
        updateMessage(msgId, { content: fullContent || '[已跳过]', thinking: false })
        return
    }
    fullContent = `[调用失败] ${(err as Error).message}`
    showToast(`${model.name} 调用出错：${(err as Error).message}`, 'error')
}
```

**测试**：无单元测试（同 #1 原因）。依靠联调验证。

---

### 修复 4：安全加固 — Markdown 链接协议白名单

**文件**：[frontend/src/utils/markdown.ts](file:///e/code/Prism/frontend/src/utils/markdown.ts#L9-L15)

**What**：在现有 `marked.use({ walkTokens })` 配置中增加 `renderer.link` 与 `renderer.image`，对 `href` 做协议白名单校验。

**Why**：当前仅对 `html` 类型 token 转义，未覆盖 `link`/`image` token 的 `href`。`marked@^12.0.2` 默认对 `javascript:`/`data:`/`vbscript:` 过滤不完整，叠加 `dangerouslySetInnerHTML` 注入存在 XSS 风险（可窃取 `localStorage` 中的 API Key）。

**How（替换 L9-15）**：
```typescript
marked.use({
    walkTokens(token) {
        if (token.type === 'html') {
            token.text = escapeHtml(token.text)
        }
    },
    renderer: {
        link({ href, title, text }) {
            if (href && !/^(https?:|mailto:|tel:)/i.test(href)) href = ''
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
        },
        image({ href, title, text }) {
            if (href && !/^https?:/i.test(href)) return ''
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
            return `<img src="${href}" alt="${text}"${titleAttr} />`
        }
    }
})
```

**协议白名单**：
- link：`http:` / `https:` / `mailto:` / `tel:`（允许），其余置空 href
- image：仅 `http:` / `https:`（更严格，因 `<img src>` 触发请求，不允许 `mailto:`/`tel:`），其余完全移除

**Why 不引入 DOMPurify**：AGENTS.md「禁止在前端引入除 marked 之外的大型依赖」，DOMPurify 属新依赖；renderer 白名单已覆盖当前向量，无需引入。

**测试**：新增单元测试（见下）。

---

### 新增测试：markdown.test.ts 追加用例

**文件**：[frontend/src/utils/markdown.test.ts](file:///e/code/Prism/frontend/src/utils/markdown.test.ts)（已存在，追加 describe 块）

**新增测试用例**（约 5 条）：
```typescript
describe('renderMarkdown — 链接协议白名单（XSS 加固）', () => {
    it('javascript: 链接 → href 被置空', () => {
        const r = renderMarkdown('[click](javascript:alert(1))')
        expect(r).not.toContain('javascript:')
        expect(r).toContain('href=""')
    })

    it('vbscript: 链接 → href 被置空', () => {
        const r = renderMarkdown('[x](vbscript:msgbox(1))')
        expect(r).not.toContain('vbscript:')
    })

    it('data: 图片 → 整个 img 被移除', () => {
        const r = renderMarkdown('![img](data:image/png;base64,xxx)')
        expect(r).not.toContain('<img')
        expect(r).not.toContain('data:')
    })

    it('https 链接 → 保留并含 target=_blank 与 rel=noopener', () => {
        const r = renderMarkdown('[link](https://example.com)')
        expect(r).toContain('href="https://example.com"')
        expect(r).toContain('target="_blank"')
        expect(r).toContain('rel="noopener noreferrer"')
    })

    it('mailto/tel 链接 → 保留', () => {
        expect(renderMarkdown('[m](mailto:a@b.com)')).toContain('mailto:a@b.com')
        expect(renderMarkdown('[t](tel:10086)')).toContain('tel:10086')
    })
})
```

## 四、Assumptions & Decisions（假设与决策）

1. **不重构 `generateResponse` 导出**：Bug #1/#2/#3 修复点均在 `useMemo` 闭包内的 `generateResponse` 函数中，未导出。按 AGENTS.md「Surgical Changes」「禁止不必要重构」原则，不为单元测试导出该函数，依靠联调验证。
2. **不引入 DOMPurify**：按 AGENTS.md「禁止引入除 marked 外大型依赖」，采用 `renderer` 白名单方案。
3. **Bug #2 采用方案一（标志位）而非方案二**：报告提供两种方案，方案一（`skipRequested` 标志）更显式且与 `paused`/`active` 模式一致，方案二虽简单但语义模糊。
4. **`skipRequested` 在 `startDiscussion` 中重置**：避免上一轮讨论残留标志位影响下一轮。
5. **测试仅覆盖 Bug #4**：Bug #1/#2/#3 难以单元测试（函数未导出），Bug #4 的 `renderMarkdown` 已导出且测试基础设施完备，新增 5 条用例。
6. **修复顺序**：1 → 2 → 3 → 4（按报告优先级，#1 阻塞核心功能先修）。
7. **提交策略**：每个修复独立 commit，遵循 AGENTS.md `<type>: <描述>` 规范：
   - `fix: 非模拟模式 LLM 历史被空占位污染`
   - `fix: 模拟模式跳过按钮无效`
   - `fix: 非模拟模式跳过后消息永久思考中`
   - `fix: Markdown 链接协议白名单防 XSS`

## 五、Verification Steps（验证步骤）

按顺序执行：

1. **类型检查**：`cd frontend && npm run typecheck`
   - 通过 TS 严格模式（`strict` + `noUnusedLocals` + `noUnusedParameters`）

2. **单元测试**：`cd frontend && npm run test:run`
   - 现有 75 用例不回归
   - 新增 5 条 markdown 协议白名单测试全过
   - 总计 80 用例通过

3. **后端测试**（确认无回归）：`cd backend && pytest`
   - 63 用例通过

4. **联调验证**（前端 `npm run dev` + 后端 `uvicorn main:app --reload`）：
   - **Bug #1**：非模拟模式发起讨论，浏览器 Network 面板检查 `/chat/completions` 请求 payload，确认 `messages` 数组末尾**不再包含** `[ModelName] ` 空条目（仅末尾为 `user: "现在轮到你发言了..."`）
   - **Bug #2**：模拟模式逐字输出中点击"跳过"，消息立即显示完整内容（非继续逐字），Toast 正常弹出
   - **Bug #3**：非模拟模式流式输出中点击"跳过"，消息停止"思考中"动画，显示已输出部分或 `[已跳过]`，且该消息在后续轮次中能被分析流程正确处理（不永久 thinking）
   - **Bug #4**：在模拟模式中临时修改 `simulator.ts` 注入 `[x](javascript:alert(1))` 与 `![img](data:image/png;base64,xxx)` 验证渲染（验证后回滚 simulator.ts 改动），或直接在 `markdown.test.ts` 已覆盖

5. **构建验证**：`cd frontend && npm run build`
   - `tsc + vite build` 通过

## 六、Out of Scope（不在本次范围）

- 不修复报告中「✅ 未发现问题的区域」
- 不重构 `generateResponse`/`nextSpeaker` 为可测导出形式
- 不引入 DOMPurify 或其他消毒库
- 不修改后端代码
- 不修改 UI 风格、CSS 变量、动效
- 不修改根目录 `index.html` 原型（其 Markdown 渲染使用 CDN marked，与本修复无关）
