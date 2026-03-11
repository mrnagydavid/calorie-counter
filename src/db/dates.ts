import type { DayOfWeek } from './index'

/** Get today as YYYY-MM-DD */
export function todayString(): string {
  return formatDate(new Date())
}

/** Format a Date to YYYY-MM-DD */
export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD to Date (local time) */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Shift a YYYY-MM-DD string by N days */
export function shiftDate(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

/** Format for display: "Today", "Yesterday", or "10 Mar 2026" */
export function displayDate(dateStr: string): string {
  const today = todayString()
  if (dateStr === today) return 'Today'
  if (dateStr === shiftDate(today, -1)) return 'Yesterday'
  const d = parseDate(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

/** Get DayOfWeek key from a YYYY-MM-DD string */
export function getDayOfWeek(dateStr: string): DayOfWeek {
  const d = parseDate(dateStr)
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[d.getDay()]
}
