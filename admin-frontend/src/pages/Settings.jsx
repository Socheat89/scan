import { useEffect, useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import styles from './Page.module.css'

export default function Settings() {
  const [form, setForm] = useState({ work_start_time: '', work_end_time: '', break_duration: '', grace_period: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/attendance/settings').then(({ data }) => {
      setForm({
        work_start_time: data.work_start_time || '09:00',
        work_end_time: data.work_end_time || '18:00',
        break_duration: data.break_duration || '60',
        grace_period: data.grace_period || '15',
      })
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put('/attendance/settings', form)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Settings</h2>
      </div>
      <div className={styles.settingsCard}>
        <h3 className={styles.settingsSection}>Work Hours Configuration</h3>
        <form onSubmit={handleSubmit} className={styles.settingsGrid}>
          <div className={styles.field}>
            <label>Work Start Time</label>
            <input type="time" value={form.work_start_time} onChange={(e) => setForm({ ...form, work_start_time: e.target.value })} required />
          </div>
          <div className={styles.field}>
            <label>Work End Time</label>
            <input type="time" value={form.work_end_time} onChange={(e) => setForm({ ...form, work_end_time: e.target.value })} required />
          </div>
          <div className={styles.field}>
            <label>Break Duration (minutes)</label>
            <input type="number" min="0" value={form.break_duration} onChange={(e) => setForm({ ...form, break_duration: e.target.value })} required />
          </div>
          <div className={styles.field}>
            <label>Grace Period (minutes)</label>
            <input type="number" min="0" value={form.grace_period} onChange={(e) => setForm({ ...form, grace_period: e.target.value })} required />
          </div>
          <div className={styles.settingsBtnRow}>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>{loading ? 'Saving…' : 'Save Settings'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
