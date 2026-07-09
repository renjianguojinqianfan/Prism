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

export interface AnalyzePayload {
  topic: string
  messages: AnalyzeItem[]
}

export async function fetchAnalysis(
  endpoint: string,
  payload: AnalyzePayload,
  timeoutMs = 4000
): Promise<AnalysisTag[] | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      })
      if (resp.ok) {
        const data = await resp.json()
        if (Array.isArray(data?.tags)) return data.tags as AnalysisTag[]
      }
      return null
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return null
  }
}

// ---------- 流式自评分析 ----------

export interface StreamAnalyzerMessage {
  id: string
  modelName: string
  model: string
  content: string
}

export interface StreamAnalysisPayload {
  topic: string
  currentMessage: StreamAnalyzerMessage
  priorMessages: StreamAnalyzerMessage[]
}

export interface StreamAnalysisResult {
  label: AnalysisTag['label']
  evidence: string
}

/**
 * 调用后端 /api/analyze/stream SSE 端点，流式接收发言者自评结果。
 * 返回 null 表示后端推了 fallback event（无 Key / HTTP 错误 / 解析失败 / 网络错误），调用方应回退 Jaccard。
 */
export async function streamAnalysis(
  endpoint: string,
  payload: StreamAnalysisPayload,
  onDelta?: (delta: string) => void,
  timeoutMs = 30000
): Promise<StreamAnalysisResult | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })
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
          let evt: { type: string; content?: string; label?: string; evidence?: string }
          try {
            evt = JSON.parse(data)
          } catch {
            continue
          }
          if (evt.type === 'delta' && evt.content && onDelta) {
            onDelta(evt.content)
          } else if (evt.type === 'final' && evt.label) {
            final = { label: evt.label as AnalysisTag['label'], evidence: evt.evidence || '' }
          } else if (evt.type === 'fallback') {
            return null  // 让上层走回退
          }
        }
      }
      return final
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return null
  }
}
