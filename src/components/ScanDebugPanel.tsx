import { useState } from 'preact/hooks'
import { cameraLines, logText, type ScanDebugLog } from './scanDebug'
import styles from './ScanDebugPanel.module.css'

interface ScanDebugPanelProps {
  log: ScanDebugLog
  /** False when this device uses html5-qrcode, which gives no camera data. */
  native: boolean
}

/** Scanner diagnostics (temporary): camera data and the last raw reads, newest first. */
export function ScanDebugPanel({ log, native }: ScanDebugPanelProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logText(log))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert('Copy failed.')
    }
  }

  if (!native) {
    return <div class={styles.panel}>🐞 Diagnostics need the native scanner. This device uses html5-qrcode.</div>
  }

  const { frames, withRead, avgMs } = log.stats
  return (
    <div class={styles.panel}>
      <div class={styles.note}>🐞 Debug mode: codes are logged, not looked up. Tap 🐞 to turn off.</div>
      <div class={styles.actions}>
        <button type="button" class={styles.button} onClick={copy}>{copied ? 'Copied' : 'Copy log'}</button>
        <button type="button" class={styles.button} onClick={log.clear}>Clear</button>
      </div>
      {log.camera ? cameraLines(log.camera).map((line) => <div key={line}>{line}</div>) : <div>Camera: starting…</div>}
      <div>Frames: {frames} · with a read: {withRead} · detect {Math.round(avgMs)} ms</div>
      <table class={styles.table}>
        <thead>
          <tr><th>t (s)</th><th>raw</th><th>format</th><th>check</th><th>votes</th></tr>
        </thead>
        <tbody>
          {log.rows.map((r, i) => (
            <tr key={i} class={r.accepted ? styles.accepted : r.code ? undefined : styles.failed}>
              <td>{(r.t / 1000).toFixed(1)}</td>
              <td>{r.raw}</td>
              <td>{r.format}</td>
              <td>{r.code ? 'ok' : 'FAIL'}</td>
              <td>{r.votes}{r.accepted ? ' ✅' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
