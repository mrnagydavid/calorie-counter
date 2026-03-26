import { useState, useEffect, useMemo } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { todayString, formatDate } from '../db/dates'
import { ensureTodayTarget, getTargetForDate, getTargetsForRange } from '../db/dailyTargets'
import { DateNav } from '../components/DateNav'
import { CalorieBudgetBar } from '../components/CalorieBudgetBar'
import { EntryList } from '../components/EntryList'
import { Fab } from '../components/Fab'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { InstallBanner } from '../components/InstallBanner'
import { ExportReminderBanner } from '../components/ExportReminderBanner'
import styles from './Dashboard.module.css'

export function Dashboard() {
  const [date, setDate] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('date') || todayString()
  })

  // Listen for custom event dispatched when "Today" tab is tapped while already on "/"
  useEffect(() => {
    const onReset = () => setDate(todayString())
    window.addEventListener('dashboard:reset-today', onReset)
    return () => window.removeEventListener('dashboard:reset-today', onReset)
  }, [])
  const [scanning, setScanning] = useState(false)

  const settings = useLiveQuery(() => db.settings.get('user-settings'))

  useEffect(() => {
    getOrCreateSettings().then((s) => ensureTodayTarget(s))
  }, [])

  // Read the stored target reactively; backfill runs via useEffect (outside read-only liveQuery)
  const storedTarget = useLiveQuery(
    () => db.dailyTargets.get(date),
    [date],
  )
  const [baseTarget, setBaseTarget] = useState<number | null>(null)
  useEffect(() => {
    if (!settings) return
    if (storedTarget) {
      setBaseTarget(storedTarget.target)
    } else {
      getTargetForDate(date, settings).then((t) => setBaseTarget(t))
    }
  }, [date, settings, storedTarget])

  const intakes = useLiveQuery(() => db.intakeEntries.where('date').equals(date).toArray(), [date])
  const burns = useLiveQuery(() => db.burnEntries.where('date').equals(date).toArray(), [date])

  // Weight entry for this date (latest if multiple)
  const weightEntries = useLiveQuery(
    () => db.weightEntries.where('date').equals(date).toArray(),
    [date],
  )
  const weightEntry = useMemo(() => {
    if (!weightEntries || weightEntries.length === 0) return null
    return weightEntries.reduce((latest, e) =>
      e.createdAt > latest.createdAt ? e : latest
    )
  }, [weightEntries])

  // --- On-track stats (last 7d / 30d) ---
  const past30Days = useMemo(() => {
    const days: string[] = []
    for (let i = 1; i <= 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(formatDate(d))
    }
    return days
  }, [])

  const statsStart = past30Days[past30Days.length - 1]
  const statsEnd = past30Days[0]

  const statsIntakes = useLiveQuery(
    () => db.intakeEntries.where('date').between(statsStart, statsEnd, true, true).toArray(),
    [statsStart, statsEnd],
  )
  const statsBurns = useLiveQuery(
    () => db.burnEntries.where('date').between(statsStart, statsEnd, true, true).toArray(),
    [statsStart, statsEnd],
  )

  const [statsTargets, setStatsTargets] = useState<Map<string, number> | null>(null)

  useEffect(() => {
    if (!settings) return
    getTargetsForRange(past30Days, settings).then(setStatsTargets)
  }, [settings, past30Days])

  const stats = useMemo(() => {
    if (!statsIntakes || !statsBurns || !statsTargets || !settings) return null

    const intakeByDate = new Map<string, number>()
    for (const e of statsIntakes) {
      intakeByDate.set(e.date, (intakeByDate.get(e.date) || 0) + e.calories)
    }
    const burnByDate = new Map<string, number>()
    for (const e of statsBurns) {
      burnByDate.set(e.date, (burnByDate.get(e.date) || 0) + e.calories)
    }

    // Only count days with at least one entry
    const datesWithEntries = new Set([...intakeByDate.keys(), ...burnByDate.keys()])

    const computeAvg = (days: string[]) => {
      let sum = 0
      let count = 0
      for (const d of days) {
        if (!datesWithEntries.has(d)) continue
        const baseTarget = statsTargets.get(d) ?? settings.baselineCalories
        const burned = burnByDate.get(d) || 0
        const target = baseTarget + burned
        const consumed = intakeByDate.get(d) || 0
        sum += consumed - target
        count++
      }
      return count > 0 ? Math.round(sum / count) : null
    }

    return {
      avg7: computeAvg(past30Days.slice(0, 7)),
      avg30: computeAvg(past30Days),
    }
  }, [statsIntakes, statsBurns, statsTargets, settings, past30Days])

  if (!settings || baseTarget == null || !intakes || !burns) return null

  const burned = burns.reduce((sum, e) => sum + e.calories, 0)
  const target = baseTarget + burned
  const consumed = intakes.reduce((sum, e) => sum + e.calories, 0)
  const remaining = target - consumed

  return (
    <div class={styles.page}>
      <InstallBanner />
      <ExportReminderBanner settings={settings} />
      <DateNav date={date} onDateChange={setDate} />

      {date === todayString() && stats && (stats.avg7 != null || stats.avg30 != null) && (
        <div class={styles.statsCard}>
          <div class={styles.statsTitle}>Average daily difference from goal</div>
          {stats.avg7 != null && (
            <div class={styles.statsRow}>
              <span class={styles.statsLabel}>in the last 7 days</span>
              <span class={`${styles.statsLabel} ${stats.avg7 <= 0 ? styles.statsGreen : styles.statsRed}`}>
                {stats.avg7 > 0 ? '+' : ''}{stats.avg7}
              </span>
            </div>
          )}
          {stats.avg30 != null && (
            <div class={styles.statsRow}>
              <span class={styles.statsLabel}>in the last 30 days</span>
              <span class={`${styles.statsLabel} ${stats.avg30 <= 0 ? styles.statsGreen : styles.statsRed}`}>
                {stats.avg30 > 0 ? '+' : ''}{stats.avg30}
              </span>
            </div>
          )}
        </div>
      )}

      <CalorieBudgetBar consumed={consumed} target={target} />
      <EntryList intakes={intakes} burns={burns} weightEntry={weightEntry} />
      <Fab date={date} remaining={remaining} onScanBarcode={() => setScanning(true)} />
      {scanning && (
        <BarcodeScanner date={date} onClose={() => setScanning(false)} />
      )}
    </div>
  )
}
