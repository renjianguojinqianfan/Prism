# Prism 真实共识/分歧分析改造方案

> change-id: `prism-real-consensus-analysis`
> 创建时间：2026-06-30
> 关联 spec：`e:\code\Prism\.trae\specs\add-real-consensus-analysis\spec.md`

## Summary

把 Prism 的共识/分歧分析从「Jaccard 关键词匹配」升级为「发言者自评 + 实时增量 + SSE 流式」：

1. **分析者 = 发言者自己**：DeepSeek 发言后由 DeepSeek 自评，Mimo 发言后由 Mimo 自评，依此类推。每条发言只有 1 个标签（无投票聚合）。
2. **实时增量**：每条 AI 发言结束立即调一次后端，不等讨论全部结束。
3. **SSE 流式**：后端把发言者自己 LLM 的分析输出过程流式推回前端。
4. **第一条发言作为基准**：讨论话题的第一条 AI 发言不带标签，从第二条开始才做对比分析。
5. **移除预设模型**：用户在 SettingsPanel 自填，提供「快速添加模板」按钮（DeepSeek/Kimi/通义/Mimo）一键填好 endpoint/model，用户只需填 Key。
6. **分析 Key 在后端环境变量**：前端不传 Key 给后端，后端按 model 名查找环境变量里的 Key（不暴露给前端，最安全）。
7. **三级容错**：发言者自评失败 → 后端 Jaccard 回退；后端不可达 → 前端 localHeuristicAnalyze。

## Current State Analysis

### 现状（基于代码扫描）

