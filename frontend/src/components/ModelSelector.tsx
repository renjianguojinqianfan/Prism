import { useDiscussion } from '../store/DiscussionContext'

export function ModelSelector() {
  const { state, toggleModelEnabled, openSettings } = useDiscussion()
  const list = state.models

  if (list.length === 0) {
    return (
      <div className="mb-2 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          参与模型
        </span>
        <button
          onClick={openSettings}
          className="text-[11px] px-2.5 py-1 rounded-md border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
          style={{ color: 'var(--muted)' }}
        >
          <i className="fas fa-plus mr-1"></i>前往配置模型
        </button>
      </div>
    )
  }

  return (
    <div className="mb-2 flex items-center gap-3 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        参与模型
      </span>
      <div className="flex items-center gap-3 flex-wrap">
        {list.map(m => (
          <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={m.enabled}
              disabled={state.discussionActive}
              onChange={() => toggleModelEnabled(m.id)}
              className="accent-[var(--accent)]"
            />
            <span className="text-[11px]" style={{ color: m.color }}>
              <i className={`fas ${m.icon} mr-1`}></i>
              {m.name}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
