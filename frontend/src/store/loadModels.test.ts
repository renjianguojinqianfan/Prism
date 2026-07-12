import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadModels } from './DiscussionContext'
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '../config/presetModels'
import type { ModelConfig } from './types'

const sampleModel: ModelConfig = {
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

// 内存版 localStorage（测试环境 Node 22 内置 localStorage 缺 removeItem/clear）
function makeLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size }
  }
}

describe('loadModels', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorage())
  })

  it('无任何存储返回空数组', () => {
    expect(loadModels()).toEqual([])
  })

  it('新 key 存在返回解析结果', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleModel]))
    const r = loadModels()
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('m1')
  })

  it('仅 legacy key 迁移并清除 legacy', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([sampleModel]))
    const r = loadModels()
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('m1')
    // 新 key 被写入
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    // legacy key 被删除
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
  })

  it('新 key 损坏返回空数组不抛错', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadModels()).toEqual([])
  })
})
