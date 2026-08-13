/**
 * 解析 SSE 流，对每个 data: 行的 payload 调用 onData。
 * 处理跨 chunk 边界的 buffer 拆分、data: 前缀过滤与 [DONE] 跳过。
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onData: (data: string) => void
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      onData(data)
    }
  }
}
