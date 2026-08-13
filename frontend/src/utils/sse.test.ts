import { describe, it, expect, vi } from 'vitest'
import { parseSSEStream } from './sse'

function makeReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach(c => controller.enqueue(new TextEncoder().encode(c)))
      controller.close()
    }
  })
  return stream.getReader()
}

describe('parseSSEStream', () => {
  it('解析多条 data: 行并回调 onData（跳过 [DONE]）', async () => {
    const onData = vi.fn()
    const reader = makeReader([
      'data: hello\n\n',
      'data: world\n\n',
      'data: [DONE]\n\n'
    ])
    await parseSSEStream(reader, onData)
    expect(onData).toHaveBeenCalledTimes(2)
    expect(onData).toHaveBeenNthCalledWith(1, 'hello')
    expect(onData).toHaveBeenNthCalledWith(2, 'world')
  })

  it('跨 chunk 边界拼接不丢失不重复', async () => {
    const onData = vi.fn()
    const line = 'data: hello\n\n'
    const reader = makeReader([line.slice(0, 10), line.slice(10)])
    await parseSSEStream(reader, onData)
    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith('hello')
  })

  it('忽略非 data: 行与注释行', async () => {
    const onData = vi.fn()
    const reader = makeReader([
      ': comment\n',
      '\n',
      'data: real\n\n'
    ])
    await parseSSEStream(reader, onData)
    expect(onData).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith('real')
  })

  it('仅 [DONE] → 不回调', async () => {
    const onData = vi.fn()
    const reader = makeReader(['data: [DONE]\n\n'])
    await parseSSEStream(reader, onData)
    expect(onData).not.toHaveBeenCalled()
  })

  it('空流 → 不回调且正常结束', async () => {
    const onData = vi.fn()
    const reader = makeReader([])
    await parseSSEStream(reader, onData)
    expect(onData).not.toHaveBeenCalled()
  })

  it('data: 前缀后内容原样传给 onData', async () => {
    const onData = vi.fn()
    const reader = makeReader(['data: {"a":1}\n\n'])
    await parseSSEStream(reader, onData)
    expect(onData).toHaveBeenCalledWith('{"a":1}')
  })
})
