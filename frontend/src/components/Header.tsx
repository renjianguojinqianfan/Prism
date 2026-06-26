import { useDiscussion } from '../store/DiscussionContext'

export function Header() {
  const { exportDiscussion, openSettings } = useDiscussion()
  return (
    <header className="flex-shrink-0 border-b border-[var(--border)] px-4 md:px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-dim)' }}
          >
            <i className="fas fa-comments text-[var(--accent)] text-sm"></i>
          </div>
          <div>
            <h1 className="font-display text-lg font-700 tracking-tight" style={{ color: 'var(--fg)' }}>
              Prism
            </h1>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
              多AI视角碰撞 · 共识/分歧一目了然
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportDiscussion}
            className="px-3 py-1.5 rounded-lg text-xs font-500 border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
            style={{ color: 'var(--muted)' }}
          >
            <i className="fas fa-download mr-1"></i>导出
          </button>
          <button
            onClick={openSettings}
            className="px-3 py-1.5 rounded-lg text-xs font-500 border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
            style={{ color: 'var(--muted)' }}
          >
            <i className="fas fa-gear mr-1"></i>配置模型
          </button>
        </div>
      </div>
    </header>
  )
}
