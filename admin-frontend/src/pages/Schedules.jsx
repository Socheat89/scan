import { useEffect, useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, Clock } from 'lucide-react'
import styles from './Page.module.css'

const EMPTY = {
  name: '',
  work_start_time: '',
  lunch_start_time: '',
  lunch_end_time: '',
  work_end_time: '',
}

function fmt(t) {
  if (!t) return '—'
  return t.slice(0, 5) // trim seconds
}

function scheduleLabel(s) {
  return `${s.name} (${fmt(s.work_start_time)}–${fmt(s.work_end_time)})`
}

export default function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    try {
      const res = await api.get('/schedules')
      setSchedules(res.data)
    } catch {
      toast.error('Failed to load schedules')
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() { setForm(EMPTY); setEditId(null); setModal('form') }
  function openEdit(s) {
    setForm({
      name:             s.name,
      work_start_time:  fmt(s.work_start_time),
      lunch_start_time: s.lunch_start_time ? fmt(s.lunch_start_time) : '',
      lunch_end_time:   s.lunch_end_time   ? fmt(s.lunch_end_time)   : '',
      work_end_time:    fmt(s.work_end_time),
    })
    setEditId(s.id)
    setModal('form')
  }

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form }
    if (!payload.lunch_start_time) delete payload.lunch_start_time
    if (!payload.lunch_end_time)   delete payload.lunch_end_time
    try {
      if (editId) {
        await api.put(`/schedules/${editId}`, payload)
        toast.success('Schedule updated')
      } else {
        await api.post('/schedules', payload)
        toast.success('Schedule created')
      }
      setModal(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving schedule')
    } finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this schedule? Employees must not be assigned to it.')) return
    try {
      await api.delete(`/schedules/${id}`)
      toast.success('Schedule deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete')
    }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Work Schedules</h2>
        <button className={styles.btnPrimary} onClick={openCreate}>
          <Plus size={18} /> Add Schedule
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Schedule Name</th>
              <th>Work Start</th>
              <th>Lunch Break</th>
              <th>Work End</th>
              <th>Total (hrs)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => {
              const [sh, sm] = s.work_start_time.split(':').map(Number)
              const [eh, em] = s.work_end_time.split(':').map(Number)
              const grossMins = (eh * 60 + em) - (sh * 60 + sm)
              let lunchMins = 0
              if (s.lunch_start_time && s.lunch_end_time) {
                const [lsh, lsm] = s.lunch_start_time.split(':').map(Number)
                const [leh, lem] = s.lunch_end_time.split(':').map(Number)
                lunchMins = (leh * 60 + lem) - (lsh * 60 + lsm)
              }
              const netHours = ((grossMins - lunchMins) / 60).toFixed(1)

              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Clock size={16} style={{ color: 'var(--text-4, #94a3b8)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</span>
                    </div>
                  </td>
                  <td>{fmt(s.work_start_time)}</td>
                  <td>
                    {s.lunch_start_time && s.lunch_end_time
                      ? `${fmt(s.lunch_start_time)} – ${fmt(s.lunch_end_time)}`
                      : <span style={{ color: '#94a3b8' }}>No break defined</span>}
                  </td>
                  <td>{fmt(s.work_end_time)}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeBlue}`}>{netHours} h</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.iconBtn} onClick={() => openEdit(s)} title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(s.id)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {schedules.length === 0 && (
              <tr><td colSpan={6} className={styles.empty}>No schedules found. Click "Add Schedule" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'form' && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editId ? 'Edit Schedule' : 'Add Work Schedule'}</h3>
              <button className={styles.closeBtn} onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.field}>
                <label>Schedule Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                  placeholder="e.g. Office Shift, Factory Shift"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.field}>
                  <label>Work Start *</label>
                  <input
                    type="time"
                    value={form.work_start_time}
                    onChange={(e) => setField('work_start_time', e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Work End *</label>
                  <input
                    type="time"
                    value={form.work_end_time}
                    onChange={(e) => setField('work_end_time', e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Lunch Start</label>
                  <input
                    type="time"
                    value={form.lunch_start_time}
                    onChange={(e) => setField('lunch_start_time', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>Lunch End</label>
                  <input
                    type="time"
                    value={form.lunch_end_time}
                    onChange={(e) => setField('lunch_end_time', e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
