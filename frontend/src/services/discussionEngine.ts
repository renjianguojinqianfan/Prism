import type { Message, ModelConfig, ToastType } from '../store/types'
import type { Action } from '../store/reducer'
import { buildAPIHistory, streamChat } from './api'
import { generateSimReply } from './simulator'
import { directStreamAnalysis, localHeuristicAnalyze, type DirectStreamAnalysisPayload } from './analyzer'
import { sleep, genId } from '../utils/sleep'

/** 引擎回调 - 仅 4 个副作用出口，测试只需 mock 这些 */
export interface EngineCallbacks {
  onMessage: (msg: Message) => void
  onUpdate: (id: string, patch: Partial<Message>) => void
  onDispatch: (action: Action) => void
  onToast: (message: string, type?: ToastType) => void
}

/** 讨论配置 - 启动时传入的数据快照 */
export interface DiscussionConfig {
  models: ModelConfig[]
  simulate: boolean
  maxRounds: number
  topic: string
}

/**
 * 讨论编排引擎。
 * 控制状态（active/paused/skipRequested/abortController/token）是 private 实现，
 * 不暴露在接口上。调用方通过 start/togglePause/skip/reset/interject 命令控制。
 */
export class DiscussionEngine {
  // --- 控制状态（private，不暴露） ---
  private active = false
  private paused = false
  private skipRequested = false
  private token: string | null = null
  private abortCtrl: AbortController | null = null

  // --- 数据 ref（private，引擎自拥） ---
  private messages: Message[] = []
  private topic = ''

  constructor(private cb: EngineCallbacks) {}

