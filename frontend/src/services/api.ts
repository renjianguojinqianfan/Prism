import type { Message, ModelConfig } from '../store/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function buildAPIHistory(
  model: ModelConfig,
  currentRound: number,
  topic: string,
  messages: Message[]
): ChatMessage[] {
  const history: ChatMessage[] = [
    {
      role: 'system',
      content:
        model.systemPrompt +
        `\n\n当前讨论话题：「${topic}」\n你正在与其他AI进行第${currentRound}轮讨论。请基于话题和前人的发言，提出你的独特观点。可以赞同、反驳或补充其他参与者。`
    }
  ]
  messages.forEach(msg => {
    if (msg.role === 'user') {
      history.push({ role: 'user', content: `[主持人] ${msg.content}` })
    } else if (msg.role === 'assistant') {
      history.push({ role: 'assistant', content: `[${msg.modelName}] ${msg.content}` })
    }
  })
  history.push({
    role: 'user',
    content: `现在轮到你发言了。请从你的独特视角出发，对话题「${topic}」发表第${currentRound}轮观点。`
  })
  return history
}

export async function streamChat(
  model: ModelConfig,
  history: ChatMessage[],
  signal: AbortSignal,
  onDelta: (delta: string, full: string) => void
): Promise<string> {
  const response = await fetch(model.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`
    },
    body: JSON.stringify({
      model: model.model,
      messages: history,
      max_tokens: 500,
      temperature: 0.85,
      stream: true
    }),
    signal
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API返回 ${response.status}: ${errText.substring(0, 100)}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const delta: string = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            onDelta(delta, fullContent)
          }
        } catch {
          /* 忽略解析错误 */
        }
      }
    }
  }
  return fullContent
}
