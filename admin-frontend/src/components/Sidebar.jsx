import { NavLink } from 'react-router-dom'
import { LayoutDashboard, GitBranch, Users, ClipboardList, Settings, LogOut, CalendarClock, ShieldCheck, FileWarning } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/branches', icon: GitBranch, label: 'Branches' },
  { to: '/employees', icon: Users, label: 'Employees' },
  { to: '/schedules', icon: CalendarClock, label: 'Schedules' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { to: '/security', icon: ShieldCheck, label: 'Security' },
  { to: '/security/logs', icon: FileWarning, label: 'Sec. Logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { logout } = useAuth()
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>A</span>
        <span className={styles.logoText}>AttendAdmin</span>
      </div>
      <nav className={styles.nav}>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button className={styles.logoutBtn} onClick={logout}>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </aside>
  )
}