  /** 启动新讨论 */
  start(config: DiscussionConfig): void {
    this.active = true
    this.paused = false
    this.skipRequested = false
    this.token = genId()
    this.topic = config.topic
    this.messages = []

    this.cb.onDispatch({ type: 'SET_DISCUSSION_ACTIVE', value: true })
    this.cb.onDispatch({ type: 'SET_PAUSED', value: false })
    this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: 0 })

    this.pushMessage({ id: genId(), role: 'system', content: `讨论话题：${config.topic}`, modelId: null, modelName: '' })
    this.pushMessage({ id: genId(), role: 'user', content: config.topic, modelId: 'user', modelName: '你' })

    void this.runDiscussion(config)
  }

  /** 暂停/继续 */
  togglePause(): void {
    this.paused = !this.paused
    this.cb.onDispatch({ type: 'SET_PAUSED', value: this.paused })
  }

  /** 跳过当前发言者 */
  skip(): void {
    this.skipRequested = true
    this.abortCtrl?.abort()
    this.cb.onToast('已跳过当前发言者', 'info')
  }

  /** 重置讨论 */
  reset(): void {
    this.active = false
    this.paused = false
    this.token = null
    this.abortCtrl?.abort()
    this.messages = []
    this.cb.onDispatch({ type: 'CLEAR_MESSAGES' })
    this.cb.onDispatch({ type: 'SET_DISCUSSION_ACTIVE', value: false })
    this.cb.onDispatch({ type: 'SET_PAUSED', value: false })
    this.cb.onDispatch({ type: 'SET_SPEAKING', id: null })
    this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: 0 })
    this.cb.onToast('讨论已重置', 'info')
  }

  /** 插话：向进行中的讨论追加 user 观点 */
  interject(topic: string): void {
    this.pushMessage({ id: genId(), role: 'user', content: topic, modelId: 'user', modelName: '你' })
    this.cb.onToast('你的观点已加入讨论', 'success')
  }

  // --- 以下为 private 实现 ---

  private pushMessage(msg: Message): void {
    this.messages = [...this.messages, msg]
    this.cb.onMessage(msg)
  }

  private updateMessage(id: string, patch: Partial<Message>): void {
    this.messages = this.messages.map(m => (m.id === id ? { ...m, ...patch } : m))
    this.cb.onUpdate(id, patch)
  }

  private endDiscussion(): void {
    this.active = false
    this.paused = false
    this.token = null
    this.cb.onDispatch({ type: 'SET_DISCUSSION_ACTIVE', value: false })
    this.cb.onDispatch({ type: 'SET_PAUSED', value: false })
    this.cb.onDispatch({ type: 'SET_SPEAKING', id: null })
    this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: 0 })
  }

  private async generateResponse(
    model: ModelConfig,
    round: number,
    simulate: boolean,
    token: string | null
  ): Promise<void> {
    this.skipRequested = false
    const msgId = genId()
    let fullContent = ''

    try {
      if (simulate) {
        const reply = generateSimReply(model, this.topic, this.messages, round)
        this.pushMessage({
          id: msgId,
          role: 'assistant',
          content: '',
          modelId: model.id,
          modelName: model.name,
          round,
          thinking: true
        })
        for (let i = 0; i < reply.length; i++) {
          if (!this.active || this.token !== token) return
          if (this.skipRequested) {
            fullContent = reply
            this.updateMessage(msgId, { content: fullContent, thinking: true })
            break
          }
          while (this.paused) {
            await sleep(100)
            if (!this.active || this.token !== token) return
          }
          fullContent += reply[i]
          this.updateMessage(msgId, { content: fullContent, thinking: true })
          await sleep(20 + Math.random() * 30)
        }
        this.skipRequested = false
      } else {
        const ctrl = new AbortController()
        this.abortCtrl = ctrl
        const timeoutTimer = setTimeout(() => ctrl.abort(), 120000)
        try {
          // 先构建 API 历史（此时 this.messages 不含当前发言的占位消息）
          const history = buildAPIHistory(model, round, this.topic, this.messages)

          // 再推占位消息用于 UI 流式显示
          this.pushMessage({
            id: msgId,
            role: 'assistant',
            content: '',
            modelId: model.id,
            modelName: model.name,
            round,
            thinking: true
          })

          fullContent = await streamChat(
            model,
            history,
            ctrl.signal,
            (_delta, full) => {
              this.updateMessage(msgId, { content: full, thinking: true })
            }
          )
        } finally {
          clearTimeout(timeoutTimer)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const current = this.messages.find(m => m.id === msgId)
        const content = current?.content || '[已跳过]'
        this.updateMessage(msgId, { content, thinking: false })
        return
      }
      const errMsg = err instanceof Error ? err.message : String(err)
      fullContent = `[调用失败] ${errMsg}`
      this.cb.onToast(`${model.name} 调用出错：${errMsg}`, 'error')
    }

    this.updateMessage(msgId, { content: fullContent, thinking: false })
  }

  private async streamAnalyzeMessage(
    currentMsg: Message,
    priorAiMsgs: Message[],
    isBaseline: boolean,
    simulate: boolean,
    models: ModelConfig[],
    token: string | null
  ): Promise<void> {
    // 第一条 AI 发言作为基准，不带标签
    if (isBaseline) return

    const model = models.find(m => m.id === currentMsg.modelId)
    if (!model) return

    // 模拟模式：跳过 LLM 调用，直接走 Jaccard（与现状一致）
    if (!simulate && model.apiKey) {
      const payload: DirectStreamAnalysisPayload = {
        topic: this.topic,
        currentMessage: {
          id: currentMsg.id,
          modelName: currentMsg.modelName,
          content: currentMsg.content,
        },
        priorMessages: priorAiMsgs.map(m => ({
          id: m.id,
          modelName: m.modelName,
          content: m.content,
        })),
      }
      const ctrl = new AbortController()
      this.abortCtrl = ctrl
      const finalTag = await directStreamAnalysis(model, payload, undefined, 30000, ctrl.signal)
      // 讨论已被重置/重启：丢弃分析结果，避免对已清空的消息误打标/误提示
      if (this.token !== token) return
      if (finalTag) {
        this.updateMessage(currentMsg.id, {
          tag: { label: finalTag.label, evidence: finalTag.evidence, analyzer: currentMsg.modelName }
        })
        return
      }
      // 流式失败，继续走 Jaccard 回退
    }

    if (this.token !== token) return

    // 前端 Jaccard 回退
    const fallbackMessages = [
      ...priorAiMsgs.map(m => ({ id: m.id, modelName: m.modelName, content: m.content })),
      { id: currentMsg.id, modelName: currentMsg.modelName, content: currentMsg.content },
    ]
    const localTags = localHeuristicAnalyze(fallbackMessages)
    if (localTags.length > 0) {
      const myTag = localTags[localTags.length - 1]
      this.updateMessage(currentMsg.id, {
        tag: { label: myTag.label, evidence: myTag.evidence, analyzer: '本地启发式' }
      })
      this.cb.onToast('已使用本地分析（LLM 自评不可用或模拟模式）', 'info')
    }
  }

  private async runDiscussion(config: DiscussionConfig): Promise<void> {
    const token = this.token
    const enabledModels = config.models.filter(m => m.enabled)
    if (enabledModels.length === 0) {
      // 无启用模型：保持状态一致，直接结束（防御 start() 直接调用）
      this.endDiscussion()
      return
    }

    for (let round = 1; round <= config.maxRounds; round++) {
      this.cb.onDispatch({ type: 'SET_CURRENT_ROUND', value: round })
      for (const model of enabledModels) {
        while (this.paused) {
          await sleep(200)
          if (!this.active || this.token !== token) return
        }
        if (!this.active || this.token !== token) return

        if (!config.simulate && !model.apiKey) {
          this.pushMessage({ id: genId(), role: 'system', content: `${model.name} 未配置API Key，跳过`, modelId: null, modelName: '' })
          continue
        }

        this.cb.onDispatch({ type: 'SET_SPEAKING', id: model.id })
        await this.generateResponse(model, round, config.simulate, token)
        this.cb.onDispatch({ type: 'SET_SPEAKING', id: null })
        if (this.token !== token) return

        // 实时增量分析：发言结束后立即分析这条（不等到全部讨论结束）
        const aiMsgs = this.messages.filter(m => m.role === 'assistant' && !m.thinking)
        if (aiMsgs.length > 0) {
          const current = aiMsgs[aiMsgs.length - 1]
          const prior = aiMsgs.slice(0, -1)
          const isBaseline = aiMsgs.length === 1
          await this.streamAnalyzeMessage(current, prior, isBaseline, config.simulate, config.models, token)
        }

        await sleep(600)
      }
    }

    this.pushMessage({ id: genId(), role: 'system', content: '讨论结束', modelId: null, modelName: '' })
    this.endDiscussion()
  }
}
