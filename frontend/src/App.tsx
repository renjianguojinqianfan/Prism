import { DiscussionProvider } from './store/DiscussionContext'
import { Header } from './components/Header'
import { RoleBar } from './components/RoleBar'
import { MessageList } from './components/MessageList'
import { InputBar } from './components/InputBar'
import { SettingsPanel } from './components/SettingsPanel'
import { Toast } from './components/Toast'
import './App.css'

function App() {
  return (
    <DiscussionProvider>
      <div className="bg-animated">
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="orb-1 absolute w-64 h-64 rounded-full blur-3xl opacity-20"
            style={{ background: 'var(--accent)', top: '10%', left: '5%' }}
          ></div>
          <div
            className="orb-2 absolute w-48 h-48 rounded-full blur-3xl opacity-15"
            style={{ background: '#10B981', bottom: '15%', right: '10%' }}
          ></div>
          <div
            className="orb-1 absolute w-36 h-36 rounded-full blur-3xl opacity-10"
            style={{ background: '#06B6D4', top: '50%', right: '30%', animationDelay: '-4s' }}
          ></div>
        </div>

        <Toast />

        <div className="relative z-10 h-screen flex flex-col">
          <Header />
          <RoleBar />
          <MessageList />
          <InputBar />
        </div>

        <SettingsPanel />
      </div>
    </DiscussionProvider>
  )
}

export default App
