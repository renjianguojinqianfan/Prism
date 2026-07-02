import { describe, it, expect } from 'vitest'
import { reducer, type State, type Action } from './DiscussionContext'
import type { Message, ModelConfig, ToastItem } from './types'

const baseModel: ModelConfig = {
  id: 'm1', name: 'M1', icon: 'fa-robot', color: '#000',
  endpoint: 'e', model: 'm', apiKey: 'k', systemPrompt: 's',
  enabled: true, custom: false
}

const initState: State = {
  models: [baseModel],
  messages: [],
  simulate: true,
  maxRounds: 2,
  discussionActive: false,
  discussionPaused: false,
  currentRound: 0,
  speakingModelId: null,
  settingsOpen: false,
  inputText: '',
  toasts: []
}

const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id, role: 'assistant', content: 'c', modelId: 'm1', modelName: 'M1', ...over
})

const toast = (id: string): ToastItem => ({ id, message: 'msg', type: 'info' })

describe('reducer — models', () => {
  it('SET_MODELS', () => {
    const s = reducer(initState, { type: 'SET_MODELS', models: [baseModel, baseModel] })
    expect(s.models).toHaveLength(2)
  })

  it('UPDATE_MODEL', () => {
    const s = reducer(initState, { type: 'UPDATE_MODEL', idx: 0, patch: { name: 'NewName' } })
    expect(s.models[0].name).toBe('NewName')
    // 其他字段不变
    expect(s.models[0].endpoint).toBe('e')
  })

  it('ADD_MODEL', () => {
    const s = reducer(initState, { type: 'ADD_MODEL', model: { ...baseModel, id: 'm2' } })
    expect(s.models).toHaveLength(2)
    expect(s.models[1].id).toBe('m2')
  })

  it('REMOVE_MODEL', () => {
    const s = reducer({ ...initState, models: [baseModel, { ...baseModel, id: 'm2' }] },
      { type: 'REMOVE_MODEL', idx: 0 })
    expect(s.models).toHaveLength(1)
    expect(s.models[0].id).toBe('m2')
  })

  it('TOGGLE_MODEL_ENABLED', () => {
    const s = reducer(initState, { type: 'TOGGLE_MODEL_ENABLED', id: 'm1' })
    expect(s.models[0].enabled).toBe(false)
  })
})

describe('reducer — discussion control', () => {
  it('SET_SIMULATE', () => {
    const s = reducer(initState, { type: 'SET_SIMULATE', value: false })
    expect(s.simulate).toBe(false)
  })

  it('SET_MAX_ROUNDS', () => {
    const s = reducer(initState, { type: 'SET_MAX_ROUNDS', value: 5 })
    expect(s.maxRounds).toBe(5)
  })

  it('SET_INPUT', () => {
    const s = reducer(initState, { type: 'SET_INPUT', value: 'hi' })
    expect(s.inputText).toBe('hi')
  })

  it('SET_DISCUSSION_ACTIVE', () => {
    const s = reducer(initState, { type: 'SET_DISCUSSION_ACTIVE', value: true })
    expect(s.discussionActive).toBe(true)
  })

  it('SET_PAUSED', () => {
    const s = reducer(initState, { type: 'SET_PAUSED', value: true })
    expect(s.discussionPaused).toBe(true)
  })

  it('SET_CURRENT_ROUND', () => {
    const s = reducer(initState, { type: 'SET_CURRENT_ROUND', value: 3 })
    expect(s.currentRound).toBe(3)
  })

  it('SET_SPEAKING', () => {
    const s = reducer(initState, { type: 'SET_SPEAKING', id: 'm1' })
    expect(s.speakingModelId).toBe('m1')
  })

  it('SET_SETTINGS_OPEN', () => {
    const s = reducer(initState, { type: 'SET_SETTINGS_OPEN', value: true })
    expect(s.settingsOpen).toBe(true)
  })
})

describe('reducer — messages', () => {
  it('ADD_MESSAGE', () => {
    const m = msg('x1')
    const s = reducer(initState, { type: 'ADD_MESSAGE', message: m })
    expect(s.messages).toEqual([m])
  })

  it('UPDATE_MESSAGE', () => {
    const start: State = { ...initState, messages: [msg('x1')] }
    const s = reducer(start, { type: 'UPDATE_MESSAGE', id: 'x1', patch: { content: 'updated' } })
    expect(s.messages[0].content).toBe('updated')
    expect(s.messages[0].id).toBe('x1')
  })

  it('CLEAR_MESSAGES', () => {
    const start: State = { ...initState, messages: [msg('x1'), msg('x2')] }
    const s = reducer(start, { type: 'CLEAR_MESSAGES' })
    expect(s.messages).toEqual([])
  })
})

describe('reducer — toasts', () => {
  it('ADD_TOAST', () => {
    const t = toast('t1')
    const s = reducer(initState, { type: 'ADD_TOAST', toast: t })
    expect(s.toasts).toEqual([t])
  })

  it('REMOVE_TOAST', () => {
    const start: State = { ...initState, toasts: [toast('t1'), toast('t2')] }
    const s = reducer(start, { type: 'REMOVE_TOAST', id: 't1' })
    expect(s.toasts).toHaveLength(1)
    expect(s.toasts[0].id).toBe('t2')
  })
})

describe('reducer — default', () => {
  it('未知 action type → 返回原 state 引用', () => {
    const unknown = { type: 'UNKNOWN_ACTION' } as unknown as Action
    const s = reducer(initState, unknown)
    // 不可变性：返回原引用或新对象都应保持 state 内容相同
    expect(s).toEqual(initState)
  })

  it('reducer 不修改原 state（不可变）', () => {
    const before = { ...initState, models: [...initState.models] }
    reducer(initState, { type: 'ADD_MODEL', model: { ...baseModel, id: 'm2' } })
    expect(initState.models).toEqual(before.models)
    expect(initState.models).toHaveLength(1)
  })
})
