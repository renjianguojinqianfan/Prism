import type { ModelConfig } from '../store/types'

// 不再提供默认预设模型。用户在 SettingsPanel 自填，或点击「快速添加模板」一键填好基本信息。
export const PRESET_MODELS: ModelConfig[] = []

// 快速添加模板：用户点击 + 按钮后填入对应字段，apiKey 仍需用户填写。
// 这里的字段是 ModelConfig 的子集（不含 id/apiKey/enabled/custom，由调用方补全）。
export interface QuickTemplate {
  name: string
  icon: string
  color: string
  endpoint: string
  model: string
  systemPrompt: string
}

export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    name: 'DeepSeek',
    icon: 'fa-brain',
    color: '#10B981',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    systemPrompt: '你是DeepSeek，一位善于深度逻辑分析的思考者。你擅长拆解问题、发现逻辑漏洞、提供严谨的分析。在讨论中，你追求准确性和深度，善于指出他人论证中的不足。回答控制在200字以内。',
  },
  {
    name: 'Kimi',
    icon: 'fa-moon',
    color: '#F43F5E',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    systemPrompt: '你是Kimi，一位富有创造力的创新思考者。你擅长从不同角度看问题、提出新颖的想法和意想不到的解决方案。在讨论中，你总是带来新鲜的视角，喜欢挑战常规思维。回答控制在200字以内。',
  },
  {
    name: 'GLM',
    icon: 'fa-gem',
    color: '#06B6D4',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    systemPrompt: '你是GLM，一位知识渊博的综合学者。你擅长引用各领域知识、进行跨学科分析、提供全面的信息。在讨论中，你总是提供有据可查的观点，善于综合各方意见。回答控制在200字以内。',
  },
  {
    name: '通义千问',
    icon: 'fa-fire',
    color: '#F97316',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-turbo',
    systemPrompt: '你是通义千问，一位务实落地的实践者。你擅长把理论转化为可执行方案、评估风险与成本、设计实施路径。在讨论中，你总是关注可行性和落地性，善于把天马行空的想法拉回地面。回答控制在200字以内。',
  },
  {
    name: 'Mimo',
    icon: 'fa-bolt',
    color: '#8B5CF6',
    endpoint: 'https://api.mimo.com/v1/chat/completions',
    model: 'mimo-v2.5',
    systemPrompt: '你是Mimo，一位思维敏捷的辩论者。你擅长快速抓住问题核心、提出尖锐的反问、在辩论中寻找漏洞。在讨论中，你总是直接表达不同观点，推动讨论深入。回答控制在200字以内。',
  },
]

export const STORAGE_KEY = 'prism_models'
export const LEGACY_STORAGE_KEY = 'aiRoundtable_models'
