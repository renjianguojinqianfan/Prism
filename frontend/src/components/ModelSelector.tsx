import { useDiscussion } from '../store/DiscussionContext'
import { PRESET_IDS } from '../config/presetModels'

export function ModelSelector() {
  const { state, toggleModelEnabled } = useDiscussion()
  const list = PRESET_IDS.map(id => state.models.find(m => m.id === id)).filter(Boolean) as NonNullable<
    ReturnType<typeof state.models.find>
  >[]

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
