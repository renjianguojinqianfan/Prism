import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode
} from 'react'
import type { AnalysisTag, Message, ModelConfig, ToastItem, ToastType } from './types'
import { PRESET_MODELS, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../config/presetModels'
import { buildAPIHistory, streamChat } from '../services/api'
import { generateSimReply } from '../services/simulator'
import { fetchAnalysis, localHeuristicAnalyze } from '../services/analyzer'
import { sleep, genId } from '../utils/sleep'

const ANALYZE_ENDPOINT =
  import.meta.env.VITE_ANALYZE_ENDPOINT || 'http://localhost:8000/api/analyze'

interface State {
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

type Action =
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

function loadModels(): ModelConfig[] {
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
      const parsed = JSON.parse(saved) as ModelConfig[]
      PRESET_MODELS.forEach(preset => {
        if (!parsed.find(m => m.id === preset.id && !m.custom)) {
          parsed.push({ ...preset })
        }
      })
      return parsed
    } catch {
      return PRESET_MODELS.map(m => ({ ...m }))
    }
  }
  return PRESET_MODELS.map(m => ({ ...m }))
}

function initState(): State {
  return {
    models: loadModels(),
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
}

function reducer(state: State, action: Action): State {
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

interface DiscussionContextValue {
  state: State
  setSimulate: (v: boolean) => void
  setMaxRounds: (v: number) => void
  setInput: (v: string) => void
  toggleModelEnabled: (id: string) => void
  updateModel: (idx: number, patch: Partial<ModelConfig>) => void
  addCustomModel: () => void
  removeModel: (idx: number) => void
  saveSettings: () => void
  openSettings: () => void
  closeSettings: () => void
  startDiscussion: () => void
  togglePause: () => void
  nextSpeaker: () => void
  resetDiscussion: () => void
  exportDiscussion: () => void
  showToast: (message: string, type?: ToastType) => void
  dismissToast: (id: string) => void
}

const DiscussionContext = createContext<DiscussionContextValue | null>(null)

export function DiscussionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  const messagesRef = useRef<Message[]>([])
  const topicRef = useRef('')
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const controlRef = useRef({
    active: false,
    paused: false,
    abortController: null as AbortController | null
  })

  useEffect(() => {
    messagesRef.current = state.messages
  }, [state.messages])

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(timer => clearTimeout(timer))
      toastTimersRef.current.clear()
    }
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = genId()
    dispatch({ type: 'ADD_TOAST', toast: { id, message, type } })
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', id })
      toastTimersRef.current.delete(id)
    }, 3000)
    toastTimersRef.current.set(id, timer)
  }, [])

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      toastTimersRef.current.delete(id)
    }
    dispatch({ type: 'REMOVE_TOAST', id })
  }, [])

  const pushMessage = useCallback((msg: Message) => {
    messagesRef.current = [...messagesRef.current, msg]
    dispatch({ type: 'ADD_MESSAGE', message: msg })
  }, [])

  const updateMessage = useCallback((id: string, patch: Partial<Message>) => {
    messagesRef.current = messagesRef.current.map(m =>
      m.id === id ? { ...m, ...patch } : m
    )
    dispatch({ type: 'UPDATE_MESSAGE', id, patch })
  }, [])

  const setSimulate = useCallback((v: boolean) => dispatch({ type: 'SET_SIMULATE', value: v }), [])
  const setMaxRounds = useCallback((v: number) => dispatch({ type: 'SET_MAX_ROUNDS', value: v }), [])
  const setInput = useCallback((v: string) => dispatch({ type: 'SET_INPUT', value: v }), [])
  const toggleModelEnabled = useCallback((id: string) => dispatch({ type: 'TOGGLE_MODEL_ENABLED', id }), [])
  const updateModel = useCallback((idx: number, patch: Partial<ModelConfig>) =>
    dispatch({ type: 'UPDATE_MODEL', idx, patch }), [])

  const addCustomModel = useCallback(() => {
    dispatch({
      type: 'ADD_MODEL',
      model: {
        id: 'custom_' + Date.now(),
        name: '自定义模型',
        icon: 'fa-robot',
        color: '#A78BFA',
        endpoint: 'https://api.example.com/v1/chat/completions',
        model: 'model-name',
        apiKey: '',
        systemPrompt: '你是一位独特的AI讨论者，拥有自己的视角和风格。在讨论中，你总是提供有价值的观点。',
        enabled: true,
        custom: true
      }
    })
  }, [])

  const removeModel = useCallback((idx: number) => dispatch({ type: 'REMOVE_MODEL', idx }), [])

  const openSettings = useCallback(() => dispatch({ type: 'SET_SETTINGS_OPEN', value: true }), [])
  const closeSettings = useCallback(() => dispatch({ type: 'SET_SETTINGS_OPEN', value: false }), [])

  const togglePause = useCallback(() => {
    controlRef.current.paused = !controlRef.current.paused
    dispatch({ type: 'SET_PAUSED', value: controlRef.current.paused })
  }, [])

  const nextSpeaker = useCallback(() => {
    controlRef.current.abortController?.abort()
    showToast('已跳过当前发言者', 'info')
  }, [showToast])

  const resetDiscussion = useCallback(() => {
    controlRef.current.active = false
    controlRef.current.paused = false
    controlRef.current.abortController?.abort()
    messagesRef.current = []
    dispatch({ type: 'CLEAR_MESSAGES' })
    dispatch({ type: 'SET_DISCUSSION_ACTIVE', value: false })
    dispatch({ type: 'SET_PAUSED', value: false })
    dispatch({ type: 'SET_SPEAKING', id: null })
    dispatch({ type: 'SET_CURRENT_ROUND', value: 0 })
    dispatch({ type: 'SET_INPUT', value: '' })
    showToast('讨论已重置', 'info')
  }, [showToast])

  const value = useMemo<DiscussionContextValue>(() => {
    const persistModels = () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.models))
    }

    const saveSettings = () => {
      persistModels()
      dispatch({ type: 'SET_SETTINGS_OPEN', value: false })
      showToast('配置已保存', 'success')
    }

    const endDiscussion = () => {
      controlRef.current.active = false
      controlRef.current.paused = false
      dispatch({ type: 'SET_DISCUSSION_ACTIVE', value: false })
      dispatch({ type: 'SET_PAUSED', value: false })
      dispatch({ type: 'SET_SPEAKING', id: null })
      dispatch({ type: 'SET_CURRENT_ROUND', value: 0 })
    }

    const generateResponse = async (model: ModelConfig, round: number, simulate: boolean) => {
      const msgId = genId()
      let fullContent = ''

      try {
        if (simulate) {
          const reply = generateSimReply(model.id, topicRef.current, messagesRef.current, round)
          pushMessage({
            id: msgId,
            role: 'assistant',
            content: '',
            modelId: model.id,
            modelName: model.name,
            round,
            thinking: true
          })
          for (let i = 0; i < reply.length; i++) {
            if (!controlRef.current.active) return
            while (controlRef.current.paused) {
              await sleep(100)
              if (!controlRef.current.active) return
            }
            fullContent += reply[i]
            updateMessage(msgId, { content: fullContent, thinking: true })
            await sleep(20 + Math.random() * 30)
          }
        } else {
          pushMessage({
            id: msgId,
            role: 'assistant',
            content: '',
            modelId: model.id,
            modelName: model.name,
            round,
            thinking: true
          })
          controlRef.current.abortController = new AbortController()
          const history = buildAPIHistory(model, round, topicRef.current, messagesRef.current)
          fullContent = await streamChat(
            model,
            history,
            controlRef.current.abortController.signal,
            (_delta, full) => {
              updateMessage(msgId, { content: full, thinking: true })
            }
          )
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        fullContent = `[调用失败] ${(err as Error).message}`
        showToast(`${model.name} 调用出错：${(err as Error).message}`, 'error')
      }

      updateMessage(msgId, { content: fullContent, thinking: false })
    }

    const analyzeMessages = async (simulate: boolean) => {
      const aiMsgs = messagesRef.current.filter(m => m.role === 'assistant')
      if (aiMsgs.length === 0) return
      const payload = {
        topic: topicRef.current || '',
        messages: aiMsgs.map(m => ({ id: m.id, modelName: m.modelName, content: m.content }))
      }

      let tags: AnalysisTag[] | null = null
      if (!simulate) {
        tags = await fetchAnalysis(ANALYZE_ENDPOINT, payload)
      }
      if (!tags) {
        tags = localHeuristicAnalyze(payload.messages)
        showToast('已使用本地分析（后端不可用或模拟模式）', 'info')
      }
      tags.forEach(t => {
        updateMessage(t.id, { tag: { label: t.label, evidence: t.evidence } })
      })
    }

    const runDiscussion = async (simulate: boolean) => {
      const enabledModels = state.models.filter(m => m.enabled)
      if (enabledModels.length === 0) return

      for (let round = 1; round <= state.maxRounds; round++) {
        dispatch({ type: 'SET_CURRENT_ROUND', value: round })
        for (const model of enabledModels) {
          while (controlRef.current.paused) {
            await sleep(200)
            if (!controlRef.current.active) return
          }
          if (!controlRef.current.active) return

          if (!simulate && !model.apiKey) {
            pushMessage({
              id: genId(),
              role: 'system',
              content: `${model.name} 未配置API Key，跳过`,
              modelId: null,
              modelName: ''
            })
            continue
          }

          dispatch({ type: 'SET_SPEAKING', id: model.id })
          await generateResponse(model, round, simulate)
          dispatch({ type: 'SET_SPEAKING', id: null })
          await sleep(600)
        }
      }

      pushMessage({
        id: genId(),
        role: 'system',
        content: '讨论结束',
        modelId: null,
        modelName: ''
      })
      await analyzeMessages(simulate)
      endDiscussion()
    }

    const startDiscussion = () => {
      const topic = state.inputText.trim()
      if (!topic) {
        showToast('请输入话题或想法', 'warning')
        return
      }
      if (state.discussionActive) {
        pushMessage({
          id: genId(),
          role: 'user',
          content: topic,
          modelId: 'user',
          modelName: '你'
        })
        showToast('你的观点已加入讨论', 'success')
        dispatch({ type: 'SET_INPUT', value: '' })
        return
      }

      const enabledModels = state.models.filter(m => m.enabled)
      if (enabledModels.length === 0) {
        showToast('请至少启用一个模型', 'warning')
        return
      }

      controlRef.current.active = true
      controlRef.current.paused = false
      dispatch({ type: 'SET_DISCUSSION_ACTIVE', value: true })
      dispatch({ type: 'SET_PAUSED', value: false })
      dispatch({ type: 'SET_CURRENT_ROUND', value: 0 })
      messagesRef.current = []
      dispatch({ type: 'CLEAR_MESSAGES' })
      dispatch({ type: 'SET_INPUT', value: '' })

      pushMessage({
        id: genId(),
        role: 'system',
        content: `讨论话题：${topic}`,
        modelId: null,
        modelName: ''
      })
      pushMessage({
        id: genId(),
        role: 'user',
        content: topic,
        modelId: 'user',
        modelName: '你'
      })

      topicRef.current = topic
      void runDiscussion(state.simulate)
    }

    const exportDiscussion = () => {
      if (state.messages.length === 0) {
        showToast('暂无讨论内容可导出', 'warning')
        return
      }
      let text = `# 棱镜 — 讨论记录\n\n`
      text += `## 话题：${topicRef.current || '自由讨论'}\n\n`
      text += `---\n\n`
      state.messages.forEach(msg => {
        if (msg.role === 'user') {
          text += `### 主持人\n${msg.content}\n\n`
        } else if (msg.role === 'assistant') {
          text += `### ${msg.modelName}（第${msg.round}轮）\n${msg.content}\n\n`
        }
      })
      text += `---\n*导出于 ${new Date().toLocaleString('zh-CN')}*`

      const blob = new Blob([text], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `棱镜_${new Date().toISOString().slice(0, 10)}.md`
      a.click()
      URL.revokeObjectURL(url)
      showToast('讨论记录已导出', 'success')
    }

    return {
      state,
      setSimulate,
      setMaxRounds,
      setInput,
      toggleModelEnabled,
      updateModel,
      addCustomModel,
      removeModel,
      saveSettings,
      openSettings,
      closeSettings,
      startDiscussion,
      togglePause,
      nextSpeaker,
      resetDiscussion,
      exportDiscussion,
      showToast,
      dismissToast
    }
  }, [
    state,
    setSimulate,
    setMaxRounds,
    setInput,
    toggleModelEnabled,
    updateModel,
    addCustomModel,
    removeModel,
    openSettings,
    closeSettings,
    togglePause,
    nextSpeaker,
    resetDiscussion,
    showToast,
    dismissToast,
    pushMessage,
    updateMessage
  ])

  return <DiscussionContext.Provider value={value}>{children}</DiscussionContext.Provider>
}

export function useDiscussion(): DiscussionContextValue {
  const ctx = useContext(DiscussionContext)
  if (!ctx) throw new Error('useDiscussion must be used within DiscussionProvider')
  return ctx
}
