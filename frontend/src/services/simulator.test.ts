import { describe, it, expect } from 'vitest'
import { generateSimReply } from './simulator'
import type { Message } from '../store/types'

const makeMsg = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  role: 'assistant',
  content: 'hello world',
  modelId: 'deepseek',
  modelName: 'DeepSeek',
  ...over
})

describe('generateSimReply', () => {
  it('round=1 + 空 history → 返回第一个 deepseek 模板', () => {
    const r = generateSimReply('deepseek', '测试话题', [], 1)
    expect(r).toContain('测试话题')
    expect(r).toContain('逻辑层面')
    // 没有 prevNotes
    expect(r).not.toContain('刚才')
  })

  it('round=2 → 第二个模板（反证法）', () => {
    const r = generateSimReply('deepseek', 'X', [], 2)
    expect(r).toContain('反证法')
  })

  it('round=4 wrap 回到第一个模板（(4-1)%3=0）', () => {
    const r1 = generateSimReply('deepseek', 'X', [], 1)
    const r4 = generateSimReply('deepseek', 'X', [], 4)
    expect(r4).toBe(r1)
  })

  it('modelId=kimi → 使用 kimi 模板', () => {
    const r = generateSimReply('kimi', '某话题', [], 1)
    expect(r).toContain('换个完全不同的角度')
  })

  it('未知 modelId → 回退到 deepseek', () => {
    const r = generateSimReply('unknown', 'X', [], 1)
    expect(r).toContain('逻辑层面')
  })

  it('history 中存在已完成的 assistant 发言 → 注入 prevNotes', () => {
    const prev = makeMsg({
      content: '  AI   前述观点  ',
      modelName: 'Kimi',
      thinking: false
    })
    const r = generateSimReply('deepseek', 'X', [prev], 1)
    // prevNotes 包含 "刚才Kimi提到"
    expect(r).toContain('刚才Kimi提到')
    // 内容做了 strip + slice(0,60)
    expect(r).toContain('AI前述观点')
  })

  it('history 中只有 thinking 状态的 assistant → 不应注入 prevNotes', () => {
    const thinking = makeMsg({ thinking: true, content: '应该被忽略' })
    const r = generateSimReply('deepseek', 'X', [thinking], 1)
    expect(r).not.toContain('刚才')
  })

  it('取最后一条已完成的 assistant 发言（reverse().find）', () => {
    const old = makeMsg({ content: '旧发言', modelName: 'Old' })
    const recent = makeMsg({ content: '新发言', modelName: 'Recent' })
    const r = generateSimReply('deepseek', 'X', [old, recent], 1)
    expect(r).toContain('刚才Recent提到')
    expect(r).toContain('新发言')
  })
})
