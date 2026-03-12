import { useState, useMemo } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { formatDate, getDayOfWeek, todayString } from '../db/dates'
import styles from './History.module.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function barColor(ratio: number): string {
  if (ratio >= 1) return 'var(--color-red)'
  if (ratio >= 0.75) return 'var(--color-yellow)'
  return 'var(--color-green)'
}

export function History() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  // Build date range for the month
  const { startDate, endDate, days } = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate()
    const todayStr = todayString()
    const daysInMonth: string[] = []
    for (let d = lastDay; d >= 1; d--) {
      const dateStr = formatDate(new Date(year, month, d))
      if (dateStr <= todayStr) daysInMonth.push(dateStr)
    }
    return {
      startDate: formatDate(new Date(year, month, 1)),
      endDate: formatDate(new Date(year, month, lastDay)),
      days: daysInMonth,
    }
  }, [year, month])

  const settings = useLiveQuery(() => db.settings.get('user-settings'))

  const intakes = useLiveQuery(
    () => db.intakeEntries.where('date').between(startDate, endDate, true, true).toArray(),
    [startDate, endDate],
  )

  const burns = useLiveQuery(
    () => db.burnEntries.where('date').between(startDate, endDate, true, true).toArray(),
    [startDate, endDate],
  )

  const dayData = useMemo(() => {
    if (!settings || !intakes || !burns) return null

    const intakeByDate = new Map<string, number>()
    for (const e of intakes) {
      intakeByDate.set(e.date, (intakeByDate.get(e.date) || 0) + e.calories)
    }

    const burnByDate = new Map<string, number>()
    for (const e of burns) {
      burnByDate.set(e.date, (burnByDate.get(e.date) || 0) + e.calories)
    }

    return days.map((dateStr) => {
      const dow = getDayOfWeek(dateStr)
      const baseTarget = settings.dayOverrides[dow] ?? settings.baselineCalories
      const burned = burnByDate.get(dateStr) || 0
      const target = baseTarget + burned
      const consumed = intakeByDate.get(dateStr) || 0
      const hasEntries = intakeByDate.has(dateStr) || burnByDate.has(dateStr)
      const d = new Date(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10))

      return { dateStr, dayNum: d.getDate(), dayName: DAY_NAMES[d.getDay()], consumed, target, hasEntries }
    })
  }, [settings, intakes, burns, days])

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  const goToNextMonth = () => {
    if (isCurrentMonth) return
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  if (!dayData) return null

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <h1 class={styles.headerTitle}>History</h1>
      </div>

      <div class={styles.monthNav}>
        <button class={styles.monthArrow} onClick={goToPrevMonth}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span class={styles.monthLabel}>{MONTH_NAMES[month]} {year}</span>
        <button
          class={`${styles.monthArrow} ${isCurrentMonth ? styles.disabled : ''}`}
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div class={styles.dayList}>
        {dayData.map((day) => {
          const ratio = day.target > 0 ? day.consumed / day.target : 0
          const pct = Math.min(ratio * 100, 100)
          const color = barColor(ratio)

          return (
            <button
              key={day.dateStr}
              class={`${styles.dayRow} ${!day.hasEntries ? styles.dayRowEmpty : ''}`}
              onClick={() => route(`/?date=${day.dateStr}`)}
            >
              <div class={styles.dayInfo}>
                <span class={styles.dayName}>{day.dayName}</span>
                <span class={styles.dayNum}>{day.dayNum}</span>
              </div>
              <div class={styles.dayMiddle}>
                {day.hasEntries ? (
                  <>
                    <div class={styles.dayCalories}>
                      {day.consumed} <span class={styles.daySeparator}>/</span> {day.target}
                    </div>
                    <div class={styles.miniBarTrack}>
                      <div
                        class={styles.miniBarFill}
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </>
                ) : (
                  <div class={styles.dayCalories}>
                    <span class={styles.dash}>—</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
