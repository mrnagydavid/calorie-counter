import { useState } from 'preact/hooks'
import { route } from 'preact-router'
import styles from './Fab.module.css'

interface FabProps {
  date: string
  onScanBarcode: () => void
}

export function Fab({ date, onScanBarcode }: FabProps) {
  const [open, setOpen] = useState(false)

  const go = (path: string) => {
    setOpen(false)
    route(path)
  }

  return (
    <>
      {open && <div class={styles.backdrop} onClick={() => setOpen(false)} />}
      {open && (
        <div class={styles.menu}>
          <button class={styles.menuItem} onClick={() => go(`/add-intake/${date}`)}>
            Manual Entry
          </button>
          <button class={styles.menuItem} onClick={() => { setOpen(false); onScanBarcode() }}>
            Scan Barcode
          </button>
          <button class={styles.menuItem} onClick={() => go(`/add-burn/${date}`)}>
            Burned Calories
          </button>
        </div>
      )}
      <button
        class={`${styles.fab} ${open ? styles.open : ''}`}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </>
  )
}
