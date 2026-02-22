import { useAuth } from '../context/AuthContext'
import styles from './Header.module.css'

export default function Header() {
  const { user } = useAuth()
  return (
    <header className={styles.header}>
      <div className={styles.title}>Attendance Management System</div>
      <div className={styles.userInfo}>
        <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase() || 'A'}</div>
        <span className={styles.userName}>{user?.name || 'Admin'}</span>
      </div>
    </header>
  )
}
