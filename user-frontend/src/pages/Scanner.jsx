import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../utils/api'
import FaceCapture from '../components/FaceCapture'
import { X, Flashlight, CheckCircle2, XCircle, Loader2, MapPin, ScanFace } from 'lucide-react'
import styles from './Scanner.module.css'

export default function Scanner() {
  const navigate = useNavigate()

  // Security config fetched on mount
  const [secSettings, setSecSettings] = useState(null)

  // Current scan step: 'loading' | 'face' | 'scanning' | 'processing' | 'success' | 'error'
  const [step, setStep]         = useState('loading')
  const [message, setMessage]   = useState('')
  const [flashOn, setFlashOn]   = useState(false)

  // Collected security data
  const locationRef       = useRef(null)  // latest GPS coords
  const faceDescriptorRef = useRef(null)  // 128D float array
  const geoWatchId        = useRef(null)

  const html5QrRef = useRef(null)

  // ── 1. Load security settings + start GPS watch ────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { data } = await api.get('/security/client-settings')
        setSecSettings(data)

        // Start GPS watch (always — even if spoof check is off, we collect passively)
        if (navigator.geolocation) {
          geoWatchId.current = navigator.geolocation.watchPosition(
            (pos) => {
              const c = pos.coords
              locationRef.current = {
                latitude:  c.latitude,
                longitude: c.longitude,
                accuracy:  c.accuracy,
                altitude:  c.altitude,
                speed:     c.speed,
                heading:   c.heading,
                timestamp: pos.timestamp,
                // isMocked is non-standard but present on some Android devices
                isMocked: c.isMocked ?? false,
              }
            },
            (err) => console.warn('GPS unavailable:', err.message),
            { enableHighAccuracy: true, maximumAge: 10_000 }
          )
        }

        // Decide first step
        setStep(data.face_verification_enabled ? 'face' : 'scanning')
      } catch {
        // Fallback: proceed without security settings
        setSecSettings({ face_verification_enabled: false, anti_gps_spoof_enabled: false })
        setStep('scanning')
      }
    }
    init()
    return () => {
      navigator.geolocation?.clearWatch(geoWatchId.current)
      if (html5QrRef.current) html5QrRef.current.stop().catch(() => {})
    }
  }, [])

  // ── 2. Start QR scanner when step becomes 'scanning' ──────────────────
  useEffect(() => {
    if (step === 'scanning') startQRScan()
  }, [step])

  async function startQRScan() {
    const scanner = new Html5Qrcode('qr-reader')
    html5QrRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (step === 'processing') return
          setStep('processing')
          await scanner.stop()
          html5QrRef.current = null
          await submitScan(decodedText)
        },
        () => {}
      )
    } catch (err) {
      setMessage('Cannot access camera. Please allow camera permission.')
      setStep('error')
    }
  }

  // ── 3. Submit to backend ───────────────────────────────────────────────
  async function submitScan(qr_payload) {
    try {
      const payload = {
        qr_payload,
        location:        locationRef.current,
        face_descriptor: faceDescriptorRef.current,
      }
      const { data } = await api.post('/attendance/scan', payload)
      setMessage(data.message || 'Scan recorded successfully!')
      setStep('success')
      setTimeout(() => navigate('/'), 2500)
    } catch (err) {
      setMessage(err.response?.data?.message || 'Scan failed. Please try again.')
      setStep('error')
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleStop() {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {})
      html5QrRef.current = null
    }
    navigate('/')
  }

  function handleFaceCaptured(descriptor) {
    faceDescriptorRef.current = descriptor
    setStep('scanning')
  }

  function handleFaceError(msg) {
    setMessage(msg || 'Face capture failed')
    setStep('error')
  }

  async function toggleFlash() {
    if (!html5QrRef.current) return
    try {
      const track = html5QrRef.current.getRunningTrackCameraCapabilities()
      if (track?.torchFeature().isSupported()) {
        await html5QrRef.current.applyVideoConstraints({ advanced: [{ torch: !flashOn }] })
        setFlashOn(!flashOn)
      }
    } catch { /* flash not supported */ }
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.statusOverlay}>
          <div className={styles.statusCard}>
            <Loader2 size={48} className={styles.spinner} />
            <p>Initialising security checks…</p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'face') {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className={styles.iconBtn} onClick={handleStop}><X size={24} /></button>
          <h2 className={styles.title}>Face Verification</h2>
          <div style={{ width: 44 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.5rem', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', justifyContent: 'center' }}>
            <ScanFace size={16} />
            <span>Step 1 of 2 — Verify your face before scanning</span>
          </div>
          <FaceCapture onCapture={handleFaceCaptured} onError={handleFaceError} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.iconBtn} onClick={handleStop}><X size={24} /></button>
        <h2 className={styles.title}>
          {secSettings?.face_verification_enabled ? 'Step 2 – Scan QR' : 'Scan QR'}
        </h2>
        <button className={`${styles.iconBtn} ${flashOn ? styles.flashActive : ''}`} onClick={toggleFlash}>
          <Flashlight size={24} />
        </button>
      </div>

      {/* GPS indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 1rem', color: locationRef.current ? '#4ade80' : 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
        <MapPin size={13} />
        <span>{locationRef.current ? `GPS: ±${Math.round(locationRef.current.accuracy ?? 999)}m` : 'Acquiring GPS…'}</span>
      </div>

      <div className={styles.scannerContainer}>
        <div id="qr-reader" className={styles.reader} />
        {step === 'scanning' && (
          <div className={styles.overlay}>
            <div className={styles.frame}>
              <div className={styles.cornerTopLeft}></div>
              <div className={styles.cornerTopRight}></div>
              <div className={styles.cornerBottomLeft}></div>
              <div className={styles.cornerBottomRight}></div>
            </div>
            <p className={styles.instruction}>Align QR code within the frame</p>
          </div>
        )}
      </div>

      {step === 'processing' && (
        <div className={styles.statusOverlay}>
          <div className={styles.statusCard}>
            <Loader2 size={48} className={styles.spinner} />
            <p>Processing scan…</p>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className={styles.statusOverlay}>
          <div className={`${styles.statusCard} ${styles.successCard}`}>
            <CheckCircle2 size={64} color="var(--success)" />
            <p>{message}</p>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className={styles.statusOverlay}>
          <div className={`${styles.statusCard} ${styles.errorCard}`}>
            <XCircle size={64} color="var(--danger)" />
            <p>{message}</p>
            <button
              className={styles.retryBtn}
              onClick={() => { setStep('loading'); setMessage(''); window.location.reload() }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

