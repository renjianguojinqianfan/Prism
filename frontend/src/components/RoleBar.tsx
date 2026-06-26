import { useDiscussion } from '../store/DiscussionContext'

export function RoleBar() {
  const { state, toggleModelEnabled } = useDiscussion()
  const enabledModels = state.models.filter(m => m.enabled)
  return (
    <div
      className="flex-shrink-0 border-b border-[var(--border)] px-4 md:px-6 py-2.5"
      style={{ background: 'var(--bg2)' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {enabledModels.map(m => {
            const speaking = state.speakingModelId === m.id
            return (
              <div
                key={m.id}
                className={`role-card flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] flex-shrink-0 ${speaking ? 'active' : ''}`}
                style={{ background: 'var(--card)' }}
                onClick={() => toggleModelEnabled(m.id)}
              >
                <div
                  className={`relative w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${speaking ? 'speaking-pulse' : ''}`}
                  style={{ background: `${m.color}20`, color: m.color }}
                >
                  <i className={`fas ${m.icon} text-[10px]`}></i>
                </div>
                <span className="text-xs font-500 whitespace-nowrap" style={{ color: 'var(--fg)' }}>
                  {m.name}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: m.apiKey ? m.color : 'var(--muted)' }}
                ></span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
