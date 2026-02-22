import { useEffect, useState } from 'react'
import api from '../utils/api'
import styles from './Dashboard.module.css'
import { Users, CheckCircle, Clock, XCircle, Calendar, TrendingUp, Activity } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/attendance/dashboard')
      .then(({ data }) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}>Loading dashboard data…</div>

  const cards = [
    { label: 'Total Employees', value: stats?.total_employees ?? 0, icon: Users, color: 'var(--primary)' },
    { label: 'Present Today', value: stats?.present_today ?? 0, icon: CheckCircle, color: 'var(--success)' },
    { label: 'Late Today', value: stats?.late_today ?? 0, icon: Clock, color: 'var(--warning)' },
    { label: 'Absent Today', value: stats?.absent_today ?? 0, icon: XCircle, color: 'var(--danger)' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Dashboard Overview</h2>
          <p className={styles.date}>
            <Calendar size={16} className={styles.dateIcon} />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn}>
            <Activity size={16} />
            <span>Live View</span>
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={styles.card}>
            <div className={styles.cardContent}>
              <div>
                <div className={styles.label}>{label}</div>
                <div className={styles.value}>{value}</div>
              </div>
              <div className={styles.cardIcon} style={{ background: `${color}15`, color }}>
                <Icon size={24} strokeWidth={2.5} />
              </div>
            </div>
            <div className={styles.cardFooter}>
              <TrendingUp size={14} className={styles.trendIcon} />
              <span>Updated just now</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.chartsSection}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Weekly Attendance</h3>
          <div className={styles.chartPlaceholder}>
            <div className={styles.barContainer}>
              {[65, 80, 45, 90, 75].map((h, i) => (
                <div key={i} className={styles.barWrapper}>
                  <div className={styles.bar} style={{ height: `${h}%` }}></div>
                  <span className={styles.barLabel}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Recent Activity</h3>
          <div className={styles.activityList}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.activityItem}>
                <div className={styles.activityDot}></div>
                <div className={styles.activityContent}>
                  <p className={styles.activityText}>Employee checked in at Main Branch</p>
                  <span className={styles.activityTime}>{i * 15} mins ago</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
