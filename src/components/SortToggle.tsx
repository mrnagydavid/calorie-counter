import type { SortMode } from '../utils/sortCustomFoods'
import styles from './SortToggle.module.css'

interface SortToggleProps {
  value: SortMode
  onChange: (mode: SortMode) => void
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div class={styles.sortToggle}>
      <button
        class={`${styles.sortButton} ${value === 'date' ? styles.sortActive : ''}`}
        onClick={() => onChange('date')}
      >
        Date
      </button>
      <button
        class={`${styles.sortButton} ${value === 'name' ? styles.sortActive : ''}`}
        onClick={() => onChange('name')}
      >
        Name
      </button>
    </div>
  )
}
