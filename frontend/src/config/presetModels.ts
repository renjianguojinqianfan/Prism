import type { ModelConfig } from '../store/types'

export const PRESET_MODELS: ModelConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'fa-brain',
    color: '#10B981',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    apiKey: '',
    systemPrompt: '你是DeepSeek，一位善于深度逻辑分析的思考者。你擅长拆解问题、发现逻辑漏洞、提供严谨的分析。在讨论中，你追求准确性和深度，善于指出他人论证中的不足。回答控制在200字以内。',
    enabled: true,
    custom: false
  },
  {
    id: 'kimi',
    name: 'Kimi',
    icon: 'fa-moon',
    color: '#F43F5E',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    apiKey: '',
    systemPrompt: '你是Kimi，一位富有创造力的创新思考者。你擅长从不同角度看问题、提出新颖的想法和意想不到的解决方案。在讨论中，你总是带来新鲜的视角，喜欢挑战常规思维。回答控制在200字以内。',
    enabled: true,
    custom: false
  },
  {
    id: 'glm',
    name: 'GLM',
    icon: 'fa-gem',
    color: '#06B6D4',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    apiKey: '',
    systemPrompt: '你是GLM，一位知识渊博的综合学者。你擅长引用各领域知识、进行跨学科分析、提供全面的信息。在讨论中，你总是提供有据可查的观点，善于综合各方意见。回答控制在200字以内。',
    enabled: true,
    custom: false
  },
  {
    id: 'qwen',
    name: '通义千问',
    icon: 'fa-fire',
    color: '#F97316',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-turbo',
    apiKey: '',
    systemPrompt: '你是通义千问，一位务实落地的实践者。你擅长把理论转化为可执行方案、评估风险与成本、设计实施路径。在讨论中，你总是关注可行性和落地性，善于把天马行空的想法拉回地面。回答控制在200字以内。',
    enabled: true,
    custom: false
  }
]

export const PRESET_IDS = ['deepseek', 'kimi', 'glm', 'qwen']

export const STORAGE_KEY = 'aiRoundtable_models'
