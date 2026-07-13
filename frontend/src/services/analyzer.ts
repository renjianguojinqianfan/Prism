import type { AnalysisTag } from '../store/types'

interface AnalyzeItem {
  id: string
  modelName: string
  content: string
}

const _STOPWORDS = new Set<string>([
  '的', '是', '了', '和', '与', '并', '就', '也', '在', '对', '从', '把', '被',
  '我', '你', '他', '她', '它', '我们', '你们', '他们', '这', '那', '这个', '那个',
  '但', '而', '或', '如果', '因为', '所以', '一个', '一种', '可以', '需要', '进行',
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'for', 'in', 'on', 'at',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these',
  'those', 'it', 'as', 'by', 'with', 'from', 'we', 'you', 'they', 'i', 'he', 'she'
])

export function _isCjk(ch: string): boolean {
  if (!ch) return false
  const cp = ch.charCodeAt(0)
  return (
    (0x4E00 <= cp && cp <= 0x9FFF) ||
    (0x3400 <= cp && cp <= 0x4DBF) ||
    (0xF900 <= cp && cp <= 0xFAFF)
  )
}

export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>()
  if (!text) return tokens

  const buf: string[] = []
  const cjkChars: string[] = []

  const flushAscii = () => {
    if (buf.length > 0) {
      const word = buf.join('').toLowerCase()
      if (word.length >= 2 && !_STOPWORDS.has(word)) {
        tokens.add(word)
      }
      buf.length = 0
    }
  }

  const flushCjk = () => {
    if (cjkChars.length >= 2) {
      for (let i = 0; i < cjkChars.length - 1; i++) {
        const bigram = cjkChars[i] + cjkChars[i + 1]
        if (!_STOPWORDS.has(bigram)) {
          tokens.add(bigram)
        }
      }
    }
    cjkChars.length = 0
  }

  for (const ch of text) {
    if (_isCjk(ch)) {
      flushAscii()
      cjkChars.push(ch)
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      flushCjk()
      buf.push(ch)
    } else {
      flushAscii()
      flushCjk()
    }
  }

  flushAscii()
  flushCjk()

  return tokens
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  a.forEach(t => {
    if (b.has(t)) inter++
  })
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

const HIGH = 0.14
const LOW = 0.11

export function localHeuristicAnalyze(items: AnalyzeItem[]): AnalysisTag[] {
  if (items.length === 0) return []
  if (items.length === 1) {
    return [{ id: items[0].id, label: 'neutral', score: 0, evidence: '仅一条发言，默认为中立' }]
  }
  const sets = items.map(it => tokenize(it.content))
  return items.map((it, i) => {
    const sims: number[] = []
    for (let j = 0; j < items.length; j++) {
      if (i !== j) sims.push(jaccard(sets[i], sets[j]))
    }
    const avg = sims.length ? sims.reduce((s, x) => s + x, 0) / sims.length : 0
    const score = Math.round(avg * 1000) / 1000
    let label: AnalysisTag['label'] = 'neutral'
    let evidence: string
    if (avg >= HIGH) {
      label = 'consensus'
      evidence = `与其他 ${sims.length} 条发言关键词重合度 ${score}`
    } else if (avg <= LOW) {
      label = 'divergence'
      evidence = '与其他发言显著分歧'
    } else {
      evidence = `与其他发言关键词重合度 ${score}（中性区间）`
    }
    return { id: it.id, label, score, evidence }
  })
}

// ---------- 发言者自评 prompt 构造与解析（从后端迁移） ----------

export interface AnalyzerPromptMessage {
  id: string
  modelName: string
  content: string
}

function formatAnalyzerPrompt(topic: string, priorMessagesText: string, yourMessage: string): string {
  return `你是一个观点分析助手。你刚刚参与了关于「${topic}」的讨论，现在需要分析自己刚才的发言与前文其他参与者的发言之间的关系。

前文参与者发言：
${priorMessagesText}

你刚才的发言：
${yourMessage}

请判断你的发言与前文整体的关系：
- consensus（共识）：你的观点与前文多数观点方向一致或补充支持
- divergence（分歧）：你的观点与前文有明显对立、反驳或不同立场
- neutral（中立）：你的发言是新角度、新信息或方向拓展，无明显共识/分歧

只输出 JSON，不要任何额外文字：
{"label": "consensus|divergence|neutral", "evidence": "一句话证据，不超过50字"}`
}

export function buildAnalyzerPrompt(
  topic: string,
  priorMessages: AnalyzerPromptMessage[],
  currentMessage: string
): string {
  const recent = priorMessages.slice(-5)
  const priorText = recent.length > 0
    ? recent.map(m => `${m.modelName}：${m.content}`).join('\n\n')
    : '（无前文，这是首条发言）'
  return formatAnalyzerPrompt(topic || '未指定话题', priorText, currentMessage)
}

export function parseLabelJson(text: string): { label: 'consensus' | 'divergence' | 'neutral'; evidence: string } | null {
  const m = text.match(/\{[^{}]*"label"[^{}]*\}/)
  if (!m) return null
  try {
    const obj = JSON.parse(m[0])
    if (obj.label === 'consensus' || obj.label === 'divergence' || obj.label === 'neutral') {
      return { label: obj.label, evidence: String(obj.evidence || '') }
    }
  } catch {
    /* 忽略解析错误 */
  }
  return null
}

// ---------- 前端直连模型 API 自评分析 ----------

export interface DirectAnalyzerMessage {
  id: string
  modelName: string
  content: string
}

export interface DirectStreamAnalysisPayload {
  topic: string
  currentMessage: DirectAnalyzerMessage
  priorMessages: DirectAnalyzerMessage[]
}

/**
 * 前端直连模型 API 做发言者自评。
 * 用 model.endpoint + model.apiKey 直连 OpenAI 兼容 API（与 streamChat 同链路），
 * 累积 SSE delta 后用 parseLabelJson 解析结果。
 * 失败（HTTP 错误 / 网络异常 / 解析失败）返回 null，调用方回退 Jaccard。
 */
export async function directStreamAnalysis(
  model: { endpoint: string; apiKey: string; model: string },
  payload: DirectStreamAnalysisPayload,
  onDelta?: (delta: string) => void,
  timeoutMs = 30000
): Promise<{ label: 'consensus' | 'divergence' | 'neutral'; evidence: string } | null> {
  const prompt = buildAnalyzerPrompt(
    payload.topic,
    payload.priorMessages,
    payload.currentMessage.content
  )

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const response = await fetch(model.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${model.apiKey}`
        },
        body: JSON.stringify({
          model: model.model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.3,
        }),
        signal: ctrl.signal
      })

      if (!response.ok || !response.body) return null

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

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
          try {
            const json = JSON.parse(data)
            const delta: string = json.choices?.[0]?.delta?.content || ''
            if (delta) {
              fullContent += delta
              if (onDelta) onDelta(delta)
            }
          } catch {
            /* 忽略解析错误 */
          }
        }
      }

      return parseLabelJson(fullContent)
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return null
  }
}

// （旧 streamAnalysis / fetchAnalysis 已由 directStreamAnalysis 替代）

