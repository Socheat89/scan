/**
 * Admin-side FaceCapture for face template registration.
 * Same logic as user-frontend FaceCapture — captures a 128D face descriptor
 * from webcam using @vladmandic/face-api (TinyFaceDetector + FaceRecognitionNet).
 * Returns descriptor via onCapture(descriptor[]).
 */

import { useEffect, useRef, useState } from 'react'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
let faceapi = null
let modelsLoaded = false

async function ensureModels() {
  if (modelsLoaded) return
  faceapi = await import('@vladmandic/face-api')
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

export default function FaceCapture({ onCapture, onError, onClose }) {
  const videoRef    = useRef(null)
  const streamRef   = useRef(null)
  const intervalRef = useRef(null)

  const [stage, setStage]       = useState('loading')
  const [statusMsg, setStatus]  = useState('Loading face models…')
  const [faceFound, setFaceFound] = useState(false)

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        await ensureModels()
        if (!mounted) return
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStage('ready')
        setStatus('Position face in frame and click Capture')
        // detection loop
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !faceapi) return
          try {
            const det = await faceapi
              .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
              .withFaceLandmarks(true)
            setFaceFound(!!det)
            if (det) setStatus('Face detected — click Capture')
            else setStatus('No face detected — move closer')
          } catch { /* ignore */ }
        }, 400)
      } catch (err) {
        if (!mounted) return
        const msg = err.name === 'NotAllowedError' ? 'Camera permission denied.' : err.message
        setStage('error')
        setStatus(msg)
        onError?.(msg)
      }
    }
    init()
    return () => {
      mounted = false
      clearInterval(intervalRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function handleCapture() {
    if (!videoRef.current || !faceapi) return
    setStage('capturing')
    setStatus('Extracting face template…')
    clearInterval(intervalRef.current)
    try {
      const det = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor()
      if (!det) {
        setStage('ready')
        setStatus('No face found — try again')
        return
      }
      const descriptor = Array.from(det.descriptor)
      setStage('done')
      setStatus('Face template captured ✓')
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(descriptor)
    } catch (err) {
      setStage('error')
      setStatus(err.message)
      onError?.(err.message)
    }
  }

  const borderColor = faceFound ? '#22c55e' : '#64748b'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      {stage === 'loading' && (
        <div style={{ padding: '2rem', color: '#64748b', textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.5rem' }} />
          <span style={{ fontSize: '0.875rem' }}>Loading face models (first time may take ~10s)…</span>
        </div>
      )}
      {stage !== 'loading' && stage !== 'done' && (
        <div style={{ position: 'relative', width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${borderColor}`, transition: 'border-color 0.3s', background: '#000' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} playsInline muted />
        </div>
      )}
      <p style={{ fontSize: '0.8125rem', color: faceFound ? '#16a34a' : '#64748b', textAlign: 'center' }}>{statusMsg}</p>
      {stage === 'done' && (
        <div style={{ fontSize: '0.875rem', color: '#16a34a', fontWeight: 600, padding: '0.5rem 1rem', background: '#dcfce7', borderRadius: 8 }}>
          ✓ Face template ready — click Save to register
        </div>
      )}
      {!['loading', 'done', 'error'].includes(stage) && (
        <button
          onClick={handleCapture}
          disabled={!faceFound || stage === 'capturing'}
          style={{ padding: '0.5rem 1.5rem', background: faceFound ? '#3b82f6' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: faceFound ? 'pointer' : 'not-allowed' }}
        >
          {stage === 'capturing' ? 'Processing…' : 'Capture'}
        </button>
      )}
      {stage === 'error' && (
        <p style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{statusMsg}</p>
      )}
    </div>
  )
}
