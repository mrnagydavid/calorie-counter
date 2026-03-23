import { useState, useEffect, useMemo } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { todayString } from '../db/dates'
import { ensureTodayTarget, getTargetForDate } from '../db/dailyTargets'
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
      <CalorieBudgetBar consumed={consumed} target={target} />
      <EntryList intakes={intakes} burns={burns} weightEntry={weightEntry} />
      <Fab date={date} remaining={remaining} onScanBarcode={() => setScanning(true)} />
      {scanning && (
        <BarcodeScanner date={date} onClose={() => setScanning(false)} />
      )}
    </div>
  )
}
