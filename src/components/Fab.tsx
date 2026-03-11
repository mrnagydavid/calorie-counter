import { useState } from 'preact/hooks'
import styles from './Fab.module.css'

interface FabProps {
  date: string
}

export function Fab({ date: _date }: FabProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <div class={styles.backdrop} onClick={() => setOpen(false)} />}
      {open && (
        <div class={styles.menu}>
          <button class={styles.menuItem} onClick={() => setOpen(false)}>
            Manual Entry
          </button>
          <button class={styles.menuItem} onClick={() => setOpen(false)}>
            Scan Barcode
          </button>
          <button class={styles.menuItem} onClick={() => setOpen(false)}>
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
