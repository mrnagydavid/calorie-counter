import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { todayString, getDayOfWeek } from '../db/dates'
import { DateNav } from '../components/DateNav'
import { CalorieBudgetBar } from '../components/CalorieBudgetBar'
import { EntryList } from '../components/EntryList'
import { Fab } from '../components/Fab'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { InstallBanner } from '../components/InstallBanner'
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

  useEffect(() => {
    getOrCreateSettings()
  }, [])

  const settings = useLiveQuery(() => db.settings.get('user-settings'))
  const intakes = useLiveQuery(() => db.intakeEntries.where('date').equals(date).toArray(), [date])
  const burns = useLiveQuery(() => db.burnEntries.where('date').equals(date).toArray(), [date])

  if (!settings || !intakes || !burns) return null

  const dayOfWeek = getDayOfWeek(date)
  const baseTarget = settings.dayOverrides[dayOfWeek] ?? settings.baselineCalories
  const burned = burns.reduce((sum, e) => sum + e.calories, 0)
  const target = baseTarget + burned
  const consumed = intakes.reduce((sum, e) => sum + e.calories, 0)
  const remaining = target - consumed

  return (
    <div class={styles.page}>
      <InstallBanner />
      <DateNav date={date} onDateChange={setDate} />
      <CalorieBudgetBar consumed={consumed} target={target} />
      <button class={styles.plannerButton} onClick={() => route(`/planner/${date}`)}>
        Plan a meal{remaining > 0 ? ` — ${remaining} remaining` : ''}
      </button>
      <EntryList intakes={intakes} burns={burns} />
      <Fab date={date} onScanBarcode={() => setScanning(true)} />
      {scanning && (
        <BarcodeScanner date={date} onClose={() => setScanning(false)} />
      )}
    </div>
  )
}
