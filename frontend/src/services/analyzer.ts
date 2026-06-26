import type { AnalysisTag } from '../store/types'

interface AnalyzeItem {
  id: string
  modelName: string
  content: string
}

const STOP = new Set([
  '的', '是', '了', '和', '与', '并', '就', '也', '在', '对', '从', '把', '被',
  '一个', '我们', '他们', '你们', '以及', '而且', '但是', '所以', '如果', '因此',
  '这个', '那个', '可以', '需要', '一种', '一些',
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'for', 'in', 'on', 'at',
  'is', 'are', 'be', 'this', 'that', 'it', 'as', 'with', 'by'
])

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>()
  const cleaned = (text || '').toLowerCase()
  ;(cleaned.match(/[a-z0-9]+/g) || []).forEach(t => {
    if (t.length >= 2 && !STOP.has(t)) tokens.add(t)
  })
  const cjk = cleaned.replace(/[^\u4e00-\u9fff]/g, ' ')
  cjk.split(/\s+/).filter(Boolean).forEach(seg => {
    for (let i = 0; i + 2 <= seg.length; i++) {
      const g = seg.slice(i, i + 2)
      if (!STOP.has(g)) tokens.add(g)
    }
  })
  return tokens
}

function jaccard(a: Set<string>, b: Set<string>): number {
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
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    })
    clearTimeout(timer)
    if (resp.ok) {
      const data = await resp.json()
      if (Array.isArray(data?.tags)) return data.tags as AnalysisTag[]
    }
    return null
  } catch {
    return null
  }
}
