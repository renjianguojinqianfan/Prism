import type { Message, ModelConfig, ToastItem } from './types'
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '../config/presetModels'

export interface State {
  models: ModelConfig[]
  messages: Message[]
  simulate: boolean
  maxRounds: number
  discussionActive: boolean
  discussionPaused: boolean
  currentRound: number
  speakingModelId: string | null
  settingsOpen: boolean
  inputText: string
  toasts: ToastItem[]
}

export type Action =
  | { type: 'SET_MODELS'; models: ModelConfig[] }
  | { type: 'UPDATE_MODEL'; idx: number; patch: Partial<ModelConfig> }
  | { type: 'ADD_MODEL'; model: ModelConfig }
  | { type: 'REMOVE_MODEL'; idx: number }
  | { type: 'TOGGLE_MODEL_ENABLED'; id: string }
  | { type: 'SET_SIMULATE'; value: boolean }
  | { type: 'SET_MAX_ROUNDS'; value: number }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'UPDATE_MESSAGE'; id: string; patch: Partial<Message> }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_DISCUSSION_ACTIVE'; value: boolean }
  | { type: 'SET_PAUSED'; value: boolean }
  | { type: 'SET_CURRENT_ROUND'; value: number }
  | { type: 'SET_SPEAKING'; id: string | null }
  | { type: 'SET_SETTINGS_OPEN'; value: boolean }
  | { type: 'ADD_TOAST'; toast: ToastItem }
  | { type: 'REMOVE_TOAST'; id: string }

export function loadModels(): ModelConfig[] {
  let saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      saved = legacy
      localStorage.setItem(STORAGE_KEY, legacy)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  }
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.every(m =>
        m && typeof m.endpoint === 'string' && typeof m.model === 'string'
      )) {
        return parsed as ModelConfig[]
      }
    } catch {
      // 损坏数据，返回空
    }
  }
  return []
}

export function initState(): State {
  const models = loadModels()
  return {
    models,
    messages: [],
    simulate: true,
    maxRounds: 2,
    discussionActive: false,
    discussionPaused: false,
    currentRound: 0,
    speakingModelId: null,
    // 模型列表为空时自动展开配置面板，引导用户添加模型
    settingsOpen: models.length === 0,
    inputText: '',
    toasts: []
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MODELS':
      return { ...state, models: action.models }
    case 'UPDATE_MODEL':
      return {
        ...state,
        models: state.models.map((m, i) => (i === action.idx ? { ...m, ...action.patch } : m))
      }
    case 'ADD_MODEL':
      return { ...state, models: [...state.models, action.model] }
    case 'REMOVE_MODEL':
      return { ...state, models: state.models.filter((_, i) => i !== action.idx) }
    case 'TOGGLE_MODEL_ENABLED':
      return {
        ...state,
        models: state.models.map(m => (m.id === action.id ? { ...m, enabled: !m.enabled } : m))
      }
    case 'SET_SIMULATE':
      return { ...state, simulate: action.value }
    case 'SET_MAX_ROUNDS':
      return { ...state, maxRounds: action.value }
    case 'SET_INPUT':
      return { ...state, inputText: action.value }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m => (m.id === action.id ? { ...m, ...action.patch } : m))
      }
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] }
    case 'SET_DISCUSSION_ACTIVE':
      return { ...state, discussionActive: action.value }
    case 'SET_PAUSED':
      return { ...state, discussionPaused: action.value }
    case 'SET_CURRENT_ROUND':
      return { ...state, currentRound: action.value }
    case 'SET_SPEAKING':
      return { ...state, speakingModelId: action.id }
    case 'SET_SETTINGS_OPEN':
      return { ...state, settingsOpen: action.value }
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) }
    default:
      return state
  }
}
