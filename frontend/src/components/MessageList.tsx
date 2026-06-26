import { useEffect, useRef } from 'react'
import { useDiscussion } from '../store/DiscussionContext'
import { MessageBubble } from './MessageBubble'

const SUGGESTED_TOPICS = [
  'AI是否会取代人类创造力？',
  '远程办公是进步还是倒退？',
  '如果可以上传意识，你愿意吗？'
]

export function MessageList() {
  const { state, setInput } = useDiscussion()
  const areaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const area = areaRef.current
    if (area) {
      requestAnimationFrame(() => {
        area.scrollTop = area.scrollHeight
      })
    }
  }, [state.messages])

  if (state.messages.length === 0) {
    return (
      <main className="flex-1 overflow-hidden flex flex-col">
        <div ref={areaRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'var(--accent-dim)' }}
              >
                <i className="fas fa-lightbulb text-3xl text-[var(--accent)]"></i>
              </div>
              <h2 className="font-display text-2xl font-700 mb-2" style={{ color: 'var(--fg)' }}>
                抛出一个话题
              </h2>
              <p className="text-sm max-w-md" style={{ color: 'var(--muted)' }}>
                输入你的想法，邀请多位AI从不同视角展开讨论。他们各自拥有独特的思维风格——有人深度分析，有人天马行空，有人追求落地。
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {SUGGESTED_TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setInput(t)}
                    className="px-3 py-1.5 rounded-full text-xs border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                    style={{ color: 'var(--muted)' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <div ref={areaRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          {state.messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </div>
      </div>
    </main>
  )
}
