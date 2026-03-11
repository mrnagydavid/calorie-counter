import { useState, useEffect } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { todayString, getDayOfWeek } from '../db/dates'
import { DateNav } from '../components/DateNav'
import { CalorieBudgetBar } from '../components/CalorieBudgetBar'
import { EntryList } from '../components/EntryList'
import { Fab } from '../components/Fab'
import styles from './Dashboard.module.css'

export function Dashboard() {
  const [date, setDate] = useState(todayString)

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

  return (
    <div class={styles.page}>
      <DateNav date={date} onDateChange={setDate} />
      <CalorieBudgetBar consumed={consumed} target={target} />
      <EntryList intakes={intakes} burns={burns} />
      <Fab date={date} />
    </div>
  )
}
