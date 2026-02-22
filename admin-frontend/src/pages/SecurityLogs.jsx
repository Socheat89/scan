import { useEffect, useState } from 'react'
import api from '../utils/api'
import { MapPin, ScanFace, AlertTriangle, RefreshCw } from 'lucide-react'
import styles from './Page.module.css'

const RISK_STYLE = {
  high:   { badge: styles.absent,  label: 'High' },
  medium: { badge: styles.late,    label: 'Medium' },
  low:    { badge: styles.present, label: 'Low' },
}

const FACE_STYLE = {
  pass:        { badge: styles.present, label: 'Pass' },
  fail:        { badge: styles.absent,  label: 'Fail' },
  no_template: { badge: styles.badgeGray, label: 'No Template' },
}

function dt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SecurityLogs() {
  const [activeTab, setActiveTab]   = useState('gps')
  const [gpsLogs, setGpsLogs]       = useState([])
  const [faceLogs, setFaceLogs]     = useState([])
  const [loadingGps, setLoadingGps] = useState(false)
  const [loadingFace, setLoadingFace] = useState(false)

  // Filters
  const [gpsFilter, setGpsFilter]   = useState({ risk_level: '', user_id: '' })
  const [faceFilter, setFaceFilter] = useState({ status: '', user_id: '' })
  const [employees, setEmployees]   = useState([])

  useEffect(() => {
    api.get('/users').then(({ data }) => setEmployees(data)).catch(() => {})
    loadGpsLogs()
    loadFaceLogs()
  }, [])

  async function loadGpsLogs() {
    setLoadingGps(true)
    try {
      const params = {}
      if (gpsFilter.risk_level) params.risk_level = gpsFilter.risk_level
      if (gpsFilter.user_id)    params.user_id    = gpsFilter.user_id
      const { data } = await api.get('/security/gps-logs', { params })
      setGpsLogs(data)
    } catch { /* */ }
    finally { setLoadingGps(false) }
  }

  async function loadFaceLogs() {
    setLoadingFace(true)
    try {
      const params = {}
      if (faceFilter.status)  params.status  = faceFilter.status
      if (faceFilter.user_id) params.user_id = faceFilter.user_id
      const { data } = await api.get('/security/face-logs', { params })
      setFaceLogs(data)
    } catch { /* */ }
    finally { setLoadingFace(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Security Logs</h2>
        <button className={styles.btnSecondary} onClick={() => { loadGpsLogs(); loadFaceLogs() }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Tab switch */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
        {[
          { key: 'gps',  label: 'GPS Spoof Logs',      icon: MapPin,    count: gpsLogs.length },
          { key: 'face', label: 'Face Verification Logs', icon: ScanFace, count: faceLogs.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? '#3b82f6' : '#64748b',
              borderBottom: `2px solid ${activeTab === tab.key ? '#3b82f6' : 'transparent'}`,
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: '0.875rem',
              marginBottom: -2,
            }}
          >
            <tab.icon size={15} />
            {tab.label}
            <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', borderRadius: 99, padding: '0.1rem 0.5rem' }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* GPS Logs */}
      {activeTab === 'gps' && (
        <>
          <div className={styles.filters} style={{ marginBottom: '1rem' }}>
            <select
              value={gpsFilter.risk_level}
              onChange={e => setGpsFilter(f => ({ ...f, risk_level: e.target.value }))}
            >
              <option value="">All risk levels</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={gpsFilter.user_id}
              onChange={e => setGpsFilter(f => ({ ...f, user_id: e.target.value }))}
            >
              <option value="">All employees</option>
              {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className={styles.btnPrimary} onClick={loadGpsLogs} disabled={loadingGps}>
              {loadingGps ? 'Loading…' : 'Filter'}
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Employee</th>
                  <th>Coordinates</th>
                  <th>Accuracy</th>
                  <th>Mocked?</th>
                  <th>Risk</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {gpsLogs.map(row => {
                  const risk = RISK_STYLE[row.risk_level] || RISK_STYLE.low
                  return (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{dt(row.created_at)}</td>
                      <td style={{ fontWeight: 500 }}>{row.user_name}</td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{row.latitude?.toFixed(5)}, {row.longitude?.toFixed(5)}</td>
                      <td style={{ fontSize: '0.78rem' }}>{row.accuracy != null ? `±${Math.round(row.accuracy)}m` : '—'}</td>
                      <td>
                        {row.is_mocked
                          ? <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.78rem' }}>⚠ YES</span>
                          : <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No</span>}
                      </td>
                      <td><span className={`${styles.badge} ${risk.badge}`}>{risk.label}</span></td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 220 }}>{row.reason || '—'}</td>
                    </tr>
                  )
                })}
                {gpsLogs.length === 0 && !loadingGps && (
                  <tr><td colSpan={7} className={styles.empty}>No GPS security logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Face Logs */}
      {activeTab === 'face' && (
        <>
          <div className={styles.filters} style={{ marginBottom: '1rem' }}>
            <select
              value={faceFilter.status}
              onChange={e => setFaceFilter(f => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="no_template">No Template</option>
            </select>
            <select
              value={faceFilter.user_id}
              onChange={e => setFaceFilter(f => ({ ...f, user_id: e.target.value }))}
            >
              <option value="">All employees</option>
              {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className={styles.btnPrimary} onClick={loadFaceLogs} disabled={loadingFace}>
              {loadingFace ? 'Loading…' : 'Filter'}
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Employee</th>
                  <th>Similarity Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {faceLogs.map(row => {
                  const face = FACE_STYLE[row.status] || FACE_STYLE.fail
                  return (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{dt(row.created_at)}</td>
                      <td style={{ fontWeight: 500 }}>{row.user_name}</td>
                      <td>
                        {row.similarity_score != null
                          ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: 80, height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.round(row.similarity_score * 100)}%`, height: '100%', background: row.similarity_score >= 0.6 ? '#22c55e' : '#ef4444', transition: 'width 0.3s' }} />
                              </div>
                              <span style={{ fontSize: '0.78rem', color: '#475569' }}>{(row.similarity_score * 100).toFixed(0)}%</span>
                            </div>
                          : <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>}
                      </td>
                      <td><span className={`${styles.badge} ${face.badge}`}>{face.label}</span></td>
                    </tr>
                  )
                })}
                {faceLogs.length === 0 && !loadingFace && (
                  <tr><td colSpan={4} className={styles.empty}>No face verification logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
