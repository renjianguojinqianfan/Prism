export type Role = 'user' | 'assistant' | 'system'
export type TagLabel = 'consensus' | 'divergence' | 'neutral'
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ModelConfig {
  id: string
  name: string
  icon: string
  color: string
  endpoint: string
  model: string
  apiKey: string
  systemPrompt: string
  enabled: boolean
  custom: boolean
}

export interface MessageTag {
  label: TagLabel
  evidence?: string
  analyzer?: string  // 标签由谁评出（模型名 / '本地启发式'）
}

export interface Message {
  id: string
  role: Role
  content: string
  modelId: string | null
  modelName: string
  round?: number
  thinking?: boolean
  tag?: MessageTag
}

export interface AnalysisTag {
  id: string
  label: TagLabel
  score: number
  evidence: string
}

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}
