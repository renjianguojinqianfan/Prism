import { describe, it, expect } from 'vitest'
import { buildAPIHistory } from './api'
import type { Message, ModelConfig } from '../store/types'

const baseModel: ModelConfig = {
  id: 'm1',
  name: 'Tester',
  icon: 'fa-robot',
  color: '#000',
  endpoint: 'https://example.com/v1/chat/completions',
  model: 'test-model',
  apiKey: 'sk-test',
  systemPrompt: '你是测试者',
  enabled: true,
  custom: false
}

describe('buildAPIHistory', () => {
  it('空 messages → system + final user（共 2 条）', () => {
    const r = buildAPIHistory(baseModel, 1, '话题', [])
    expect(r).toHaveLength(2)
    expect(r[0].role).toBe('system')
    expect(r[1].role).toBe('user')
    // system 含 systemPrompt + 话题
    expect(r[0].content).toContain('你是测试者')
    expect(r[0].content).toContain('「话题」')
    expect(r[0].content).toContain('第1轮')
  })

  it('final user prompt 含话题与轮次提示', () => {
    const r = buildAPIHistory(baseModel, 3, 'AI伦理', [])
    const last = r[r.length - 1]
    expect(last.role).toBe('user')
    expect(last.content).toContain('「AI伦理」')
    expect(last.content).toContain('第3轮')
  })

  it('user message → 历史中加 [主持人] 前缀', () => {
    const msg: Message = {
      id: 'u1', role: 'user', content: '你好', modelId: 'user', modelName: '你'
    }
    const r = buildAPIHistory(baseModel, 1, 'X', [msg])
    expect(r.find(m => m.role === 'user' && m.content.includes('[主持人]'))).toBeTruthy()
    expect(r.find(m => m.content === '[主持人] 你你')).toBeUndefined()
    expect(r.find(m => m.content === '[主持人] 你好')).toBeTruthy()
  })

  it('assistant message → 历史中加 [modelName] 前缀', () => {
    const msg: Message = {
      id: 'a1', role: 'assistant', content: '我同意', modelId: 'm1', modelName: 'DeepSeek'
    }
    const r = buildAPIHistory(baseModel, 1, 'X', [msg])
    expect(r.find(m => m.content === '[DeepSeek] 我同意')).toBeTruthy()
  })

  it('混合多条消息保持顺序', () => {
    const msgs: Message[] = [
      { id: 'u1', role: 'user', content: '问1', modelId: 'user', modelName: '你' },
      { id: 'a1', role: 'assistant', content: '答1', modelId: 'm1', modelName: 'A' },
      { id: 'u2', role: 'user', content: '问2', modelId: 'user', modelName: '你' },
      { id: 'a2', role: 'assistant', content: '答2', modelId: 'm1', modelName: 'B' }
    ]
    const r = buildAPIHistory(baseModel, 1, 'X', msgs)
    // 1 system + 4 history + 1 final user = 6
    expect(r).toHaveLength(6)
    expect(r[0].role).toBe('system')
    expect(r[1].content).toBe('[主持人] 问1')
    expect(r[2].content).toBe('[A] 答1')
    expect(r[3].content).toBe('[主持人] 问2')
    expect(r[4].content).toBe('[B] 答2')
    expect(r[5].role).toBe('user')
  })

  it('system message 被跳过', () => {
    const msgs: Message[] = [
      { id: 's1', role: 'system', content: '系统', modelId: null, modelName: '' }
    ]
    const r = buildAPIHistory(baseModel, 1, 'X', msgs)
    // 只 system + final user
    expect(r).toHaveLength(2)
    expect(r.find(m => m.content.includes('系统'))).toBeFalsy()
  })
})
