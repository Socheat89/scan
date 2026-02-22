import { useEffect, useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, QrCode, X, MapPin, Building2 } from 'lucide-react'
import styles from './Page.module.css'

const EMPTY = { name: '', location: '' }

export default function Branches() {
  const [branches, setBranches] = useState([])
  const [modal, setModal] = useState(null) // null | 'create' | 'edit' | 'qr'
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [qrData, setQrData] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await api.get('/branches')
    setBranches(data)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setForm(EMPTY); setEditId(null); setModal('create') }
  function openEdit(b) { setForm({ name: b.name, location: b.location }); setEditId(b.id); setModal('edit') }

  async function openQR(b) {
    const { data } = await api.get(`/branches/${b.id}/qr`)
    setQrData({ branch: b.name, payload: data.qrPayload })
    setModal('qr')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editId) {
        await api.put(`/branches/${editId}`, form)
        toast.success('Branch updated')
      } else {
        await api.post('/branches', form)
        toast.success('Branch created')
      }
      setModal(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error')
    } finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this branch?')) return
    try {
      await api.delete(`/branches/${id}`)
      toast.success('Branch deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error')
    }
  }

  const qrUrl = qrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData.payload)}`
    : ''

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Branches</h2>
        <button className={styles.btnPrimary} onClick={openCreate}>
          <Plus size={18} /> Add Branch
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Branch Name</th>
              <th>Location</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={16} />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{b.name}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-3)' }}>
                    <MapPin size={14} />
                    {b.location}
                  </div>
                </td>
                <td>{new Date(b.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.iconBtn} onClick={() => openQR(b)} title="View QR"><QrCode size={16} /></button>
                    <button className={styles.iconBtn} onClick={() => openEdit(b)} title="Edit"><Pencil size={16} /></button>
                    <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(b.id)} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr><td colSpan={4} className={styles.empty}>No branches found. Click "Add Branch" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{modal === 'edit' ? 'Edit Branch' : 'Add New Branch'}</h3>
              <button className={styles.closeBtn} onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.field}>
                <label>Branch Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Head Office" />
              </div>
              <div className={styles.field}>
                <label>Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required placeholder="e.g. Phnom Penh" />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>{loading ? 'Saving…' : 'Save Branch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'qr' && qrData && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Branch QR Code</h3>
              <button className={styles.closeBtn} onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <div className={styles.qrWrap}>
              <div style={{ textAlign: 'center', marginBottom: '-1rem' }}>
                <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 0.25rem 0' }}>{qrData.branch}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', margin: 0 }}>Scan to record attendance</p>
              </div>
              <img src={qrUrl} alt="QR Code" className={styles.qrImg} />
              <p className={styles.qrNote}>This QR code rotates daily for security. Regenerate each day or display on a dedicated screen.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
