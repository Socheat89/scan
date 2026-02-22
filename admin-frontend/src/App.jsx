import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Branches from './pages/Branches'
import Employees from './pages/Employees'
import AttendanceReport from './pages/AttendanceReport'
import Settings from './pages/Settings'
import Schedules from './pages/Schedules'
import SecuritySettings from './pages/SecuritySettings'
import SecurityLogs from './pages/SecurityLogs'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="branches" element={<Branches />} />
        <Route path="employees" element={<Employees />} />
        <Route path="schedules" element={<Schedules />} />
        <Route path="attendance" element={<AttendanceReport />} />
        <Route path="settings" element={<Settings />} />
        <Route path="security" element={<SecuritySettings />} />
        <Route path="security/logs" element={<SecurityLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
