import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useEffect, useRef } from 'preact/hooks'
import { createReadVote, readRetailBarcode } from '../utils/barcode'
import type { LiveScannerProps } from './NativeBarcodeScanner'
import styles from './BarcodeScanner.module.css'

// Retail formats only — mirrors SCAN_FORMATS, expressed in html5-qrcode's enum.
const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
]

// ZXing-js accepts a code from a single decoded row, so ask for 3 of the last 5 frames
// (the native scanner needs 2).
const VOTE_WINDOW = 5
const VOTE_NEEDED = 3

/**
 * Live scanner backed by html5-qrcode (ZXing-js). Used on platforms without a usable native
 * BarcodeDetector (notably iOS Safari). html5-qrcode manages its own camera and <video>.
 */
export function Html5QrcodeScanner({ onDetected, onError }: LiveScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const runningRef = useRef(false)
  const scannedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''
    scannedRef.current = false
    const vote = createReadVote(VOTE_WINDOW, VOTE_NEEDED)
    const readerId = `reader-${Date.now()}`
    const el = document.createElement('div')
    el.id = readerId
    container.appendChild(el)

    const scanner = new Html5Qrcode(readerId, { formatsToSupport: FORMATS, verbose: false })
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText, decodedResult) => {
        if (scannedRef.current) return
        // html5-qrcode names formats like "EAN_13"; readRetailBarcode uses BarcodeDetector names.
        const format = decodedResult.result.format?.formatName.toLowerCase() ?? ''
        const accepted = vote.add(readRetailBarcode(decodedText, format))
        if (!accepted) return
        scannedRef.current = true
        runningRef.current = false
        scanner.stop().catch(() => {})
        onDetected(accepted)
      },
      // Called for each frame with no code: a vote against the codes in the window.
      () => { vote.add(null) },
    ).then(() => {
      runningRef.current = true
    }).catch((err) => {
      console.error('Camera start failed:', err)
      runningRef.current = false
      onError('Camera not available. Please use manual entry.')
    })

    return () => {
      const s = scannerRef.current
      if (!s) return
      if (runningRef.current) {
        s.stop().catch(() => {}).finally(() => { try { s.clear() } catch { /* ignore */ } })
      } else {
        try { s.clear() } catch { /* ignore */ }
      }
      scannerRef.current = null
      runningRef.current = false
    }
  }, [onDetected, onError])

  return (
    <div class={styles.cameraWrapper}>
      <div ref={containerRef} />
    </div>
  )
}
