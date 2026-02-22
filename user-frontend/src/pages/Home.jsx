import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { QrCode, Clock, LogOut, Coffee, LogIn, LogOut as LogOutIcon } from 'lucide-react'
import styles from './Home.module.css'

const SCAN_LABELS = ['Check In', 'Break Out', 'Break In', 'Check Out']
const SCAN_FIELDS = ['check_in', 'break_out', 'break_in', 'check_out']

function RealtimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={styles.clockContainer}>
      <div className={styles.clockTime}>
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className={styles.clockDate}>
        {time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  )
}

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [todayRecord, setTodayRecord] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/attendance/my')
      .then(({ data }) => {
        const today = new Date().toISOString().slice(0, 10)
        const rec = data.find((r) => r.date === today) || null
        setTodayRecord(rec)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const nextScanIndex = todayRecord
    ? SCAN_FIELDS.findIndex((f) => !todayRecord[f])
    : 0
  const allDone = todayRecord && SCAN_FIELDS.every((f) => todayRecord[f])

  let status = 'Not Checked In'
  let statusColor = 'var(--text-3)'
  if (todayRecord) {
    if (todayRecord.check_out) {
      status = 'Checked Out'
      statusColor = 'var(--text-3)'
    } else if (todayRecord.break_out && !todayRecord.break_in) {
      status = 'On Break'
      statusColor = 'var(--warning)'
    } else if (todayRecord.check_in) {
      status = 'Checked In'
      statusColor = 'var(--success)'
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.greeting}>Hello, {user.name.split(' ')[0]}</div>
          <div className={styles.branch}>{user.branch_name || 'No branch assigned'}</div>
        </div>
        <button className={styles.logoutBtn} onClick={logout}>
          <LogOut size={20} />
        </button>
      </div>

      <RealtimeClock />

      <div className={styles.mainSection}>
        <div className={styles.statusBadge} style={{ color: statusColor, borderColor: statusColor, backgroundColor: `${statusColor}15` }}>
          <span className={styles.statusDot} style={{ backgroundColor: statusColor }}></span>
          {status}
        </div>

        {!allDone ? (
          <button className={styles.scanBtn} onClick={() => navigate('/scan')}>
            <div className={styles.scanBtnInner}>
              <QrCode size={48} strokeWidth={1.5} />
              <span>{nextScanIndex >= 0 && nextScanIndex < SCAN_LABELS.length ? SCAN_LABELS[nextScanIndex] : 'Scan QR'}</span>
            </div>
          </button>
        ) : (
          <div className={styles.allDoneBadge}>
            ✅ All scans completed
          </div>
        )}
      </div>

      <div className={styles.summaryCard}>
        <h3 className={styles.summaryTitle}>Today's Summary</h3>
        {loading ? (
          <div className={styles.loadingText}>Loading…</div>
        ) : (
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <LogIn size={18} className={styles.summaryIcon} />
              <div className={styles.summaryDetails}>
                <span className={styles.summaryLabel}>Check In</span>
                <span className={styles.summaryValue}>{todayRecord?.check_in || '--:--'}</span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <Coffee size={18} className={styles.summaryIcon} />
              <div className={styles.summaryDetails}>
                <span className={styles.summaryLabel}>Break</span>
                <span className={styles.summaryValue}>
                  {todayRecord?.break_out ? `${todayRecord.break_out} - ${todayRecord.break_in || '...'}` : '--:--'}
                </span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <LogOutIcon size={18} className={styles.summaryIcon} />
              <div className={styles.summaryDetails}>
                <span className={styles.summaryLabel}>Check Out</span>
                <span className={styles.summaryValue}>{todayRecord?.check_out || '--:--'}</span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <Clock size={18} className={styles.summaryIcon} />
              <div className={styles.summaryDetails}>
                <span className={styles.summaryLabel}>Total Hours</span>
                <span className={styles.summaryValue}>{todayRecord?.total_hours || '0.00'}h</span>
              </div>
            </div>
            {todayRecord?.late_minutes > 0 && (
              <div className={`${styles.summaryItem} ${styles.lateItem}`}>
                <div className={styles.summaryDetails}>
                  <span className={styles.summaryLabel}>Late</span>
                  <span className={styles.summaryValue}>{todayRecord.late_minutes} mins</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
