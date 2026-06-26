import { useDiscussion } from '../store/DiscussionContext'

export function SettingsPanel() {
  const { state, closeSettings, updateModel, addCustomModel, removeModel, saveSettings } =
    useDiscussion()

  if (!state.settingsOpen) return null

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeSettings}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-lg modal-enter overflow-y-auto"
        style={{ background: 'var(--bg2)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-700">模型配置</h2>
            <button
              onClick={closeSettings}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--card)] transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <i className="fas fa-xmark"></i>
            </button>
          </div>
          <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>
            配置各模型的API端点和密钥。关闭「模拟模式」后，已配置Key的模型将调用真实API。支持所有兼容OpenAI格式的API端点。
          </p>

          <div className="space-y-4">
            {state.models.map((m, idx) => (
              <div
                key={m.id}
                className="p-4 rounded-xl"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${m.color}20`, color: m.color }}
                    >
                      <i className={`fas ${m.icon} text-xs`}></i>
                    </div>
                    <span className="text-sm font-600">{m.name}</span>
                    {m.apiKey ? (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: '#10B98120', color: '#10B981' }}
                      >
                        已配置
                      </span>
                    ) : (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                      >
                        未配置
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={e => updateModel(idx, { enabled: e.target.checked })}
                        className="accent-[var(--accent)]"
                      />
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        启用
                      </span>
                    </label>
                    {m.custom && (
                      <button
                        onClick={() => removeModel(idx)}
                        className="text-xs hover:text-red-400 transition-colors"
                        style={{ color: 'var(--muted)' }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label
                      className="text-[10px] font-500 mb-1 block"
                      style={{ color: 'var(--muted)' }}
                    >
                      API 端点
                    </label>
                    <input
                      type="text"
                      value={m.endpoint}
                      onChange={e => updateModel(idx, { endpoint: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg text-xs input-glow border border-[var(--border)]"
                      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div>
                    <label
                      className="text-[10px] font-500 mb-1 block"
                      style={{ color: 'var(--muted)' }}
                    >
                      模型名称
                    </label>
                    <input
                      type="text"
                      value={m.model}
                      onChange={e => updateModel(idx, { model: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg text-xs input-glow border border-[var(--border)]"
                      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div>
                    <label
                      className="text-[10px] font-500 mb-1 block"
                      style={{ color: 'var(--muted)' }}
                    >
                      API Key
                    </label>
                    <input
                      type="password"
                      value={m.apiKey}
                      onChange={e => updateModel(idx, { apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-1.5 rounded-lg text-xs input-glow border border-[var(--border)]"
                      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div>
                    <label
                      className="text-[10px] font-500 mb-1 block"
                      style={{ color: 'var(--muted)' }}
                    >
                      角色设定 (System Prompt)
                    </label>
                    <textarea
                      rows={2}
                      value={m.systemPrompt}
                      onChange={e => updateModel(idx, { systemPrompt: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg text-xs input-glow border border-[var(--border)] resize-none"
                      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addCustomModel}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-500 border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
            style={{ color: 'var(--muted)' }}
          >
            <i className="fas fa-plus mr-1"></i>添加自定义模型
          </button>

          <div
            className="mt-6 p-3 rounded-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-xs font-600 mb-2" style={{ color: 'var(--accent)' }}>
              <i className="fas fa-circle-info mr-1"></i>CORS 说明
            </h3>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              浏览器直接调用API可能遇到跨域限制。解决方案：1) 使用支持CORS的API代理；2) 在API端点前加代理地址；3) 使用浏览器CORS插件（仅开发用）。国内多数模型API已支持浏览器直接调用。
            </p>
          </div>

          <button
            onClick={saveSettings}
            className="mt-6 w-full py-2.5 rounded-xl text-sm font-600 btn-glow"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  )
}
