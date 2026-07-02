import { describe, it, expect } from 'vitest'
import { sleep, genId } from './sleep'

describe('sleep', () => {
  it('等待指定毫秒后 resolve', async () => {
    const start = Date.now()
    await sleep(50)
    const elapsed = Date.now() - start
    // 至少 50ms（可能因调度略多）
    expect(elapsed).toBeGreaterThanOrEqual(45)
    // 上限保护：不应当超过太久
    expect(elapsed).toBeLessThan(500)
  })

  it('ms=0 → 立即 resolve（仍走 event loop）', async () => {
    let resolved = false
    await sleep(0).then(() => { resolved = true })
    expect(resolved).toBe(true)
  })

  it('resolve 值为 undefined', async () => {
    const r = await sleep(10)
    expect(r).toBeUndefined()
  })
})

describe('genId', () => {
  it('返回 msg_ 前缀', () => {
    expect(genId().startsWith('msg_')).toBe(true)
  })

  it('两次调用产生不同 id（时间戳 + 随机）', () => {
    const a = genId()
    const b = genId()
    expect(a).not.toBe(b)
  })

  it('包含时间戳和随机段', () => {
    const r = genId()
    // msg_<timestamp>_<6 字符 base36>
    const parts = r.split('_')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('msg')
    // 时间戳应为数字
    expect(Number.isFinite(Number(parts[1]))).toBe(true)
    // 随机段长度 = 6
    expect(parts[2].length).toBe(6)
  })
})