| 文件 | 现状 |
|---|---|
| [`main.py`](file:///e:/code/Prism/main.py) | `POST /api/analyze` 是 Jaccard 2-gram 关键词匹配，无 LLM 调用 |
| [`frontend/src/services/analyzer.ts`](file:///e:/code/Prism/frontend/src/services/analyzer.ts) | `localHeuristicAnalyze` 前端 TS 版 Jaccard；`fetchAnalysis` 调后端 |
| [`frontend/src/store/DiscussionContext.tsx`](file:///e:/code/Prism/frontend/src/store/DiscussionContext.tsx) | `analyzeMessages()` 在讨论全部结束后批量调一次 `/api/analyze` |
| [`frontend/src/config/presetModels.ts`](file:///e:/code/Prism/frontend/src/config/presetModels.ts) | 4 个预设（DeepSeek/Kimi/GLM/通义），默认全选 |
| [`frontend/src/store/DiscussionContext.tsx#L67-L76`](file:///e:/code/Prism/frontend/src/store/DiscussionContext.tsx#L67-L76) | `loadModels()` 自动 push 缺失的预设 |
| [`spec.md`](file:///e:/code/Prism/.trae/specs/add-real-consensus-analysis/spec.md) | 第 20 行/第 57 行声称「真实 LLM 分析」但实际是 Jaccard |

### 关键问题
- spec 与代码严重不一致：spec 说「真实 LLM 分析」但 main.py 全程无 LLM 调用
- 前后端算法同构，后端存在不增加分析能力价值
- 当前是「讨论结束批量分析」，不是「实时增量」
- 当前 4 个预设模型与新设计「用户自填」冲突

## Proposed Changes

### A. 后端改造（`main.py` + `requirements.txt` + `.env.example`）

#### A1. `requirements.txt` 新增 httpx
```diff
  fastapi>=0.110
  uvicorn[standard]>=0.27
  pydantic>=2.5
+ httpx>=0.27
```

#### A2. `.env.example` 新增分析 Key 配置
```diff
  PRISM_PORT=8000
  PRISM_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
- # 后续若需要后端代理调用模型，将在此添加 *_API_KEY 占位
+ # 分析模型 Key 池：JSON 字符串，key=模型名（与前端 SettingsPanel 中 model 字段一致），value=API Key
+ # 示例：{"deepseek-chat":"sk-xxx","mimo-v2.5":"sk-yyy","qwen-turbo":"sk-zzz"}
+ PRISM_ANALYZER_API_KEYS=
```

#### A3. `main.py` 改造

**新增 Pydantic 模型：**
```python
class AnalyzerMessage(BaseModel):
    id: str
    modelName: str
    model: str          # 模型标识，用于后端匹配 Key
    content: str

class StreamAnalyzeRequest(BaseModel):
    topic: str
    currentMessage: AnalyzerMessage
    priorMessages: list[AnalyzerMessage] = Field(default_factory=list)
```

**新增 Key 池加载：**
```python
import json

def _load_analyzer_keys() -> dict[str, str]:
    """从 PRISM_ANALYZER_API_KEYS 加载分析 Key 池。返回 {model_name: api_key}"""
    raw = os.getenv("PRISM_ANALYZER_API_KEYS", "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return {str(k): str(v) for k, v in data.items()}
    except json.JSONDecodeError:
        pass
    return {}
```

**新增 Prompt 构造：**
```python
ANALYZER_SYSTEM_PROMPT = """你是一个观点分析助手。你刚刚参与了关于「{topic}」的讨论，现在需要分析自己刚才的发言与前文其他参与者的发言之间的关系。

前文参与者发言：
{prior_messages}

你刚才的发言：
{your_message}

请判断你的发言与前文整体的关系：
- consensus（共识）：你的观点与前文多数观点方向一致或补充支持
- divergence（分歧）：你的观点与前文有明显对立、反驳或不同立场
- neutral（中立）：你的发言是新角度、新信息或方向拓展，无明显共识/分歧

只输出 JSON，不要任何额外文字：
{{"label": "consensus|divergence|neutral", "evidence": "一句话证据，不超过50字"}}
"""
```

**新增 SSE 端点 `/api/analyze/stream`：**
```python
from fastapi.responses import StreamingResponse
import httpx

@app.post("/api/analyze/stream")
async def analyze_stream(req: StreamAnalyzeRequest):
    """
    SSE 流式分析：后端用发言者自己的 LLM 做自评，流式推回。
    Key 从 PRISM_ANALYZER_API_KEYS 按 model 名查找。
    找不到 Key 或调用失败 → 推送 fallback event，前端用 Jaccard。
    """
    keys = _load_analyzer_keys()
    api_key = keys.get(req.currentMessage.model)

    if not api_key:
        # 无 Key，回退 Jaccard
        async def fallback_stream():
            yield 'data: {"type":"fallback","reason":"no_key"}\n\n'
        return StreamingResponse(fallback_stream(), media_type="text/event-stream")

    # 构造 prompt
    prior_text = "\n\n".join(
        f"{m.modelName}：{m.content}" for m in req.priorMessages
    ) or "（无前文，这是首条发言）"
    prompt = ANALYZER_SYSTEM_PROMPT.format(
        topic=req.topic,
        prior_messages=prior_text,
        your_message=req.currentMessage.content,
    )

    async def stream_llm():
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    _infer_endpoint_from_model(req.currentMessage.model),
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": req.currentMessage.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": True,
                        "temperature": 0.3,
                    },
                ) as resp:
                    if resp.status_code != 200:
                        yield f'data: {{"type":"fallback","reason":"http_{resp.status_code}"}}\n\n'
                        return
                    buffer = ""
                    full = ""
                    async for chunk in resp.aiter_text():
                        buffer += chunk
                        lines = buffer.split("\n")
                        buffer = lines.pop() or ""
                        for line in lines:
                            line = line.strip()
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    continue
                                try:
                                    j = json.loads(data)
                                    delta = j.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                    if delta:
                                        full += delta
                                        yield f'data: {{"type":"delta","content":{json.dumps(delta)}}}\n\n'
                                except json.JSONDecodeError:
                                    pass
                    # 流结束，尝试解析 full 为 JSON
                    parsed = _parse_label_json(full)
                    if parsed:
                        yield f'data: {{"type":"final","label":"{parsed["label"]}","evidence":{json.dumps(parsed["evidence"])}}}\n\n'
                    else:
                        yield f'data: {{"type":"fallback","reason":"parse_failed"}}\n\n'
        except (httpx.TimeoutException, httpx.HTTPError) as e:
            yield f'data: {{"type":"fallback","reason":"network_error"}}\n\n'

    return StreamingResponse(stream_llm(), media_type="text/event-stream")
```

**辅助函数：**
```python
def _infer_endpoint_from_model(model: str) -> str:
    """根据 model 名推断默认 endpoint。如果用户在请求里传了 endpoint 优先用请求里的。"""
    # 由请求传入的 endpoint 优先（见下文 A3 补丁）
    return ""  # 实际从 req.currentMessage.endpoint 取

def _parse_label_json(text: str) -> dict | None:
    """容错解析 LLM 输出为 {label, evidence}"""
    import re
    # 找 JSON 块
    m = re.search(r'\{[^{}]*"label"[^{}]*\}', text)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        if obj.get("label") in ("consensus", "divergence", "neutral"):
            return {"label": obj["label"], "evidence": obj.get("evidence", "")}
    except json.JSONDecodeError:
        pass
    return None
```

**关键决策：** `AnalyzerMessage` 增加 `endpoint` 字段，前端传过来。后端用这个 endpoint + 环境变量查到的 Key 调 LLM。这样兼容任意自定义模型。

**保留 `/api/analyze`（Jaccard）** 作为同步回退接口，前端在 SSE 收到 fallback event 时调用它。

### B. 前端改造

#### B1. `frontend/src/config/presetModels.ts`

```diff
-export const PRESET_MODELS: ModelConfig[] = [
-  // ... 4 个预设 ...
-]
+export const PRESET_MODELS: ModelConfig[] = []
+
+// 快速添加模板（不在默认列表，用户点击 + 才加入）
+export const QUICK_TEMPLATES: Array<Pick<ModelConfig, 'name' | 'icon' | 'color' | 'endpoint' | 'model' | 'systemPrompt'>> = [
+  {
+    name: 'DeepSeek',
+    icon: 'fa-brain',
+    color: '#10B981',
+    endpoint: 'https://api.deepseek.com/v1/chat/completions',
+    model: 'deepseek-chat',
+    systemPrompt: '你是DeepSeek，一位善于深度逻辑分析的思考者。回答控制在200字以内。',
+  },
+  {
+    name: 'Kimi',
+    icon: 'fa-moon',
+    color: '#F43F5E',
+    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
+    model: 'moonshot-v1-8k',
+    systemPrompt: '你是Kimi，一位富有创造力的创新思考者。回答控制在200字以内。',
+  },
+  {
+    name: '通义千问',
+    icon: 'fa-fire',
+    color: '#F97316',
+    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
+    model: 'qwen-turbo',
+    systemPrompt: '你是通义千问，一位务实落地的实践者。回答控制在200字以内。',
+  },
+  {
+    name: 'Mimo',
+    icon: 'fa-bolt',
+    color: '#8B5CF6',
+    endpoint: 'https://api.mimo.com/v1/chat/completions',  // 待用户确认实际端点
+    model: 'mimo-v2.5',
+    systemPrompt: '你是Mimo，一位思维敏捷的辩论者。回答控制在200字以内。',
+  },
+]

-export const PRESET_IDS = ['deepseek', 'kimi', 'glm', 'qwen']
+// 移除 PRESET_IDS（不再需要）
```

#### B2. `frontend/src/store/DiscussionContext.tsx`

**移除 loadModels 中自动 push 预设的逻辑（[L67-L76](file:///e:/code/Prism/frontend/src/store/DiscussionContext.tsx#L67-L76)）：**
```diff
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as ModelConfig[]
-     PRESET_MODELS.forEach(preset => {
-       if (!parsed.find(m => m.id === preset.id && !m.custom)) {
-         parsed.push({ ...preset })
-       }
-     })
      return parsed
    } catch {
-     return PRESET_MODELS.map(m => ({ ...m }))
+     return []
    }
  }
- return PRESET_MODELS.map(m => ({ ...m }))
+ return []
```

**initState 中 `models` 默认空数组（已经是 `loadModels()` 返回值，自动跟随）。**

**修改 `analyzeMessages` 为 `streamAnalyzeMessage`（单条发言流式分析）：**

替换 [`DiscussionContext.tsx#L356-L375`](file:///e:/code/Prism/frontend/src/store/DiscussionContext.tsx#L356-L375) 的批量 `analyzeMessages` 为：

```typescript
const streamAnalyzeMessage = async (
  currentMsg: Message,
  priorAiMsgs: Message[],
  isBaseline: boolean
) => {
  if (isBaseline) return  // 第一条作为基准，不带标签

  const model = state.models.find(m => m.id === currentMsg.modelId)
  if (!model) return

  const payload = {
    topic: topicRef.current || '',
    currentMessage: {
      id: currentMsg.id,
      modelName: currentMsg.modelName,
      model: model.model,
      endpoint: model.endpoint,
      content: currentMsg.content,
    },
    priorMessages: priorAiMsgs.map(m => ({
      id: m.id,
      modelName: m.modelName,
      model: '',  // 前文不需要 model 字段
      content: m.content,
    })),
  }

  try {
    const finalTag = await streamAnalysis(ANALYZE_ENDPOINT, payload, (delta) => {
      // 可选：流式更新分析过程展示（暂不实现 UI，只接收）
    })
    if (finalTag) {
      updateMessage(currentMsg.id, {
        tag: { label: finalTag.label, evidence: finalTag.evidence, analyzer: currentMsg.modelName },
      })
      return
    }
  } catch {
    // 流失败，走回退
  }

  // 回退：调用后端 Jaccard
  const fallbackTag = await fetchAnalysis(ANALYZE_FALLBACK_ENDPOINT, {
    topic: payload.topic,
    messages: [payload.currentMessage, ...payload.priorMessages],
  })
  if (fallbackTag && fallbackTag[0]) {
    updateMessage(currentMsg.id, {
      tag: { label: fallbackTag[0].label, evidence: fallbackTag[0].evidence, analyzer: '本地启发式' },
    })
  } else {
    // 后端不可达，前端 localHeuristicAnalyze
    const localTags = localHeuristicAnalyze([
      ...payload.priorMessages.map(m => ({ id: m.id, modelName: m.modelName, content: m.content })),
      { id: payload.currentMessage.id, modelName: payload.currentMessage.modelName, content: payload.currentMessage.content },
    ])
    const myTag = localTags[localTags.length - 1]
    if (myTag) {
      updateMessage(currentMsg.id, {
        tag: { label: myTag.label, evidence: myTag.evidence, analyzer: '本地启发式' },
      })
    }
  }
}
```

**在 `runDiscussion` 循环中调用流式分析（替换 [`L408-L417`](file:///e:/code/Prism/frontend/src/store/DiscussionContext.tsx#L408-L417)）：**

```diff
  for (const round = 1; round <= state.maxRounds; round++) {
    dispatch({ type: 'SET_CURRENT_ROUND', value: round })
    for (const model of enabledModels) {
      // ... 现有发言逻辑 ...
      dispatch({ type: 'SET_SPEAKING', id: model.id })
      await generateResponse(model, round, simulate)
      dispatch({ type: 'SET_SPEAKING', id: null })

+     // 实时增量分析：发言结束后立即分析这条
+     if (!simulate) {
+       const aiMsgs = messagesRef.current.filter(m => m.role === 'assistant' && !m.thinking)
+       const current = aiMsgs[aiMsgs.length - 1]
+       const prior = aiMsgs.slice(0, -1)
+       const isBaseline = aiMsgs.length === 1  // 第一条作为基准
+       await streamAnalyzeMessage(current, prior, isBaseline)
+     }
+
      await sleep(600)
    }
  }

  pushMessage({
    id: genId(),
    role: 'system',
    content: '讨论结束',
    modelId: null,
    modelName: '',
  })
- await analyzeMessages(simulate)
  endDiscussion()
```

#### B3. `frontend/src/store/types.ts`

```diff
  export interface MessageTag {
    label: TagLabel
    evidence?: string
+   analyzer?: string  // 谁自评的（模型名）
  }
```

#### B4. `frontend/src/services/analyzer.ts`

新增 `streamAnalysis`：

```typescript
export interface StreamAnalysisResult {
  label: AnalysisTag['label']
  evidence: string
}

export async function streamAnalysis(
  endpoint: string,
  payload: {
    topic: string
    currentMessage: { id: string; modelName: string; model: string; endpoint: string; content: string }
    priorMessages: Array<{ id: string; modelName: string; model: string; content: string }>
  },
  onDelta?: (delta: string) => void,
  timeoutMs = 30000
): Promise<StreamAnalysisResult | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!resp.ok || !resp.body) return null

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let final: StreamAnalysisResult | null = null

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
        try {
          const evt = JSON.parse(data)
          if (evt.type === 'delta' && onDelta) {
            onDelta(evt.content)
          } else if (evt.type === 'final') {
            final = { label: evt.label, evidence: evt.evidence }
          } else if (evt.type === 'fallback') {
            return null  // 让上层走回退
          }
        } catch {
          /* 忽略解析错误 */
        }
      }
    }
    return final
  } catch {
    return null
  }
}
```

#### B5. `frontend/src/components/SettingsPanel.tsx`

- 顶部加建议文案：「建议使用不同厂商的模型（如 DeepSeek、Kimi、通义），观点碰撞更充分」
- 在「添加自定义模型」按钮上方加「快速添加模板」按钮组（4 个：DeepSeek/Kimi/通义/Mimo）
- 点击模板按钮 → 调用 `addCustomModel()` 并预填 template 字段（需要新增一个 `addModelFromTemplate(template)` action）
- 模型列表为空时自动展开（在 `initState` 中 `settingsOpen: state.models.length === 0`）

```diff
+ <p className="text-xs mb-4 p-3 rounded-xl" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
+   <i className="fas fa-circle-info mr-1"></i>建议使用不同厂商的模型（如 DeepSeek、Kimi、通义），观点碰撞更充分
+ </p>
+
+ <div className="mb-4 flex flex-wrap gap-2">
+   {QUICK_TEMPLATES.map(tpl => (
+     <button
+       key={tpl.name}
+       onClick={() => addModelFromTemplate(tpl)}
+       className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-[var(--border)] hover:border-[var(--accent)] transition-all"
+       style={{ color: tpl.color }}
+     >
+       <i className={`fas ${tpl.icon} mr-1`}></i>+ {tpl.name}
+     </button>
+   ))}
+ </div>
```

#### B6. `frontend/src/components/MessageList.tsx`

空状态文案修改：

```diff
- <p className="text-sm max-w-md" style={{ color: 'var(--muted)' }}>
-   输入你的想法，邀请多位AI从不同视角展开讨论。他们各自拥有独特的思维风格——有人深度分析，有人天马行空，有人追求落地。
- </p>
+ <p className="text-sm max-w-md" style={{ color: 'var(--muted)' }}>
+   推荐添加 3-4 个不同的 AI 模型，让它们从不同视角展开讨论。
+ </p>
```

#### B7. `frontend/src/components/MessageBubble.tsx`

标签下方显示「由 X 自评」：

```diff
  {msg.tag && (
    <span
      className={`msg-tag ${msg.tag.label}`}
      title={msg.tag.evidence || ''}
    >
      {TAG_TEXT[msg.tag.label]}
+     {msg.tag.analyzer && (
+       <span className="text-[9px] ml-1 opacity-60">· {msg.tag.analyzer}自评</span>
+     )}
    </span>
  )}
```

#### B8. `frontend/src/components/ModelSelector.tsx`

模型列表为空时显示「前往配置」按钮：

```diff
  const list = state.models  // 移除 PRESET_IDS 过滤
+ if (list.length === 0) {
+   return (
+     <div className="mb-2 flex items-center gap-2">
+       <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
+         参与模型
+       </span>
+       <button
+         onClick={openSettings}
+         className="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-[var(--border)] hover:border-[var(--accent)]"
+         style={{ color: 'var(--accent)' }}
+       >
+         <i className="fas fa-plus mr-1"></i>前往配置模型
+       </button>
+     </div>
+   )
+ }
```

#### B9. `frontend/src/store/DiscussionContext.tsx` 新增 `addModelFromTemplate` action

```typescript
const addModelFromTemplate = useCallback((template: Pick<ModelConfig, 'name' | 'icon' | 'color' | 'endpoint' | 'model' | 'systemPrompt'>) => {
  dispatch({
    type: 'ADD_MODEL',
    model: {
      id: 'custom_' + Date.now(),
      apiKey: '',
      enabled: true,
      custom: true,
      ...template,
    },
  })
}, [])
```

#### B10. 环境变量（`frontend/.env.example`）

```diff
- # 前端指向的后端共识/分歧分析端点
- VITE_ANALYZE_ENDPOINT=http://localhost:8000/api/analyze
+ # 前端指向的后端流式分析端点
+ VITE_ANALYZE_ENDPOINT=http://localhost:8000/api/analyze/stream
+ # 后端 Jaccard 回退端点（流式失败时调用）
+ VITE_ANALYZE_FALLBACK_ENDPOINT=http://localhost:8000/api/analyze
```

### C. Spec / 文档同步

#### C1. `spec.md`

- 第 20 行「真实共识/分歧分析：新增 FastAPI 后端，基于关键词 Jaccard 2-gram 相似度给出真实标签」改为：
  > 「真实共识/分歧分析：新增 FastAPI 后端 `/api/analyze/stream` SSE 端点，每条 AI 发言结束后由发言者自己 LLM 自评（共识/分歧/中立），失败时回退 Jaccard 启发式」
- 第 57-66 行 Requirement「真实 LLM 分析与本地回退」重写为「发言者自评 + 三级回退」
- 新增 Requirement「实时增量分析」（每条发言结束立即分析，不等讨论结束）
- 新增 Requirement「第一条发言作为基准」（不带标签）
- 新增 Requirement「移除预设模型，改用快速添加模板」

#### C2. `AGENTS.md`

- 「4 个预设模型与 localStorage key」改为「无预设，用户在 SettingsPanel 自填，提供快速添加模板（DeepSeek/Kimi/通义/Mimo）」
- 「禁止硬编码密钥」补充：「分析 Key 在后端 `PRISM_ANALYZER_API_KEYS` 环境变量配置（JSON 格式），前端不传 Key 给后端」
- 文件清单移除「`src/config/presetModels.ts` — 4 个预设模型」改为「`src/config/presetModels.ts` — 空预设 + 快速添加模板」
- 阈值同步约束保留（前后端 Jaccard 仍需一致，作为回退路径）

#### C3. `readme.md`

- 「核心功能」更新：「共识/分歧自动标注」改为「发言者自评 + 实时增量 + SSE 流式」
- 「快速演示」移除「双击 index.html」路径（仅保留 React 版本）
- 「接入真实模型」补充：「分析模型 Key 在后端 `.env` 的 `PRISM_ANALYZER_API_KEYS` 配置（JSON 格式，按 model 名匹配）」
- 环境变量表新增 `PRISM_ANALYZER_API_KEYS`

## Assumptions & Decisions

### 关键决策
1. **分析者 = 发言者自己**（不是后端固定 3 个 LLM）。每条发言只有 1 个标签，无投票聚合。
2. **实时增量**：每条 AI 发言结束立即分析，不等讨论结束。
3. **SSE 流式**：后端把发言者 LLM 的分析输出流式推回（让用户感知分析过程）。
4. **第一条发言作为基准**：讨论话题的第一条 AI 发言不带标签（neutral 不显示）。从第二条开始才分析。
5. **移除预设模型**：默认空，用户自填；提供快速添加模板按钮。
6. **分析 Key 在后端环境变量**：`PRISM_ANALYZER_API_KEYS` JSON 格式，按 model 名匹配。前端不传 Key 给后端。
7. **三级容错**：发言者自评失败 → 后端 Jaccard；后端不可达 → 前端 localHeuristicAnalyze。
8. **模拟模式跳过分析**：模拟模式不调后端流式分析，直接用前端 Jaccard（与现状一致）。
9. **Mimo 端点待用户确认**：QUICK_TEMPLATES 中 Mimo 的 endpoint 暂填占位，用户可在 SettingsPanel 修改。

### 假设
- 用户配置的前端 model 名与后端 `PRISM_ANALYZER_API_KEYS` 中的 key 一致（如 `deepseek-chat`）。对不上则该条发言回退 Jaccard。
- 后端 LLM 调用使用 OpenAI 兼容协议（与前端 `streamChat` 一致）。
- LLM 输出 JSON 时使用容错正则解析（不强制 JSON mode，兼容性更好）。

### 不在本次范围
- D3 观点图谱可视化（spec P1 规划项，单独 change-id）
- Vite 升级（tasks.md Task 16，单独处理）
- 测试代码编写（spec 多处 Scenario 但本次不补单元测试）

## Verification

### 自动验证
1. `cd frontend && npm run typecheck` → 0 error
2. `cd frontend && npm run build` → 通过
3. `pip install -r requirements.txt` → httpx 安装成功
4. `uvicorn main:app --reload` → 启动无错
5. `curl http://localhost:8000/api/health` → `{"status":"ok"}`

### 手动验证（按场景）
1. **场景 A：3 家都有 Key，正常自评**
   - 配置：前端加 3 个模型（DeepSeek/Kimi/通义），后端 `.env` 配 `PRISM_ANALYZER_API_KEYS={"deepseek-chat":"sk-xxx","moonshot-v1-8k":"sk-yyy","qwen-turbo":"sk-zzz"}`
   - 操作：发起讨论（关闭模拟模式）
   - 期望：第一条 AI 发言无标签；第二、三条发言右上角显示标签 + 「· X 自评」；hover 看证据

2. **场景 B：某条发言的 model 名对不上 Key**
   - 配置：前端加模型 `model: "custom-model"`，后端没配这个 key
   - 期望：这条发言回退 Jaccard 标签，标签显示「· 本地启发式」

3. **场景 C：后端不可达**
   - 操作：关闭后端，发起讨论
   - 期望：每条发言用前端 `localHeuristicAnalyze`，标签显示「· 本地启发式」，toast 提示

4. **场景 D：模拟模式**
   - 操作：开启模拟模式发起讨论
   - 期望：不调后端流式分析，直接前端 Jaccard，标签显示「· 本地启发式」

5. **场景 E：第一条发言基准**
   - 操作：任意配置，发起讨论
   - 期望：第一条 AI 发言气泡无标签，从第二条开始才有

6. **场景 F：首次进入空状态**
   - 操作：清空 localStorage `prism_models`，刷新页面
   - 期望：SettingsPanel 自动展开；空状态提示「推荐添加 3-4 个不同 AI 模型」；快速添加模板按钮可见

7. **场景 G：快速添加模板**
   - 操作：点击「+ DeepSeek」按钮
   - 期望：列表新增一项，endpoint/model/systemPrompt 已预填，apiKey 为空待用户填

### Spec 一致性检查
- spec.md 第 20 行描述与代码一致
- spec.md 第 57-66 行 Requirement Scenario 与代码行为一致
- AGENTS.md 文件清单与实际文件一致
- readme.md 功能列表与代码一致

## Implementation Order

1. **后端先行**：`main.py` 加 `/api/analyze/stream` + `requirements.txt` 加 httpx + `.env.example` 加 `PRISM_ANALYZER_API_KEYS`
2. **前端类型**：`types.ts` 加 `analyzer` 字段
3. **前端服务**：`analyzer.ts` 加 `streamAnalysis`
4. **前端配置**：`presetModels.ts` 清空预设 + 加 `QUICK_TEMPLATES`
5. **前端 store**：`DiscussionContext.tsx` 移除 loadModels 自动 push + 改 `analyzeMessages` 为 `streamAnalyzeMessage` + 新增 `addModelFromTemplate`
6. **前端组件**：`SettingsPanel` / `MessageList` / `MessageBubble` / `ModelSelector` 文案与 UI 改造
7. **环境变量**：`frontend/.env.example` 加 `VITE_ANALYZE_FALLBACK_ENDPOINT`
8. **文档同步**：`spec.md` / `AGENTS.md` / `readme.md`
9. **验证**：typecheck + build + 手动场景测试

## Risks

1. **Mimo 端点未知**：QUICK_TEMPLATES 中 Mimo 的 endpoint 是占位，用户需自行修改。建议在按钮 tooltip 提示「请确认端点」。
2. **后端 Key 池 JSON 解析失败**：`_load_analyzer_keys` 已容错，失败返回空 dict，所有发言都走 Jaccard 回退。
3. **LLM 输出非 JSON**：`_parse_label_json` 用正则容错，失败推 fallback event。
4. **流式中断**：用户点「跳过」会 abort 当前发言，但发言已经 push 进 messages，分析仍会触发。需要确认：跳过后是否还分析这条？建议：跳过后这条发言仍分析（因为发言已经完成）。
5. **多轮讨论的「前文」长度**：第 2 轮第 4 条发言时，priorMessages 已有 7 条，prompt 会变长。当前不截断，依赖 LLM 上下文窗口。如遇超长可在 prompt 中只取最近 5 条前文。
