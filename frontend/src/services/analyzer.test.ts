import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  _isCjk,
  tokenize,
  jaccard,
  localHeuristicAnalyze,
  parseLabelJson,
  buildAnalyzerPrompt,
  directStreamAnalysis,
  type DirectStreamAnalysisPayload
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

// ========== parseLabelJson（从后端移植） ==========

describe('parseLabelJson', () => {
  it('标准 JSON -> 解析成功', () => {
    expect(parseLabelJson('{"label":"consensus","evidence":"观点一致"}')).toEqual({
      label: 'consensus',
      evidence: '观点一致'
    })
  })

  it('带前后文 -> 仍能提取', () => {
    expect(parseLabelJson('分析结果：{"label":"divergence","evidence":"立场对立"} 希望有帮助。')).toEqual({
      label: 'divergence',
      evidence: '立场对立'
    })
  })

  it('代码块包裹 -> 仍能提取', () => {
    expect(parseLabelJson('```json\n{"label":"neutral","evidence":"新角度"}\n```')).toEqual({
      label: 'neutral',
      evidence: '新角度'
    })
  })

  it('无 label 字段 -> null', () => {
    expect(parseLabelJson('{"evidence":"无标签"}')).toBeNull()
  })

  it('非法 label 值 -> null', () => {
    expect(parseLabelJson('{"label":"agree","evidence":"x"}')).toBeNull()
  })

  it('破损 JSON -> null', () => {
    expect(parseLabelJson('{label: consensus}')).toBeNull()
  })

  it('缺 evidence -> evidence 为空字符串', () => {
    expect(parseLabelJson('{"label":"consensus"}')).toEqual({
      label: 'consensus',
      evidence: ''
    })
  })

  it('多个 JSON 块取首个含 label 的', () => {
    expect(parseLabelJson('{"foo":1} 然后 {"label":"neutral","evidence":"x"}')).toEqual({
      label: 'neutral',
      evidence: 'x'
    })
  })

  it('空字符串 -> null', () => {
    expect(parseLabelJson('')).toBeNull()
  })
})

// ========== buildAnalyzerPrompt（从后端移植） ==========

describe('buildAnalyzerPrompt', () => {
  it('无前文 -> 含"（无前文，这是首条发言）"', () => {
    const prompt = buildAnalyzerPrompt('话题', [], '我的发言')
    expect(prompt).toContain('（无前文，这是首条发言）')
    expect(prompt).toContain('话题')
    expect(prompt).toContain('我的发言')
  })

  it('超过 5 条前文 -> 截断到最近 5 条', () => {
    const priors = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      modelName: `M${i}`,
      content: `内容${i}`
    }))
    const prompt = buildAnalyzerPrompt('话题', priors, '新发言')
    expect(prompt).not.toContain('M0')
    expect(prompt).toContain('M1')
    expect(prompt).toContain('M5')
  })

  it('空话题 -> 含"未指定话题"', () => {
    const prompt = buildAnalyzerPrompt('', [], '发言')
    expect(prompt).toContain('未指定话题')
  })

  it('所有占位符正确填充', () => {
    const priors = [{ id: '1', modelName: 'DeepSeek', content: '前文观点' }]
    const prompt = buildAnalyzerPrompt('AI伦理', priors, '我赞同')
    expect(prompt).toContain('AI伦理')
    expect(prompt).toContain('DeepSeek')
    expect(prompt).toContain('前文观点')
    expect(prompt).toContain('我赞同')
  })
})

// ========== directStreamAnalysis（前端直连模型 API） ==========

describe('directStreamAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals())

  const model = { endpoint: 'https://api.test/v1/chat/completions', apiKey: 'sk-test', model: 'test-model' }
  const payload: DirectStreamAnalysisPayload = {
    topic: '测试话题',
    currentMessage: { id: 'm1', modelName: 'A', content: '我的发言' },
    priorMessages: []
  }

  function makeOpenAISSEStream(chunks: string[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        chunks.forEach(c => controller.enqueue(new TextEncoder().encode(c)))
        controller.close()
      }
    })
  }

  function sseDelta(content: string): string {
    return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
  }

  it('成功路径：delta 累积后 parseLabelJson 返回结果', async () => {
    const labelJson = '{"label":"consensus","evidence":"观点一致"}'
    const chunks = [sseDelta(labelJson), 'data: [DONE]\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeOpenAISSEStream(chunks), { status: 200 })
    ))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toEqual({ label: 'consensus', evidence: '观点一致' })
  })

  it('onDelta 回调被正确调用', async () => {
    const chunks = [sseDelta('分析中'), sseDelta('...'), 'data: [DONE]\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeOpenAISSEStream(chunks), { status: 200 })
    ))
    const onDelta = vi.fn()
    await directStreamAnalysis(model, payload, onDelta)
    expect(onDelta).toHaveBeenCalledWith('分析中')
    expect(onDelta).toHaveBeenCalledWith('...')
  })

  it('非 200 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('error', { status: 500 })
    ))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toBeNull()
  })

  it('无 body 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, status: 200, body: null }
    ))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toBeNull()
  })

  it('网络异常返回 null 不抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toBeNull()
  })

  it('跨 buffer 边界拼接仍正确解析', async () => {
    const labelJson = '{"label":"neutral","evidence":"拼接OK"}'
    const fullLine = sseDelta(labelJson)
    const chunks = [fullLine.slice(0, 30), fullLine.slice(30), 'data: [DONE]\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeOpenAISSEStream(chunks), { status: 200 })
    ))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toEqual({ label: 'neutral', evidence: '拼接OK' })
  })

  it('畸形 data 行跳过仍返回结果', async () => {
    const chunks = [
      'data: not-json\n\n',
      sseDelta('{"label":"divergence","evidence":"x"}'),
      'data: [DONE]\n\n'
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeOpenAISSEStream(chunks), { status: 200 })
    ))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toEqual({ label: 'divergence', evidence: 'x' })
  })

  it('LLM 输出不含合法 JSON -> null', async () => {
    const chunks = [sseDelta('这只是一段普通文字，没有JSON'), 'data: [DONE]\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeOpenAISSEStream(chunks), { status: 200 })
    ))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toBeNull()
  })

  it('仅 [DONE] 无内容 -> null', async () => {
    const chunks = ['data: [DONE]\n\n']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeOpenAISSEStream(chunks), { status: 200 })
    ))
    const r = await directStreamAnalysis(model, payload)
    expect(r).toBeNull()
  })
})

// ========== streamAnalysis / fetchAnalysis 已由 directStreamAnalysis 替代，旧测试已删除 ==========

