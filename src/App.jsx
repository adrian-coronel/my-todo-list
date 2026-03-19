import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import AppHeader from './components/AppHeader'
import Sidebar from './components/Sidebar'
import WeeklyCalendar from './components/WeeklyCalendar'
import AuthScreen from './components/AuthScreen'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import './index.css'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '14px' }}>
        Cargando…
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return (
    <AppProvider>
      <div className="app-layout">
        <AppHeader />
        <div className="app-body">
          <Sidebar />
          <main className="main-canvas">
            <WeeklyCalendar />
          </main>
        </div>
      </div>
      <PwaUpdatePrompt />
    </AppProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
