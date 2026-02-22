import { useEffect, useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Shield, Wifi, ScanFace, MapPin, Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import FaceCapture from '../components/FaceCapture'
import styles from './Page.module.css'

// ── Toggle row ─────────────────────────────────────────────────────────────
function Toggle({ label, description, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <div>
        <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.875rem' }}>{label}</div>
        {description && <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.2rem' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{ flexShrink: 0, width: 44, height: 24, borderRadius: 99, background: checked ? '#3b82f6' : '#cbd5e1', border: 'none', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}
      >
        <span style={{ position: 'absolute', top: 3, left: checked ? 22 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

// ── Section card ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, color = '#3b82f6', children }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          <Icon size={17} />
        </div>
        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9375rem', flex: 1 }}>{title}</span>
        {open ? <ChevronDown size={16} style={{ color: '#94a3b8' }} /> : <ChevronRight size={16} style={{ color: '#94a3b8' }} />}
      </button>
      {open && <div style={{ padding: '0 1.25rem 1.25rem' }}>{children}</div>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SecuritySettings() {
  const [settings, setSettings] = useState({
    anti_gps_spoof_enabled:    'false',
    max_gps_accuracy:          '50',
    face_verification_enabled: 'false',
    face_similarity_threshold: '0.6',
    ip_restriction_enabled:    'false',
  })
  const [savingSettings, setSavingSettings]     = useState(false)

  // IP Whitelist state
  const [branches, setBranches]       = useState([])
  const [ipList,   setIpList]         = useState([])
  const [ipForm,   setIpForm]         = useState({ branch_id: '', ip_address_or_range: '' })
  const [addingIP, setAddingIP]       = useState(false)

  // Face registration state
  const [employees, setEmployees]     = useState([])
  const [faceModal, setFaceModal]     = useState(null)  // employee object | null
  const [pendingDesc, setPendingDesc] = useState(null)  // descriptor array
  const [savingFace, setSavingFace]   = useState(false)

  // Load on mount
  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [s, b, ip, u] = await Promise.all([
        api.get('/security/settings'),
        api.get('/branches'),
        api.get('/security/ip-whitelist'),
        api.get('/users'),
      ])
      setSettings(s.data)
      setBranches(b.data)
      setIpList(ip.data)
      setEmployees(u.data.filter(u => u.role === 'employee'))
    } catch (err) {
      toast.error('Failed to load security data')
    }
  }

  // ── Settings save ────────────────────────────────────────────────────────
  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await api.put('/security/settings', settings)
      toast.success('Security settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving settings')
    } finally { setSavingSettings(false) }
  }

  function setSetting(key, value) {
    setSettings(s => ({ ...s, [key]: String(value) }))
  }

  // ── IP Whitelist ─────────────────────────────────────────────────────────
  async function handleAddIP(e) {
    e.preventDefault()
    setAddingIP(true)
    try {
      await api.post('/security/ip-whitelist', ipForm)
      toast.success('IP added')
      setIpForm(f => ({ ...f, ip_address_or_range: '' }))
      const { data } = await api.get('/security/ip-whitelist')
      setIpList(data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error adding IP')
    } finally { setAddingIP(false) }
  }

  async function handleRemoveIP(id) {
    if (!window.confirm('Remove this IP entry?')) return
    try {
      await api.delete(`/security/ip-whitelist/${id}`)
      setIpList(l => l.filter(r => r.id !== id))
      toast.success('IP removed')
    } catch {
      toast.error('Cannot remove IP')
    }
  }

  // ── Face Registration ────────────────────────────────────────────────────
  function openFaceModal(emp) {
    setPendingDesc(null)
    setFaceModal(emp)
  }

  async function handleSaveFace() {
    if (!pendingDesc || !faceModal) return
    setSavingFace(true)
    try {
      await api.post('/security/face/register', { user_id: faceModal.id, face_embedding: pendingDesc })
      toast.success(`Face registered for ${faceModal.name}`)
      setFaceModal(null)
      setPendingDesc(null)
      const { data } = await api.get('/users')
      setEmployees(data.filter(u => u.role === 'employee'))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Face registration failed')
    } finally { setSavingFace(false) }
  }

  async function handleRemoveFace(emp) {
    if (!window.confirm(`Remove face template for ${emp.name}?`)) return
    try {
      await api.delete(`/security/face/${emp.id}`)
      toast.success('Face template removed')
      const { data } = await api.get('/users')
      setEmployees(data.filter(u => u.role === 'employee'))
    } catch {
      toast.error('Cannot remove face template')
    }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Security Settings</h2>
        <button className={styles.btnPrimary} onClick={handleSaveSettings} disabled={savingSettings}>
          <Shield size={16} />
          {savingSettings ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* ── GPS Anti-Spoof ─────────────────────────────────────────────── */}
      <Section icon={MapPin} title="Anti-GPS Spoofing" color="#f59e0b">
        <Toggle
          label="Enable GPS Spoof Detection"
          description="Reject scans with suspicious GPS data (mock location, impossible jumps, stale timestamps)"
          checked={settings.anti_gps_spoof_enabled === 'true'}
          onChange={v => setSetting('anti_gps_spoof_enabled', v)}
        />
        <div className={styles.field} style={{ marginTop: '0.75rem', maxWidth: 240 }}>
          <label>Max allowed GPS accuracy (metres)</label>
          <input
            type="number" min="10" max="500"
            value={settings.max_gps_accuracy}
            onChange={e => setSetting('max_gps_accuracy', e.target.value)}
          />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Scans with accuracy worse than this value will be rejected (e.g. 50 = within 50m)
          </span>
        </div>
      </Section>

      {/* ── Face Verification ──────────────────────────────────────────── */}
      <Section icon={ScanFace} title="Face Verification" color="#8b5cf6">
        <Toggle
          label="Require Face Verification Before Scan"
          description="Employee must pass face recognition before QR scan is accepted"
          checked={settings.face_verification_enabled === 'true'}
          onChange={v => setSetting('face_verification_enabled', v)}
        />
        <div className={styles.field} style={{ marginTop: '0.75rem', maxWidth: 240 }}>
          <label>Face similarity threshold (0.0 – 1.0)</label>
          <input
            type="number" min="0.3" max="1.0" step="0.05"
            value={settings.face_similarity_threshold}
            onChange={e => setSetting('face_similarity_threshold', e.target.value)}
          />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Lower = stricter match. Recommended: 0.55–0.65 (uses euclidean distance internally)
          </span>
        </div>
      </Section>

      {/* ── IP Restriction ─────────────────────────────────────────────── */}
      <Section icon={Wifi} title="IP Restriction (Per Branch)" color="#10b981">
        <Toggle
          label="Enable IP Whitelist"
          description="Only allow scans from registered IP addresses / CIDR ranges per branch"
          checked={settings.ip_restriction_enabled === 'true'}
          onChange={v => setSetting('ip_restriction_enabled', v)}
        />

        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Allowed IP Entries</p>
          {ipList.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>No IP entries yet. Add one below.</p>
          )}
          {ipList.map(row => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.8125rem' }}>
              <span style={{ flex: 1 }}>
                <strong>{row.ip_address_or_range}</strong>
                <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>→ {row.branch_name}</span>
              </span>
              <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleRemoveIP(row.id)} title="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <form onSubmit={handleAddIP} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={ipForm.branch_id}
              onChange={e => setIpForm(f => ({ ...f, branch_id: e.target.value }))}
              required
              style={{ padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem', background: '#fff' }}
            >
              <option value="">Branch…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input
              value={ipForm.ip_address_or_range}
              onChange={e => setIpForm(f => ({ ...f, ip_address_or_range: e.target.value }))}
              required
              placeholder="192.168.1.10 or 192.168.1.0/24"
              style={{ padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem', flex: 1, minWidth: 200 }}
            />
            <button type="submit" className={styles.btnPrimary} disabled={addingIP}>
              <Plus size={15} /> {addingIP ? '…' : 'Add'}
            </button>
          </form>
        </div>
      </Section>

      {/* ── Face Registration ──────────────────────────────────────────── */}
      <Section icon={ScanFace} title="Employee Face Templates" color="#3b82f6">
        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.75rem' }}>
          Register a face template for each employee. Required when face verification is enabled.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Employee</th><th>Face Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 500 }}>{emp.name}</td>
                  <td>
                    {emp.face_registered
                      ? <span className={`${styles.badge} ${styles.present}`}>Registered</span>
                      : <span className={`${styles.badge} ${styles.absent}`}>No template</span>}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.btnPrimary} style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', gap: '0.3rem' }} onClick={() => openFaceModal(emp)}>
                        <ScanFace size={13} />
                        {emp.face_registered ? 'Re-register' : 'Register Face'}
                      </button>
                      {emp.face_registered && (
                        <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleRemoveFace(emp)} title="Remove face">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={3} className={styles.empty}>No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Face Registration Modal ────────────────────────────────────── */}
      {faceModal && (
        <div className={styles.overlay} onClick={() => setFaceModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Register Face — {faceModal.name}</h3>
              <button className={styles.closeBtn} onClick={() => setFaceModal(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Ask the employee to look directly at the camera. Click <strong>Capture</strong> when their face is detected, then <strong>Save Template</strong>.
              </p>
              {!pendingDesc
                ? <FaceCapture
                    onCapture={desc => setPendingDesc(desc)}
                    onError={msg => toast.error(msg)}
                  />
                : <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: 10, color: '#16a34a', fontWeight: 500 }}>
                    ✓ Face descriptor captured ({pendingDesc.length} values)
                  </div>
              }
              <div className={styles.modalFooter}>
                <button className={styles.btnSecondary} onClick={() => { setPendingDesc(null); setFaceModal(null) }}>Cancel</button>
                <button
                  className={styles.btnPrimary}
                  disabled={!pendingDesc || savingFace}
                  onClick={handleSaveFace}
                >
                  {savingFace ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
