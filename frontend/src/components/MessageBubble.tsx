import { useDiscussion } from '../store/DiscussionContext'
import type { Message, TagLabel } from '../store/types'
import { renderMarkdown } from '../utils/markdown'
import { escapeHtml } from '../utils/escape'

const TAG_TEXT: Record<TagLabel, string> = {
  consensus: '共识 💡',
  divergence: '分歧 ⚡',
  neutral: '中立 ·'
}

export function MessageBubble({ msg }: { msg: Message }) {
  const { state } = useDiscussion()

  if (msg.role === 'system') {
    return (
      <div className="msg-enter flex justify-center my-4">
        <div
          className="px-4 py-2 rounded-full text-[11px] font-500"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          <i className="fas fa-flag mr-1"></i>
          {msg.content}
        </div>
      </div>
    )
  }

  if (msg.role === 'user') {
    return (
      <div className="msg-enter flex justify-end mb-4">
        <div
          className="max-w-md px-4 py-2.5 rounded-2xl rounded-tr-md text-sm"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {msg.content}
        </div>
      </div>
    )
  }

  const model = state.models.find(m => m.id === msg.modelId)
  const modelColor = model?.color || 'var(--accent)'
  const modelIcon = model?.icon || 'fa-robot'
  const modelName = model?.name || msg.modelName || 'Unknown'

  const contentHtml = msg.thinking
    ? escapeHtml(msg.content) + '<span class="typing-cursor"></span>'
    : renderMarkdown(msg.content)

  return (
    <div className="msg-enter flex gap-3 mb-4">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: `${modelColor}18`, color: modelColor }}
      >
        <i className={`fas ${modelIcon} text-xs`}></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-600" style={{ color: modelColor }}>
            {modelName}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            {msg.round ? `第${msg.round}轮` : ''}
          </span>
          {msg.thinking && (
            <span className="text-[10px] typing-cursor" style={{ color: 'var(--muted)' }}>
              思考中
            </span>
          )}
          <span className="ml-auto">
            {msg.tag && (
              <span
                className={`msg-tag ${msg.tag.label}`}
                title={msg.tag.evidence || ''}
              >
                {TAG_TEXT[msg.tag.label]}
              </span>
            )}
          </span>
        </div>
        <div
          className="px-4 py-2.5 rounded-2xl rounded-tl-md text-sm leading-relaxed"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <span
            className="msg-content"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      </div>
    </div>
  )
}
