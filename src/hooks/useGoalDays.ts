import { useMemo } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { shiftDate } from '../db/dates'
import type { DayData } from '../utils/goalProgress'

/**
 * The days from `start` to `end` (inclusive) with their stored rows and intakes.
 * Rows are only read, never filled in: a day without a row has no goals.
 * Null while loading.
 */
export function useGoalDays(start: string, end: string): Map<string, DayData> | null {
  const intakes = useLiveQuery(() => db.intakeEntries.where('date').between(start, end, true, true).toArray(), [start, end])
  const rows = useLiveQuery(() => db.dailyTargets.where('date').between(start, end, true, true).toArray(), [start, end])

  return useMemo(() => {
    if (!intakes || !rows) return null
    const days = new Map<string, DayData>()
    for (let date = start; date <= end; date = shiftDate(date, 1)) {
      days.set(date, { date, intakes: [] })
    }
    for (const row of rows) {
      const day = days.get(row.date)
      if (day) day.row = row
    }
    for (const e of intakes) days.get(e.date)?.intakes.push(e)
    return days
  }, [intakes, rows, start, end])
}
