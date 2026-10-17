import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { todayString } from '../db/dates'
import { latestWeighIn } from '../utils/goals'

export interface LatestWeight {
  weightKg?: number
  /** The date of the weigh-in. Absent when the weight comes from the remembered value. */
  date?: string
}

/** The latest weigh-in up to today, else the weight the calculators remember. */
export function useLatestWeight(fallback?: number): LatestWeight {
  const entries = useLiveQuery(() => db.weightEntries.toArray())
  const latest = latestWeighIn(todayString(), entries ?? [])
  return latest ? { weightKg: latest.weight, date: latest.date } : { weightKg: fallback }
}
