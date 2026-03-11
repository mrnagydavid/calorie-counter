import { displayDate, shiftDate, todayString } from '../db/dates'
import styles from './DateNav.module.css'

interface DateNavProps {
  date: string
  onDateChange: (date: string) => void
}

export function DateNav({ date, onDateChange }: DateNavProps) {
  const isToday = date === todayString()

  return (
    <div class={styles.nav}>
      <button class={styles.arrow} onClick={() => onDateChange(shiftDate(date, -1))}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span class={styles.label}>{displayDate(date)}</span>
      <button
        class={styles.arrow}
        onClick={() => onDateChange(shiftDate(date, 1))}
        style={isToday ? { visibility: 'hidden' } : undefined}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  )
}
