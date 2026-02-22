/**
 * FaceCapture.jsx
 * Uses @vladmandic/face-api (browser build) to:
 *   - Load TinyFaceDetector + FaceLandmark68Tiny + FaceRecognition models
 *   - Stream webcam video
 *   - Detect face in real-time
 *   - Extract 128D descriptor on "Capture" click
 *   - Return descriptor array to parent via onCapture(descriptor[])
 *
 * Models are loaded from jsDelivr CDN.
 * For offline PWA, copy model files to /public/models and set MODEL_URL = '/models'.
 */

import { useEffect, useRef, useState } from 'react'
import styles from './FaceCapture.module.css'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

let faceapi = null     // loaded lazily
let modelsLoaded = false

async function ensureModels() {
  if (modelsLoaded) return
  // Dynamic import keeps face-api.js out of the main bundle
  faceapi = await import('@vladmandic/face-api')
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

export default function FaceCapture({ onCapture, onError }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const intervalRef = useRef(null)

  const [stage, setStage]         = useState('loading')  // loading | ready | detected | capturing | done | error
  const [statusMsg, setStatusMsg] = useState('Loading face models…')

  // ── Lifecycle ─────────────────────────────────────────────────────────────
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
        setStatusMsg('Position your face in the circle')
        startDetectionLoop()
      } catch (err) {
        if (!mounted) return
        const msg = err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : `Camera error: ${err.message}`
        setStage('error')
        setStatusMsg(msg)
        onError?.(msg)
      }
    }
    init()
    return () => {
      mounted = false
      stopCamera()
    }
  }, [])

  function stopCamera() {
    clearInterval(intervalRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // ── Continuous detection loop ─────────────────────────────────────────────
  function startDetectionLoop() {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !faceapi) return
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks(true) // tiny variant
        if (detection) {
          drawBox(detection)
          setStage(s => s === 'ready' ? 'detected' : s)
          setStatusMsg('Face detected — press Capture')
        } else {
          clearCanvas()
          setStage(s => s === 'detected' ? 'ready' : s)
          setStatusMsg('Position your face in the circle')
        }
      } catch { /* ignore mid-frame errors */ }
    }, 300)
  }

  function drawBox(detection) {
    const canvas  = canvasRef.current
    const video   = videoRef.current
    if (!canvas || !video) return
    canvas.width  = video.videoWidth  || video.clientWidth
    canvas.height = video.videoHeight || video.clientHeight
    const dims = faceapi.matchDimensions(canvas, { width: canvas.width, height: canvas.height }, true)
    const resized = faceapi.resizeResults(detection, dims)
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawFaceLandmarks(canvas, resized)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  // ── Capture ───────────────────────────────────────────────────────────────
  async function handleCapture() {
    if (!videoRef.current || !faceapi) return
    setStage('capturing')
    setStatusMsg('Verifying face…')
    clearInterval(intervalRef.current)
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor()

      if (!detection) {
        setStage('detected')
        setStatusMsg('No face found — please try again')
        startDetectionLoop()
        return
      }

      const descriptor = Array.from(detection.descriptor)
      setStage('done')
      setStatusMsg('Face captured ✓')
      stopCamera()
      onCapture(descriptor)
    } catch (err) {
      setStage('error')
      setStatusMsg(`Capture failed: ${err.message}`)
      onError?.(err.message)
    }
  }

  const ringClass = ['detected', 'capturing'].includes(stage)
    ? stage === 'capturing' ? styles.capturing : styles.detected
    : ''
  const statusClass = stage === 'done'  ? styles.ok
    : stage === 'error' ? styles.error : ''

  return (
    <div className={styles.container}>
      {stage === 'loading' && (
        <div className={styles.loaderRow}>
          <div className={styles.spinner} />
          <span>Loading face detection models…</span>
        </div>
      )}

      {stage !== 'loading' && (
        <div className={styles.videoWrap}>
          <video ref={videoRef} className={styles.video} playsInline muted />
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.faceRing}>
            <div className={`${styles.ring} ${ringClass}`} />
          </div>
        </div>
      )}

      <p className={`${styles.statusBar} ${statusClass}`}>{statusMsg}</p>

      {!['loading', 'done', 'error'].includes(stage) && (
        <button
          className={styles.captureBtn}
          onClick={handleCapture}
          disabled={stage !== 'detected'}
        >
          {stage === 'capturing' ? 'Verifying…' : 'Capture Face'}
        </button>
      )}
    </div>
  )
}
