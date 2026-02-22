import { NavLink } from 'react-router-dom'
import { Home, QrCode, History, User } from 'lucide-react'
import styles from './BottomNav.module.css'

const tabs = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/scan', icon: QrCode, label: 'Scan', isScan: true },
  { to: '/history', icon: History, label: 'History' },
]

export default function BottomNav() {
  return (
    <nav className={styles.nav}>
      {tabs.map(({ to, icon: Icon, label, end, isScan }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => 
            isScan 
              ? styles.scanTab 
              : `${styles.tab} ${isActive ? styles.active : ''}`
          }
        >
          <Icon size={isScan ? 28 : 24} strokeWidth={isScan ? 2 : 2} />
          {!isScan && <span>{label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
