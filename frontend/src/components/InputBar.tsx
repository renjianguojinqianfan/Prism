import { useEffect, useRef } from 'react'
import { useDiscussion } from '../store/DiscussionContext'
import { ModelSelector } from './ModelSelector'

export function InputBar() {
  const {
    state,
    setInput,
    startDiscussion,
    togglePause,
    nextSpeaker,
    resetDiscussion,
    setMaxRounds,
    setSimulate
  } = useDiscussion()
  const taRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  useEffect(() => {
    autoResize()
  }, [state.inputText])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      startDiscussion()
    }
  }

  const enabled = state.models.filter(m => m.enabled)
  const configured = enabled.filter(m => m.apiKey)

  return (
    <footer
      className="flex-shrink-0 border-t border-[var(--border)] px-4 md:px-6 py-3"
      style={{ background: 'var(--bg2)' }}
    >
      <div className="max-w-6xl mx-auto">
        {state.discussionActive && (
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] uppercase tracking-widest mr-1"
              style={{ color: 'var(--muted)' }}
            >
              讨论控制
            </span>
            <button
              onClick={togglePause}
              className="px-2.5 py-1 rounded-md text-[11px] font-500 border transition-all"
              style={{
                color: state.discussionPaused ? 'var(--accent)' : 'var(--muted)',
                borderColor: state.discussionPaused ? 'var(--accent)' : 'var(--border)'
              }}
            >
              <i className={`fas ${state.discussionPaused ? 'fa-play' : 'fa-pause'} mr-1`}></i>
              {state.discussionPaused ? '继续' : '暂停'}
            </button>
            <button
              onClick={nextSpeaker}
              className="px-2.5 py-1 rounded-md text-[11px] font-500 border border-[var(--border)] hover:border-[var(--accent)] transition-all"
              style={{ color: 'var(--muted)' }}
            >
              <i className="fas fa-forward mr-1"></i>跳过
            </button>
            <button
              onClick={resetDiscussion}
              className="px-2.5 py-1 rounded-md text-[11px] font-500 border border-[var(--border)] hover:border-red-500 hover:text-red-400 transition-all"
              style={{ color: 'var(--muted)' }}
            >
              <i className="fas fa-rotate-right mr-1"></i>重置
            </button>
            <span className="ml-auto text-[11px]" style={{ color: 'var(--muted)' }}>
              {state.discussionActive
                ? `第 ${state.currentRound} / ${state.maxRounds} 轮`
                : ''}
            </span>
          </div>
        )}

        <ModelSelector />

        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={taRef}
              rows={1}
              value={state.inputText}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="提出话题或插话引导讨论..."
              className="w-full px-4 py-2.5 rounded-xl text-sm resize-none input-glow border border-[var(--border)] placeholder-[var(--muted)]"
              style={{ background: 'var(--card)', color: 'var(--fg)', maxHeight: 120 }}
            />
          </div>
          <button
            onClick={startDiscussion}
            className="btn-glow px-5 py-2.5 rounded-xl text-sm font-600 flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            <i className={`fas ${state.discussionActive ? 'fa-comment' : 'fa-paper-plane'} mr-1`}></i>
            {state.discussionActive ? '插话' : '发起'}
          </button>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="number"
              value={state.maxRounds}
              min={1}
              max={10}
              onChange={e => setMaxRounds(parseInt(e.target.value) || 2)}
              className="w-12 px-2 py-1 rounded-md text-xs text-center input-glow border border-[var(--border)]"
              style={{ background: 'var(--card)', color: 'var(--fg)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              轮次
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={state.simulate}
              onChange={e => setSimulate(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              模拟模式（无需API Key）
            </span>
          </label>
          <span className="ml-auto text-[11px]" style={{ color: 'var(--muted)' }}>
            {state.simulate ? (
              <span style={{ color: 'var(--accent)' }}>
                <i className="fas fa-flask mr-1"></i>模拟模式 · {enabled.length}位参与者
              </span>
            ) : (
              <span style={{ color: configured.length === enabled.length ? '#10B981' : 'var(--accent)' }}>
                {configured.length}/{enabled.length} 模型已配置Key
              </span>
            )}
          </span>
        </div>
      </div>
    </footer>
  )
}
