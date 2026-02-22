import { useEffect, useState } from 'react'
import api from '../utils/api'
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertCircle } from 'lucide-react'
import styles from './History.module.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function History() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/attendance/my')
      .then(({ data }) => {
        const filtered = data.filter((r) => {
          const d = new Date(r.date)
          return d.getFullYear() === year && d.getMonth() + 1 === month
        })
        setRecords(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year, month])

  function handlePrevMonth() {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  function handleNextMonth() {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'present': return 'var(--success)'
      case 'late': return 'var(--warning)'
      case 'absent': return 'var(--danger)'
      default: return 'var(--text-3)'
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>History</h2>
      </div>

      <div className={styles.monthSelector}>
        <button className={styles.iconBtn} onClick={handlePrevMonth}>
          <ChevronLeft size={20} />
        </button>
        <div className={styles.currentMonth}>
          <Calendar size={18} className={styles.calendarIcon} />
          <span>{MONTHS[month - 1]} {year}</span>
        </div>
        <button className={styles.iconBtn} onClick={handleNextMonth}>
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading records…</div>
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <p>No attendance records found for this month.</p>
        </div>
      ) : (
        <div className={styles.recordList}>
          {records.map((r) => {
            const statusColor = getStatusColor(r.status)
            return (
              <div key={r.id} className={styles.recordCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.dateInfo}>
                    <span className={styles.dayName}>
                      {new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className={styles.dateString}>
                      {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div 
                    className={styles.statusBadge} 
                    style={{ color: statusColor, backgroundColor: `${statusColor}15` }}
                  >
                    {r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'In Progress'}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.timeGrid}>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Check In</span>
                      <span className={styles.timeValue}>{r.check_in || '--:--'}</span>
                    </div>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Check Out</span>
                      <span className={styles.timeValue}>{r.check_out || '--:--'}</span>
                    </div>
                  </div>

                  <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                      <Clock size={14} className={styles.statIcon} />
                      <span>{r.total_hours || '0.00'} hrs</span>
                    </div>
                    {r.late_minutes > 0 && (
                      <div className={`${styles.statItem} ${styles.lateStat}`}>
                        <AlertCircle size={14} className={styles.statIcon} />
                        <span>{r.late_minutes} mins late</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
