import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscussionEngine, type DiscussionConfig } from './discussionEngine'
import type { ModelConfig } from '../store/types'

vi.mock('./simulator', () => ({
  generateSimReply: vi.fn(() => '模拟回复内容')
}))

vi.mock('./analyzer', () => ({
  directStreamAnalysis: vi.fn(async () => null),
  localHeuristicAnalyze: vi.fn(() => [])
}))

vi.mock('./api', () => ({
  buildAPIHistory: vi.fn(() => []),
  streamChat: vi.fn(async () => '真实回复内容')
}))

import { generateSimReply } from './simulator'
import { directStreamAnalysis } from './analyzer'
import { streamChat } from './api'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const makeModel = (over: Partial<ModelConfig> = {}): ModelConfig => ({
  id: 'm1',
  name: 'DeepSeek',
  icon: 'fa-brain',
  color: '#10B981',
  endpoint: 'https://api.example.com/v1/chat/completions',
  model: 'deepseek-chat',
  apiKey: 'sk-test',
  systemPrompt: '你是DeepSeek',
  enabled: true,
  custom: true,
  simulatorId: 'deepseek',
  ...over
})

const makeConfig = (over: Partial<DiscussionConfig> = {}): DiscussionConfig => ({
  models: [makeModel()],
  simulate: true,
  maxRounds: 1,
  topic: '测试话题',
  ...over
})

const makeCallbacks = () => ({
  onMessage: vi.fn(),
  onUpdate: vi.fn(),
  onDispatch: vi.fn(),
  onToast: vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DiscussionEngine', () => {
  it('正常完成一轮讨论：system 话题 → user → assistant → system 结束', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    engine.start(makeConfig())

    await sleep(1500)

    const msgs = cb.onMessage.mock.calls.map(c => c[0] as { role: string; content: string })
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toContain('测试话题')
    expect(msgs[1].role).toBe('user')
    expect(msgs[2].role).toBe('assistant')
    expect(msgs[3].role).toBe('system')
    expect(msgs[3].content).toBe('讨论结束')
    // 结束时 active 重置
    const hasDeactivate = cb.onDispatch.mock.calls.some(
      c => c[0].type === 'SET_DISCUSSION_ACTIVE' && c[0].value === false
    )
    expect(hasDeactivate).toBe(true)
  })

  it('中途 reset：后续不再推送消息', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    engine.start(makeConfig())

    await sleep(50)
    engine.reset()
    const countAfterReset = cb.onMessage.mock.calls.length

    await sleep(1000)
    expect(cb.onMessage.mock.calls.length).toBe(countAfterReset)
    expect(cb.onDispatch.mock.calls.some(c => c[0].type === 'CLEAR_MESSAGES')).toBe(true)
  })

  it('中途 skip：当前发言输出完整内容', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    engine.start(makeConfig())

    await sleep(50)
    engine.skip()
    await sleep(800)

    // assistant 消息被更新为完整回复
    const hasFull = cb.onUpdate.mock.calls.some(
      c => c[1].content === '模拟回复内容'
    )
    expect(hasFull).toBe(true)
    expect(cb.onToast.mock.calls.some(c => c[0] === '已跳过当前发言者')).toBe(true)
  })

  it('paused：恢复后讨论继续完成', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    engine.start(makeConfig())

    engine.togglePause() // paused = true
    await sleep(300)
    engine.togglePause() // paused = false
    await sleep(1500)

    const assistantMsgs = cb.onMessage.mock.calls.map(c => c[0]).filter(m => m.role === 'assistant')
    expect(assistantMsgs.length).toBe(1)
    expect(cb.onDispatch.mock.calls.some(c => c[0].type === 'SET_PAUSED' && c[0].value === true)).toBe(true)
  })

  it('真实模式未配 Key：推送跳过提示且无 assistant 发言', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    engine.start(makeConfig({ simulate: false, models: [makeModel({ apiKey: '' })] }))

    await sleep(300)

    const msgs = cb.onMessage.mock.calls.map(c => c[0] as { role: string; content: string })
    expect(msgs.some(m => m.role === 'system' && m.content.includes('未配置API Key'))).toBe(true)
    expect(msgs.some(m => m.role === 'assistant')).toBe(false)
  })

  it('interject：追加 user 观点并 toast', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    engine.start(makeConfig())

    engine.interject('我的补充观点')
    await sleep(100)

    const msgs = cb.onMessage.mock.calls.map(c => c[0])
    expect(msgs.some(m => m.role === 'user' && m.content === '我的补充观点')).toBe(true)
    expect(cb.onToast.mock.calls.some(c => c[0] === '你的观点已加入讨论')).toBe(true)
  })

  it('模拟模式走 generateSimReply，不走 streamChat', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    engine.start(makeConfig())
    await sleep(1500)
    expect(generateSimReply).toHaveBeenCalled()
    expect(streamChat).not.toHaveBeenCalled()
  })

  it('真实模式调用 streamChat 与 directStreamAnalysis', async () => {
    const cb = makeCallbacks()
    const engine = new DiscussionEngine(cb)
    // 2 轮：第 1 条发言是基准（不分析），第 2 条才触发 LLM 自评
    engine.start(makeConfig({ simulate: false, maxRounds: 2 }))
    await sleep(2500)
    expect(streamChat).toHaveBeenCalled()
    expect(directStreamAnalysis).toHaveBeenCalled()
  })
})
