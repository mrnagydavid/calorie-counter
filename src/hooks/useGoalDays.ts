import { useMemo } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { shiftDate } from '../db/dates'
import type { DayData } from '../utils/goalProgress'

/**
 * The days from `start` to `end` (inclusive) with their stored rows, intakes and burns.
 * Rows are only read, never filled in: a day without a row has no goals.
 * Null while loading.
 */
export function useGoalDays(start: string, end: string): Map<string, DayData> | null {
  const intakes = useLiveQuery(() => db.intakeEntries.where('date').between(start, end, true, true).toArray(), [start, end])
  const burns = useLiveQuery(() => db.burnEntries.where('date').between(start, end, true, true).toArray(), [start, end])
  const rows = useLiveQuery(() => db.dailyTargets.where('date').between(start, end, true, true).toArray(), [start, end])

  return useMemo(() => {
    if (!intakes || !burns || !rows) return null
    const days = new Map<string, DayData>()
    for (let date = start; date <= end; date = shiftDate(date, 1)) {
      days.set(date, { date, intakes: [], burned: 0 })
    }
    for (const row of rows) {
      const day = days.get(row.date)
      if (day) day.row = row
    }
    for (const e of intakes) days.get(e.date)?.intakes.push(e)
    for (const e of burns) {
      const day = days.get(e.date)
      if (day) day.burned += e.calories
    }
    return days
  }, [intakes, burns, rows, start, end])
}
