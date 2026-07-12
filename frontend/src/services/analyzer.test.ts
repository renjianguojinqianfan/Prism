import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  _isCjk,
  tokenize,
  jaccard,
  localHeuristicAnalyze,
  streamAnalysis,
  fetchAnalysis
} from './analyzer'

describe('_isCjk', () => {
  it('汉字 → true', () => {
    expect(_isCjk('中')).toBe(true)
    expect(_isCjk('文')).toBe(true)
  })
  it('CJK 扩展 A 区 → true', () => {
    // 㐀 U+3400
    expect(_isCjk('㐀')).toBe(true)
  })
  it('兼容汉字 → true', () => {
    // 豈 U+F900
    expect(_isCjk('豈')).toBe(true)
  })
  it('ASCII / 空格 / 标点 → false', () => {
    expect(_isCjk('a')).toBe(false)
    expect(_isCjk(' ')).toBe(false)
    expect(_isCjk(',')).toBe(false)
    expect(_isCjk('1')).toBe(false)
  })
  it('空字符串 → false', () => {
    expect(_isCjk('')).toBe(false)
  })
})

describe('tokenize', () => {
  it('空字符串 → 空 Set', () => {
    expect(tokenize('').size).toBe(0)
    expect(tokenize('   ').size).toBe(0)
  })

  it('纯英文：按 word 分词、长度≥2、stopword 过滤', () => {
    const t = tokenize('hello world the a an')
    expect(t.has('hello')).toBe(true)
    expect(t.has('world')).toBe(true)
    // 长度 < 2 或 stopword 不在内
    expect(t.has('the')).toBe(false)
    expect(t.has('a')).toBe(false)
    expect(t.has('an')).toBe(false)
  })

  it('英文转小写', () => {
    const t = tokenize('Hello HELLO')
    expect(t.has('hello')).toBe(true)
    expect(t.size).toBe(1)
  })

  it('纯中文：bigram', () => {
    const t = tokenize('人工智能')
    expect(t.has('人工')).toBe(true)
    expect(t.has('工智')).toBe(true)
    expect(t.has('智能')).toBe(true)
  })

  it('中文 bigram 长度<2 时丢弃', () => {
    const t = tokenize('智')
    expect(t.size).toBe(0)
  })

  it('中英文混合分别处理', () => {
    const t = tokenize('AI 是技术')
    expect(t.has('ai')).toBe(true)
    // "是技" "技术" — 「是」是 stopword，但 bigram 仍生成（stopword 过滤按 bigram 整体）
    expect(t.has('技术')).toBe(true)
  })

  it('数字被当作 ASCII 词', () => {
    const t = tokenize('gpt4 model3')
    expect(t.has('gpt4')).toBe(true)
    expect(t.has('model3')).toBe(true)
  })

  it('标点切分 ASCII 词', () => {
    const t = tokenize('foo,bar;baz')
    expect(t.has('foo')).toBe(true)
    expect(t.has('bar')).toBe(true)
    expect(t.has('baz')).toBe(true)
  })
})

describe('jaccard', () => {
  it('两个空集 → 0', () => {
    expect(jaccard(new Set(), new Set())).toBe(0)
  })

  it('完全相同 → 1', () => {
    const a = new Set(['x', 'y', 'z'])
    expect(jaccard(a, a)).toBe(1)
  })

  it('完全不相交 → 0', () => {
    const a = new Set(['x'])
    const b = new Set(['y'])
    expect(jaccard(a, b)).toBe(0)
  })

  it('部分交集：inter=2, union=4 → 0.5', () => {
    const a = new Set(['a', 'b', 'c'])
    const b = new Set(['a', 'b', 'd'])
    expect(jaccard(a, b)).toBe(0.5)
  })

  it('一空一非空 → 0', () => {
    expect(jaccard(new Set(), new Set(['x']))).toBe(0)
    expect(jaccard(new Set(['x']), new Set())).toBe(0)
  })
})

