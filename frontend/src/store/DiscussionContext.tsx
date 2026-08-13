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
import type { ModelConfig, ToastType } from './types'
import { reducer, initState, type State } from './reducer'
import { STORAGE_KEY, type QuickTemplate } from '../config/presetModels'
import { DiscussionEngine, type DiscussionConfig, type EngineCallbacks } from '../services/discussionEngine'
import { genId } from '../utils/sleep'

interface DiscussionContextValue {
  state: State
  setSimulate: (v: boolean) => void
  setMaxRounds: (v: number) => void
  setInput: (v: string) => void
  toggleModelEnabled: (id: string) => void
  updateModel: (idx: number, patch: Partial<ModelConfig>) => void
  addCustomModel: () => void
  addModelFromTemplate: (template: QuickTemplate) => void
  removeModel: (idx: number) => void
  saveSettings: () => void
  openSettings: () => void
  closeSettings: () => void
  startDiscussion: () => void
  interject: () => void
  togglePause: () => void
  nextSpeaker: () => void
  resetDiscussion: () => void
  exportDiscussion: () => void
  showToast: (message: string, type?: ToastType) => void
  dismissToast: (id: string) => void
}

const DiscussionContext = createContext<DiscussionContextValue | null>(null)

export function useDiscussion(): DiscussionContextValue {
  const ctx = useContext(DiscussionContext)
  if (!ctx) throw new Error('useDiscussion 必须在 DiscussionProvider 内使用')
  return ctx
}

export function DiscussionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

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

  // 引擎实例（useRef 保持单例），副作用经 4 个回调出口
  const engineRef = useRef<DiscussionEngine | null>(null)
  if (!engineRef.current) {
    const callbacks: EngineCallbacks = {
      onMessage: (msg) => dispatch({ type: 'ADD_MESSAGE', message: msg }),
      onUpdate: (id, patch) => dispatch({ type: 'UPDATE_MESSAGE', id, patch }),
      onDispatch: dispatch,
      onToast: showToast,
    }
    engineRef.current = new DiscussionEngine(callbacks)
  }
  const engine = engineRef.current

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
        systemPrompt: '你是自定义模型，请从你的视角参与讨论。',
        enabled: true,
        custom: true
      }
    })
  }, [])

  const addModelFromTemplate = useCallback((template: QuickTemplate) => {
    dispatch({
      type: 'ADD_MODEL',
      model: {
        id: 'custom_' + Date.now(),
        apiKey: '',
        enabled: true,
        custom: true,
        ...template,
      }
    })
  }, [])

  const removeModel = useCallback((idx: number) => dispatch({ type: 'REMOVE_MODEL', idx }), [])

  const openSettings = useCallback(() => dispatch({ type: 'SET_SETTINGS_OPEN', value: true }), [])
  const closeSettings = useCallback(() => dispatch({ type: 'SET_SETTINGS_OPEN', value: false }), [])

  const togglePause = useCallback(() => engine.togglePause(), [engine])
  const nextSpeaker = useCallback(() => engine.skip(), [engine])
  const resetDiscussion = useCallback(() => engine.reset(), [engine])

  const value = useMemo<DiscussionContextValue>(() => {
    const persistModels = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.models))
      } catch {
        showToast('配置保存失败，可能存储空间已满', 'error')
      }
    }

    const saveSettings = () => {
      persistModels()
      dispatch({ type: 'SET_SETTINGS_OPEN', value: false })
      showToast('配置已保存', 'success')
    }

    const startDiscussion = () => {
      const topic = state.inputText.trim()
      if (!topic) {
        showToast('请输入话题或想法', 'warning')
        return
      }
      const enabledModels = state.models.filter(m => m.enabled)
      if (enabledModels.length === 0) {
        showToast('请至少启用一个模型', 'warning')
        return
      }
      const config: DiscussionConfig = {
        models: state.models,
        simulate: state.simulate,
        maxRounds: state.maxRounds,
        topic,
      }
      dispatch({ type: 'CLEAR_MESSAGES' })
      dispatch({ type: 'SET_INPUT', value: '' })
      engine.start(config)
    }

    const interject = () => {
      const topic = state.inputText.trim()
      if (!topic) return
      dispatch({ type: 'SET_INPUT', value: '' })
      engine.interject(topic)
    }

    const exportDiscussion = () => {
      if (state.messages.length === 0) {
        showToast('暂无讨论内容可导出', 'warning')
        return
      }
      // 话题取第一条 user 消息（start 时写入的初始话题）
      const firstUser = state.messages.find(m => m.role === 'user')
      let text = `# 棱镜 — 讨论记录\n\n`
      text += `## 话题：${firstUser?.content || '自由讨论'}\n\n`
      text += `---\n\n`
      state.messages.forEach(msg => {
        if (msg.role === 'user') {
          text += `### 主持人\n${msg.content}\n\n`
        } else if (msg.role === 'assistant') {
          text += `### ${msg.modelName}${msg.round ? `（第${msg.round}轮）` : ''}\n${msg.content}\n\n`
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
      addModelFromTemplate,
      removeModel,
      saveSettings,
      openSettings,
      closeSettings,
      startDiscussion,
      interject,
      togglePause,
      nextSpeaker,
      resetDiscussion,
      exportDiscussion,
      showToast,
      dismissToast
    }
  }, [
    state,
    engine,
    setSimulate,
    setMaxRounds,
    setInput,
    toggleModelEnabled,
    updateModel,
    addCustomModel,
    addModelFromTemplate,
    removeModel,
    openSettings,
    closeSettings,
    togglePause,
    nextSpeaker,
    resetDiscussion,
    showToast,
    dismissToast
  ])

  return (
    <DiscussionContext.Provider value={value}>
      {children}
    </DiscussionContext.Provider>
  )
}
