import { useEffect, useState } from 'react'
import api from '../utils/api'
import styles from './Page.module.css'
import { Download, Filter, Calendar, User, MapPin, Clock, AlertCircle } from 'lucide-react'

export default function AttendanceReport() {
  const [records, setRecords] = useState([])
  const [branches, setBranches] = useState([])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ date_from: '', date_to: '', user_id: '', branch_id: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/branches'), api.get('/users')]).then(([b, u]) => {
      setBranches(b.data)
      setUsers(u.data)
    })
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const { data } = await api.get('/attendance/report', { params })
      setRecords(data)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  function exportCSV() {
    const headers = ['Date', 'Employee', 'Branch', 'Check In', 'Break Out', 'Break In', 'Check Out', 'Total Hours', 'Late (min)', 'Status']
    const rows = records.map((r) => [
      r.date,
      r.user_name,
      r.branch_name,
      r.check_in || '',
      r.break_out || '',
      r.break_in || '',
      r.check_out || '',
      r.total_hours || '',
      r.late_minutes || '',
      r.status || '',
    ])
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function statusClass(s) {
    if (s === 'present') return styles.present
    if (s === 'late') return styles.late
    if (s === 'absent') return styles.absent
    return ''
  }

  function formatTime(timeStr) {
    if (!timeStr) return '—'
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Attendance Report</h2>
        <button className={styles.btnSecondary} onClick={exportCSV}>
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div className={styles.filters}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-3)' }}>
          <Calendar size={16} />
          <input type="date" className={styles.filterSelect} value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          <span>to</span>
          <input type="date" className={styles.filterSelect} value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-3)' }}>
          <MapPin size={16} />
          <select className={styles.filterSelect} value={filters.branch_id} onChange={(e) => setFilters({ ...filters, branch_id: e.target.value })}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-3)' }}>
          <User size={16} />
          <select className={styles.filterSelect} value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}>
            <option value="">All Employees</option>
            {users.filter((u) => u.role === 'employee').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <button className={styles.btnPrimary} onClick={loadReport} style={{ marginLeft: 'auto' }}>
          <Filter size={16} /> Apply Filters
        </button>
      </div>

      <div className={styles.tableWrap}>
        {loading ? <div className={styles.empty}>Loading report data…</div> : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Branch</th>
                <th>Check In</th>
                <th>Break Out</th>
                <th>Break In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Late</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                        <User size={12} />
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.user_name}</span>
                    </div>
                  </td>
                  <td>{r.branch_name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: r.check_in ? 'var(--text-1)' : 'var(--text-4)' }}>
                      <Clock size={14} />
                      {formatTime(r.check_in)}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-3)' }}>{formatTime(r.break_out)}</td>
                  <td style={{ color: 'var(--text-3)' }}>{formatTime(r.break_in)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: r.check_out ? 'var(--text-1)' : 'var(--text-4)' }}>
                      <Clock size={14} />
                      {formatTime(r.check_out)}
                    </div>
                  </td>
                  <td>
                    {r.total_hours ? (
                      <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.total_hours}h</span>
                    ) : '—'}
                  </td>
                  <td>
                    {r.late_minutes ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--error)' }}>
                        <AlertCircle size={14} />
                        {r.late_minutes}m
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${statusClass(r.status)}`}>
                      {r.status || 'in progress'}
                    </span>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={10} className={styles.empty}>No attendance records found for the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
