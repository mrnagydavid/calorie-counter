import { useState, useMemo, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { formatDate, todayString } from '../db/dates'
import { getTargetsForRange } from '../db/dailyTargets'
import { WeightChart } from '../components/WeightChart'
import { barColor } from '../utils/barColor'
import styles from './History.module.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type HistoryTab = 'calories' | 'weight'

export function History() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [weightYear, setWeightYear] = useState(today.getFullYear())
  const [tab, setTab] = useState<HistoryTab>('calories')

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const isCurrentYear = weightYear === today.getFullYear()

  // Build date range for the month (calories view)
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

  // Backfill runs outside liveQuery (which is read-only).
  // The liveQuery on dailyTargets detects when backfill writes complete and re-triggers.
  const [targets, setTargets] = useState<Map<string, number> | null>(null)
  const storedTargets = useLiveQuery(
    () => days.length > 0
      ? db.dailyTargets.where('date').between(days[days.length - 1], days[0], true, true).toArray()
      : [],
    [days],
  )
  useEffect(() => {
    if (!settings || !storedTargets) return
    getTargetsForRange(days, settings).then(setTargets)
  }, [settings, storedTargets, days])

  const dayData = useMemo(() => {
    if (!settings || !intakes || !burns || !targets) return null

    const intakeByDate = new Map<string, number>()
    for (const e of intakes) {
      intakeByDate.set(e.date, (intakeByDate.get(e.date) || 0) + e.calories)
    }

    const burnByDate = new Map<string, number>()
    for (const e of burns) {
      burnByDate.set(e.date, (burnByDate.get(e.date) || 0) + e.calories)
    }

    return days.map((dateStr) => {
      const baseTarget = targets.get(dateStr) ?? settings.baselineCalories
      const burned = burnByDate.get(dateStr) || 0
      const target = baseTarget + burned
      const consumed = intakeByDate.get(dateStr) || 0
      const hasEntries = intakeByDate.has(dateStr) || burnByDate.has(dateStr)
      const d = new Date(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10))

      return { dateStr, dayNum: d.getDate(), dayName: DAY_NAMES[d.getDay()], consumed, target, burned, hasEntries }
    })
  }, [settings, intakes, burns, targets, days])

  // Weight entries for the selected year (weight view)
  const weightEntries = useLiveQuery(
    () =>
      db.weightEntries
        .where('date')
        .between(`${weightYear}-01-01`, `${weightYear}-12-31`, true, true)
        .reverse()
        .sortBy('date'),
    [weightYear],
  )

  // Deduplicate weight entries: keep latest per day, sorted newest first
  const weightList = useMemo(() => {
    if (!weightEntries) return null
    const byDate = new Map<string, { date: string; weight: number; createdAt: string }>()
    for (const e of weightEntries) {
      const existing = byDate.get(e.date)
      if (!existing || e.createdAt > existing.createdAt) {
        byDate.set(e.date, { date: e.date, weight: e.weight, createdAt: e.createdAt })
      }
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date))
  }, [weightEntries])

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  const goToNextMonth = () => {
    if (isCurrentMonth) return
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  if (tab === 'calories' && !dayData) return null

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <h1 class={styles.headerTitle}>History</h1>
      </div>

      <div class={styles.tabs}>
        <button
          class={`${styles.tab} ${tab === 'calories' ? styles.tabActive : ''}`}
          onClick={() => setTab('calories')}
        >
          Calories
        </button>
        <button
          class={`${styles.tab} ${tab === 'weight' ? styles.tabActive : ''}`}
          onClick={() => setTab('weight')}
        >
          Weight
        </button>
      </div>

      {tab === 'calories' ? (
        <>
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
            {(() => {
              const barScale = Math.max(
                ...dayData!.map((d) => d.consumed),
                ...dayData!.map((d) => d.target),
                1,
              )
              return dayData!.map((day) => {
                const ratio = day.target > 0 ? day.consumed / day.target : 0
                const pct = barScale > 0 ? Math.min((day.consumed / barScale) * 100, 100) : 0
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
                            <span class={styles.calorieNum}>🍔 {day.consumed}</span>
                            <span class={styles.calorieNum}>{ratio < 0.95 ? '☑️' : ratio <= 1.05 ? '✅' : '⚠️'} {day.target}</span>
                            {day.burned > 0 && (
                              <span class={styles.burnedInfo}>(🏃 {day.burned})</span>
                            )}
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
              })
            })()}
          </div>
        </>
      ) : (
        <>
          <div class={styles.monthNav}>
            <button class={styles.monthArrow} onClick={() => setWeightYear(weightYear - 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span class={styles.monthLabel}>{weightYear}</span>
            <button
              class={`${styles.monthArrow} ${isCurrentYear ? styles.disabled : ''}`}
              onClick={() => !isCurrentYear && setWeightYear(weightYear + 1)}
              disabled={isCurrentYear}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <WeightChart year={weightYear} />

          {weightList && weightList.length > 0 && (
            <div class={styles.dayList}>
              {weightList.map((entry) => {
                const d = new Date(+entry.date.slice(0, 4), +entry.date.slice(5, 7) - 1, +entry.date.slice(8, 10))
                const dayNum = d.getDate()
                const monthName = MONTH_NAMES[d.getMonth()].slice(0, 3)

                return (
                  <button
                    key={entry.date}
                    class={styles.dayRow}
                    onClick={() => route(`/?date=${entry.date}`)}
                  >
                    <div class={`${styles.dayInfo} ${styles.dayInfoWeight}`}>
                      <span class={styles.weightMonth}>{monthName}</span>
                      <span class={styles.dayNum}>{dayNum}</span>
                    </div>
                    <div class={styles.dayMiddle}>
                      <div class={styles.dayCalories}>
                        {entry.weight} kg
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
