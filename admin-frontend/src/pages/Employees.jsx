import { useEffect, useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, User, Mail, Shield, MapPin, Clock, DollarSign } from 'lucide-react'
import styles from './Page.module.css'

const EMPTY = { name: '', email: '', password: '', role: 'employee', branch_id: '', schedule_id: '', monthly_salary: '' }

function fmtTime(t) { return t ? t.slice(0, 5) : '' }

export default function Employees() {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [schedules, setSchedules] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const [u, b, s] = await Promise.all([
      api.get('/users'),
      api.get('/branches'),
      api.get('/schedules'),
    ])
    setUsers(u.data)
    setBranches(b.data)
    setSchedules(s.data)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setForm(EMPTY); setEditId(null); setModal('form') }
  function openEdit(u) {
    setForm({
      name:           u.name,
      email:          u.email,
      password:       '',
      role:           u.role,
      branch_id:      u.branch_id  || '',
      schedule_id:    u.schedule_id || '',
      monthly_salary: u.monthly_salary ?? '',
    })
    setEditId(u.id)
    setModal('form')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form }
    if (editId && !payload.password) delete payload.password
    if (!payload.branch_id)   payload.branch_id   = null
    if (!payload.schedule_id) payload.schedule_id = null
    try {
      if (editId) {
        await api.put(`/users/${editId}`, payload)
        toast.success('Employee updated')
      } else {
        await api.post('/users', payload)
        toast.success('Employee created')
      }
      setModal(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error')
    } finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this employee?')) return
    try {
      await api.delete(`/users/${id}`)
      toast.success('Employee deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete')
    }
  }

  const branchName   = (id) => branches.find((b) => b.id === id)?.name || 'Unassigned'
  const scheduleLabel = (u) => {
    if (!u.schedule_name) return <span style={{ color: '#94a3b8' }}>No schedule</span>
    return `${u.schedule_name} (${fmtTime(u.work_start_time)}–${fmtTime(u.work_end_time)})`
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Employees</h2>
        <button className={styles.btnPrimary} onClick={openCreate}>
          <Plus size={18} /> Add Employee
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Schedule</th>
              <th>Salary</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      <User size={18} />
                    </div>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{u.name}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <Mail size={14} />
                    {u.email}
                  </div>
                </td>
                <td>
                  <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeBlue : styles.badgeGray}`}>
                    <Shield size={12} style={{ marginRight: '4px' }} />
                    {u.role}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569' }}>
                    <MapPin size={14} style={{ color: '#94a3b8' }} />
                    {branchName(u.branch_id)}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.8125rem' }}>
                    <Clock size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    {scheduleLabel(u)}
                  </div>
                </td>
                <td style={{ color: '#475569', fontSize: '0.8125rem' }}>
                  {u.monthly_salary > 0
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><DollarSign size={13} style={{ color: '#94a3b8' }} />{Number(u.monthly_salary).toLocaleString()}</span>
                    : <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.iconBtn} onClick={() => openEdit(u)} title="Edit"><Pencil size={16} /></button>
                    <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(u.id)} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className={styles.empty}>No employees found. Click "Add Employee" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'form' && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editId ? 'Edit Employee' : 'Add New Employee'}</h3>
              <button className={styles.closeBtn} onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>

              {/* Name */}
              <div className={styles.field}>
                <label>Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. John Doe"
                />
              </div>

              {/* Email */}
              <div className={styles.field}>
                <label>Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="e.g. john@company.com"
                />
              </div>

              {/* Password */}
              <div className={styles.field}>
                <label>{editId ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  {...(!editId && { required: true })}
                  placeholder="••••••••"
                />
              </div>

              {/* Role + Branch */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.field}>
                  <label>Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Branch</label>
                  <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Work Schedule (required for employees) */}
              <div className={styles.field}>
                <label>
                  Work Schedule {form.role !== 'admin' && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <select
                  value={form.schedule_id}
                  onChange={(e) => setForm({ ...form, schedule_id: e.target.value })}
                  required={form.role !== 'admin'}
                >
                  <option value="">— Select a schedule —</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({fmtTime(s.work_start_time)}–{fmtTime(s.work_end_time)})
                    </option>
                  ))}
                </select>
                {schedules.length === 0 && (
                  <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>
                    No schedules available. Please create one in Work Schedules first.
                  </span>
                )}
              </div>

              {/* Monthly Salary */}
              <div className={styles.field}>
                <label>Monthly Salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_salary}
                  onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })}
                  placeholder="e.g. 5000"
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? 'Saving…' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

