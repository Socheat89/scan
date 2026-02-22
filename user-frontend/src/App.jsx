import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Home from './pages/Home'
import Scanner from './pages/Scanner'
import History from './pages/History'
import styles from './App.module.css'

function AppShell({ children }) {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>{children}</div>
      <BottomNav />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <AppShell>{children}</AppShell>
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/scan" element={<PrivateRoute><Scanner /></PrivateRoute>} />
      <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
