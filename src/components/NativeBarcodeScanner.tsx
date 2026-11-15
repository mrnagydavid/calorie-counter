import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { SCAN_FORMATS } from '../services/barcodeDetector'
import { openScanCamera } from '../services/scanCamera'
import { createReadVote, readRetailBarcode } from '../utils/barcode'
import type { FrameRead, ScanDebugSink } from './scanDebug'
import styles from './BarcodeScanner.module.css'

// Throttle the detect loop to ~9 attempts/sec, paced with a recursive setTimeout (the next
// attempt is scheduled only after the current finishes) so a slow frame can't pile up calls.
const DETECT_INTERVAL_MS = 110

// A code must show up in 2 of the last 5 frames. This adds about 0.1–0.5 s, and it skips the
// blurred frames while the camera focuses.
const VOTE_WINDOW = 5
const VOTE_NEEDED = 2

// Diagnostics: send the camera data again this often, as focus and frame size can change.
const CAMERA_REPORT_MS = 2000

export interface LiveScannerProps {
  /**
   * Called once with a barcode in the stored form that passed the check digit and the frame
   * vote. The camera is already stopped by the time this fires.
   */
  onDetected: (barcode: string) => void
  /** Called if the camera can't be started. */
  onError: (message: string) => void
  /** Diagnostics: receives the camera data and every raw read. The scanner then keeps scanning after a code is accepted. */
  debug?: ScanDebugSink
}

/**
 * Live scanner backed by the platform-native BarcodeDetector. Owns its own camera via
 * getUserMedia + a <video> element, with the back camera that has autofocus (`openScanCamera`),
 * continuous autofocus, higher resolution, and a
 * torch toggle where supported. Used wherever `supportsNativeBarcodeDetector()` is true.
 */
