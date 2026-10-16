import { useEffect, useRef, useState } from 'preact/hooks'
import {
  finishLater,
  runMigration,
  type MigrationResult,
  type MigrationStatus,
} from '../services/nutrientMigration'
import { FoodSpinner } from './FoodSpinner'
import styles from './UpdateScreen.module.css'

const LOCAL_LINES = [
  'Teaching your saved foods what fiber is…',
  'Sorting saturated from unsaturated…',
  'Weighing the protein. Twice.',
  "Reading the small print so you don't have to…",
]
const BARCODE_LINES = ['Asking Open Food Facts nicely…', ...LOCAL_LINES]

const LINE_MS = 3000

interface UpdateScreenProps {
  onDone: () => void
}

export function UpdateScreen({ onDone }: UpdateScreenProps) {
  const [status, setStatus] = useState<MigrationStatus>({
    step: 'local',
    localMatched: 0,
    barcodeTotal: 0,
    barcodeDone: 0,
  })
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [lineIdx, setLineIdx] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller
    runMigration(setStatus, controller.signal)
      .then((r) => { if (!controller.signal.aborted) setResult(r) })
      .catch((err) => {
        // The version stays unset, so the screen runs again at the next start.
        console.error('Nutrition update failed', err)
        if (!controller.signal.aborted) onDone()
      })
    return () => controller.abort()
  }, [])

  useEffect(() => { setLineIdx(0) }, [status.step])

  useEffect(() => {
    if (result) return
    const timer = setInterval(() => setLineIdx((i) => i + 1), LINE_MS)
    return () => clearInterval(timer)
  }, [result])

  const handleFinishLater = async () => {
    controllerRef.current?.abort()
    await finishLater()
    onDone()
  }

  if (result) {
    return (
      <div class={styles.screen}>
        <span class={styles.emoji}>🎉</span>
        <h1 class={styles.title}>Done. Your foods now know their macros.</h1>
        <p class={styles.text}>
          {result.withData} of {result.total} saved foods have nutrition data.
        </p>
        {result.offline && (
          <p class={styles.note}>You are offline. Barcodes will be checked later.</p>
        )}
        <button class={styles.primaryButton} onClick={onDone}>Continue</button>
      </div>
    )
  }

  const lines = status.step === 'barcodes' ? BARCODE_LINES : LOCAL_LINES
  const { localMatched, barcodeTotal, barcodeDone } = status
  const showBarcodes = status.step === 'barcodes' && barcodeTotal > 0

  return (
    <div class={styles.screen}>
      <FoodSpinner />
      <h1 class={styles.title}>Your foods are reading their labels</h1>
      <p class={styles.text} aria-live="polite">{lines[lineIdx % lines.length]}</p>

      {showBarcodes && (
        <div class={styles.progress}>
          <div class={styles.barTrack}>
            <div class={styles.barFill} style={{ width: `${(barcodeDone / barcodeTotal) * 100}%` }} />
          </div>
          <span class={styles.count}>{barcodeDone} of {barcodeTotal}</span>
        </div>
      )}

      <ul class={styles.checklist}>
        {localMatched > 0 && (
          <li>✓ {localMatched} {localMatched === 1 ? 'food' : 'foods'} matched in the food database</li>
        )}
        {showBarcodes && (
          <li>… Checking {barcodeTotal} {barcodeTotal === 1 ? 'barcode' : 'barcodes'}</li>
        )}
      </ul>

      <button class={styles.secondaryButton} onClick={handleFinishLater}>Finish later</button>
    </div>
  )
}
