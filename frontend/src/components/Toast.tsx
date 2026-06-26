import { useDiscussion } from '../store/DiscussionContext'
import type { ToastType } from '../store/types'

const COLORS: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: '#10B98120', border: '#10B981', color: '#10B981', icon: 'fa-check-circle' },
  error: { bg: '#EF444420', border: '#EF4444', color: '#EF4444', icon: 'fa-exclamation-circle' },
  warning: { bg: '#F59E0B20', border: '#F59E0B', color: '#F59E0B', icon: 'fa-triangle-exclamation' },
  info: { bg: '#06B6D420', border: '#06B6D4', color: '#06B6D4', icon: 'fa-info-circle' }
}

export function Toast() {
  const { state, dismissToast } = useDiscussion()
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {state.toasts.map(t => {
        const c = COLORS[t.type] || COLORS.info
        return (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className="toast-in flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-500 backdrop-blur-md cursor-pointer"
            style={{ background: c.bg, border: `1px solid ${c.border}40`, color: c.color }}
          >
            <i className={`fas ${c.icon}`}></i>
            <span>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