describe('localHeuristicAnalyze', () => {
  it('空数组 → []', () => {
    expect(localHeuristicAnalyze([])).toEqual([])
  })

  it('单条 → neutral，evidence 为"仅一条发言"', () => {
    const r = localHeuristicAnalyze([{ id: 'a', modelName: 'A', content: 'hello' }])
    expect(r).toHaveLength(1)
    expect(r[0].label).toBe('neutral')
    expect(r[0].evidence).toContain('仅一条')
  })

  it('多条相同内容 → consensus（avg=1 ≥ HIGH=0.14）', () => {
    const items = [
      { id: 'a', modelName: 'A', content: '人工智能 是技术' },
      { id: 'b', modelName: 'B', content: '人工智能 是技术' },
      { id: 'c', modelName: 'C', content: '人工智能 是技术' }
    ]
    const r = localHeuristicAnalyze(items)
    expect(r.every(t => t.label === 'consensus')).toBe(true)
    // score 应为 1
    expect(r[0].score).toBe(1)
  })

  it('完全不相交的词汇 → divergence（avg=0 ≤ LOW=0.11）', () => {
    const items = [
      { id: 'a', modelName: 'A', content: 'apple banana' },
      { id: 'b', modelName: 'B', content: 'cherry durian' }
    ]
    const r = localHeuristicAnalyze(items)
    expect(r.every(t => t.label === 'divergence')).toBe(true)
  })

  it('中性区间：部分交集', () => {
    // 让 avg 落在 (LOW=0.11, HIGH=0.14) 之间
    // 构造 4 个 token 中 1 个交集 → avg≈0.333 太高
    // 用 5 个 token、0.2 比例：a={t1,t2,t3,t4,t5}, b={t5,t6,t7,t8,t9} → inter=1, union=9 → 0.111
    // 0.111 < 0.11 不行；让 a={t1..t5}, b={t5,t6,t7,t8,t9,t10} → inter=1, union=10 → 0.1 还是低
    // 改用 inter=2,union=12 → 0.1667 太高。改用 inter=1,union=8 → 0.125 在 (0.11,0.14)
    const aTokens = ['t1', 't2', 't3', 't4'] // 4 个
    const bTokens = ['t4', 't5', 't6', 't7', 't8'] // 5 个 → inter=1, union=8 → 0.125
    const items = [
      { id: 'a', modelName: 'A', content: aTokens.join(' ') },
      { id: 'b', modelName: 'B', content: bTokens.join(' ') }
    ]
    const r = localHeuristicAnalyze(items)
    expect(r.every(t => t.label === 'neutral')).toBe(true)
    expect(r[0].evidence).toContain('中性区间')
  })

  it('label 类型符合 AnalysisTag 类型约束', () => {
    const items = [
      { id: 'a', modelName: 'A', content: 'hello' },
      { id: 'b', modelName: 'B', content: 'hello' }
    ]
    const r = localHeuristicAnalyze(items)
    for (const t of r) {
      expect(['consensus', 'divergence', 'neutral']).toContain(t.label)
    }
  })
})

// ========== streamAnalysis / fetchAnalysis 流式与回退调用层 ==========
function makeSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach(c => controller.enqueue(new TextEncoder().encode(c)))
      controller.close()
    }
  })
}

const streamPayload = {
  topic: '测试话题',
  currentMessage: { id: 'm1', modelName: 'A', model: 'test-model', content: '内容' },
  priorMessages: [] as { id: string; modelName: string; model: string; content: string }[]
}
const fetchPayload = {
  topic: '测试话题',
  messages: [{ id: 'm1', modelName: 'A', content: '内容' }]
}

describe('streamAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('正常流返回 final 标签', async () => {
    const chunks = [
      'data: {"type":"delta","content":"分析中"}\n',
      'data: {"type":"final","label":"consensus","evidence":"高重合"}\n'
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSSEStream(chunks), { status: 200 })
    ))
    const onDelta = vi.fn()
    const r = await streamAnalysis('/api/analyze/stream', streamPayload, onDelta)
    expect(r).toEqual({ label: 'consensus', evidence: '高重合' })
    expect(onDelta).toHaveBeenCalledWith('分析中')
  })

  it('fallback 事件返回 null', async () => {
    const chunks = ['data: {"type":"fallback","reason":"no_key"}\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSSEStream(chunks), { status: 200 })
    ))
    const r = await streamAnalysis('/api/analyze/stream', streamPayload)
    expect(r).toBeNull()
  })

  it('非 200 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('not found', { status: 404 })
    ))
    const r = await streamAnalysis('/api/analyze/stream', streamPayload)
    expect(r).toBeNull()
  })

  it('无 body 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, status: 200, body: null }
    ))
    const r = await streamAnalysis('/api/analyze/stream', streamPayload)
    expect(r).toBeNull()
  })

  it('跨 buffer 边界拼接仍解析 final', async () => {
    const line = 'data: {"type":"final","label":"divergence","evidence":"低重合"}\n'
    const chunks = [line.slice(0, 30), line.slice(30)]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSSEStream(chunks), { status: 200 })
    ))
    const r = await streamAnalysis('/api/analyze/stream', streamPayload)
    expect(r).toEqual({ label: 'divergence', evidence: '低重合' })
  })

  it('畸形 data 行跳过仍返回 final', async () => {
    const chunks = [
      'data: not-json\n',
      'data: {"type":"final","label":"neutral","evidence":"中性"}\n'
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSSEStream(chunks), { status: 200 })
    ))
    const r = await streamAnalysis('/api/analyze/stream', streamPayload)
    expect(r).toEqual({ label: 'neutral', evidence: '中性' })
  })

  it('仅 delta 无 final 返回 null', async () => {
    const chunks = ['data: {"type":"delta","content":"思考"}\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSSEStream(chunks), { status: 200 })
    ))
    const r = await streamAnalysis('/api/analyze/stream', streamPayload)
    expect(r).toBeNull()
  })
})

describe('fetchAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ok 含 tags 返回 tags 数组', async () => {
    const tags = [{ id: 'a', label: 'consensus', score: 0.5, evidence: 'x' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tags }), { status: 200 })
    ))
    const r = await fetchAnalysis('/api/analyze', fetchPayload)
    expect(r).toEqual(tags)
  })

  it('非 ok 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('err', { status: 500 })
    ))
    const r = await fetchAnalysis('/api/analyze', fetchPayload)
    expect(r).toBeNull()
  })

  it('body 无 tags 字段返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    ))
    const r = await fetchAnalysis('/api/analyze', fetchPayload)
    expect(r).toBeNull()
  })

  it('网络异常返回 null 不抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const r = await fetchAnalysis('/api/analyze', fetchPayload)
    expect(r).toBeNull()
  })
})