export function NativeBarcodeScanner({ onDetected, onError, debug }: LiveScannerProps) {
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannedRef = useRef(false)
  const runningRef = useRef(false)
  const epochRef = useRef(0)
  const detectingRef = useRef(false)
  const voteRef = useRef(createReadVote(VOTE_WINDOW, VOTE_NEEDED))
  // Self/forward references the detect loop needs, kept in refs so the loop's useCallback can
  // list honest deps without a TDZ and stays stable across renders.
  const detectLoopRef = useRef<(epoch: number) => void>(() => {})
  // Callback props through refs so startCamera/detectLoop stay identity-stable.
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const debugRef = useRef(debug)
  debugRef.current = debug
  const startedAtRef = useRef(0)
  const reportedAtRef = useRef(0)

  // Idempotent teardown: invalidate any in-flight async work (epoch bump), cancel the loop,
  // turn the torch off, release every camera track, and detach the stream from the <video>.
  // Releasing tracks + nulling srcObject is what reliably clears the OS camera indicator.
  const stopCamera = useCallback(() => {
    epochRef.current++
    runningRef.current = false
    detectingRef.current = false
    if (loopTimerRef.current !== null) {
      clearTimeout(loopTimerRef.current)
      loopTimerRef.current = null
    }
    const track = trackRef.current
    if (track) {
      try { track.applyConstraints({ advanced: [{ torch: false }] }) } catch { /* ignore */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    streamRef.current = null
    trackRef.current = null
    setTorchOn(false)
    setTorchSupported(false)
  }, [])

  // Diagnostics: what the camera really delivers. Read again every CAMERA_REPORT_MS.
  const reportCamera = useCallback(async () => {
    const sink = debugRef.current
    const track = trackRef.current
    const video = videoRef.current
    if (!sink || !track || !video) return
    reportedAtRef.current = performance.now()
    let devices: string[] = []
    try {
      devices = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === 'videoinput')
        .map((d) => d.label || '(no label)')
    } catch { /* ignore */ }
    let formats: string[] = []
    try { formats = await BarcodeDetector.getSupportedFormats() } catch { /* ignore */ }
    const rect = video.getBoundingClientRect()
    sink.camera({
      label: track.label,
      settings: { ...track.getSettings() } as Record<string, unknown>,
      capabilities: (track.getCapabilities?.() ?? {}) as Record<string, unknown>,
      devices,
      video: { width: video.videoWidth, height: video.videoHeight },
      view: { width: Math.round(rect.width), height: Math.round(rect.height), dpr: window.devicePixelRatio },
      formats,
    })
  }, [])

  // Self-rescheduling detection loop. `epoch` is captured per start; if a teardown or restart
  // happens, the epoch no longer matches and the loop (or a late-resolving detect()) bails.
  const detectLoop = useCallback(async (epoch: number) => {
    if (epoch !== epochRef.current || !runningRef.current) return

    const video = videoRef.current
    const detector = detectorRef.current
    if (video && detector && !detectingRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
      detectingRef.current = true
      try {
        const detectStart = performance.now()
        const results = await detector.detect(video)
        const detectMs = performance.now() - detectStart
        // Guard: this detect() may have resolved after teardown — do nothing if so.
        if (epoch !== epochRef.current || !runningRef.current) return
        const reads: FrameRead[] = results.map((r) => ({
          raw: r.rawValue,
          format: r.format,
          code: readRetailBarcode(r.rawValue, r.format),
        }))
        const code = reads.find((r) => r.code)?.code ?? null
        const accepted = voteRef.current.add(code)
        const sink = debugRef.current
        if (sink) {
          // Diagnostics: log the frame and keep scanning, also after an accepted code.
          sink.frame({
            t: performance.now() - startedAtRef.current,
            ms: detectMs,
            reads,
            votes: code ? voteRef.current.count(code) : 0,
            accepted,
          })
          if (accepted) voteRef.current.clear()
          if (performance.now() - reportedAtRef.current > CAMERA_REPORT_MS) void reportCamera()
        } else if (accepted) {
          if (scannedRef.current) return
          scannedRef.current = true
          stopCamera()
          onDetectedRef.current(accepted)
          return
        }
      } catch {
        // Transient decode error (e.g. frame not ready) — keep scanning.
      } finally {
        detectingRef.current = false
      }
    }

    // Re-check before rescheduling: a detect() that rejected after teardown reaches here, and
    // we must not leave a stray timer behind once the camera has stopped.
    if (epoch !== epochRef.current || !runningRef.current) return
    loopTimerRef.current = setTimeout(() => { detectLoopRef.current(epoch) }, DETECT_INTERVAL_MS)
  }, [stopCamera, reportCamera])
  detectLoopRef.current = detectLoop

  const startCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    stopCamera()
    scannedRef.current = false
    voteRef.current.clear()
    const myEpoch = ++epochRef.current

    let stream: MediaStream
    try {
      stream = await openScanCamera()
    } catch (err) {
      if (myEpoch !== epochRef.current) return
      console.error('Camera start failed:', err)
      onErrorRef.current('Camera not available. Please use manual entry.')
      return
    }

    // Torn down (closed/unmounted) while awaiting permission — release the orphaned stream.
    if (myEpoch !== epochRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    streamRef.current = stream
    const track = stream.getVideoTracks()[0]
    trackRef.current = track

    video.srcObject = stream
    video.muted = true
    try {
      await video.play()
    } catch {
      // Autoplay can reject if interrupted by teardown — harmless.
    }
    if (myEpoch !== epochRef.current) { stopCamera(); return }

    // Best-effort camera tuning — never throw (focusMode is typically unsupported on iOS).
    try {
      const caps = track.getCapabilities?.() ?? {}
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }) } catch { /* ignore */ }
      }
      setTorchSupported(caps.torch === true)
    } catch {
      setTorchSupported(false)
    }
    if (myEpoch !== epochRef.current) { stopCamera(); return }

    // Construct once and reuse across restarts (holds no camera resource). Some builds reject an
    // unsupported format in the list — fall back to the all-formats detector if so.
    if (!detectorRef.current) {
      try {
        detectorRef.current = new BarcodeDetector({ formats: SCAN_FORMATS })
      } catch {
        detectorRef.current = new BarcodeDetector()
      }
    }

    runningRef.current = true
    detectingRef.current = false
    startedAtRef.current = performance.now()
    void reportCamera()
    loopTimerRef.current = setTimeout(() => { detectLoopRef.current(myEpoch) }, DETECT_INTERVAL_MS)
  }, [stopCamera, reportCamera])

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      // Some devices advertise torch but reject applyConstraints — don't show a broken control.
      setTorchSupported(false)
      setTorchOn(false)
    }
  }, [torchOn])

  useEffect(() => {
    void startCamera()
    return stopCamera
  }, [startCamera, stopCamera])

  return (
    <div class={styles.cameraWrapper}>
      <video ref={videoRef} muted autoplay playsinline />
      {torchSupported && (
        <button
          type="button"
          class={`${styles.torchButton} ${torchOn ? styles.torchOn : ''}`}
          aria-label="Toggle flashlight"
          aria-pressed={torchOn}
          onClick={toggleTorch}
        >
          🔦
        </button>
      )}
    </div>
  )
}
