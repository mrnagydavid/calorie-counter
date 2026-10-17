import { db, type DailyTarget, type Settings, type WeightEntry } from './index'
import { getDayOfWeek, todayString } from './dates'
import { activeGoals, usesWeight, weightOn } from '../utils/goals'

/** Compute the base target for a date from settings (baseline + day-of-week override). */
function targetFromSettings(date: string, settings: Settings): number {
  const dow = getDayOfWeek(date)
  return settings.dayOverrides[dow] ?? settings.baselineCalories
}

/**
 * A day's row from the current settings: the calorie target and a copy of the goals that are on.
 * The copy holds rules ("7% of kcal"), not grams, plus the weight for g/kg goals.
 */
function rowFromSettings(date: string, settings: Settings, weights: WeightEntry[]): DailyTarget {
  const row: DailyTarget = { date, target: targetFromSettings(date, settings) }
  const goals = activeGoals(settings.nutrientGoals)
  if (goals) {
    row.nutrientGoals = goals
    if (usesWeight(goals)) {
      const weightKg = weightOn(date, weights, settings.lastWeightKg)
      if (weightKg) row.weightKg = weightKg
    }
  }
  return row
}

/** Weigh-ins on or before a date. Read only when a goal needs the weight. */
async function weightsUntil(date: string, settings: Settings): Promise<WeightEntry[]> {
  return usesWeight(activeGoals(settings.nutrientGoals))
    ? db.weightEntries.where('date').belowOrEqual(date).toArray()
    : []
}

/**
 * Ensure today has a daily target row. Called on app startup (Dashboard mount).
 * If today has no row, compute from settings and write it.
 */
export async function ensureTodayTarget(settings: Settings): Promise<void> {
  const today = todayString()
  const existing = await db.dailyTargets.get(today)
  if (existing) return
  await db.dailyTargets.put(rowFromSettings(today, settings, await weightsUntil(today, settings)))
}

/**
 * When the user changes calorie settings or goals, update today's row to match.
 * Future days don't exist yet and will pick up new settings when created.
 */
export async function updateTodayTarget(settings: Settings): Promise<void> {
  const today = todayString()
  await db.dailyTargets.put(rowFromSettings(today, settings, await weightsUntil(today, settings)))
}

/** After a weigh-in for today changes, give today's g/kg goals the new weight. */
export async function refreshTodayWeight(date: string): Promise<void> {
  if (date !== todayString()) return
  const settings = await db.settings.get('user-settings')
  if (settings && usesWeight(activeGoals(settings.nutrientGoals))) await updateTodayTarget(settings)
}

/**
 * Get the base target for a date. Returns the stored value if it exists.
 * Otherwise, computes from current settings and stores it.
 */
export async function getTargetForDate(date: string, settings: Settings): Promise<number> {
  const existing = await db.dailyTargets.get(date)
  if (existing) return existing.target

  const row = rowFromSettings(date, settings, await weightsUntil(date, settings))
  await db.dailyTargets.put(row)
  return row.target
}

/**
 * Get targets for a range of dates (for History page).
 * Stores computed targets for missing days.
 */
export async function getTargetsForRange(
  dates: string[],
  settings: Settings,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (dates.length === 0) return result

  const sorted = [...dates].sort()
  const existing = await db.dailyTargets
    .where('date')
    .between(sorted[0], sorted[sorted.length - 1], true, true)
    .toArray()

  const existingMap = new Map(existing.map((t) => [t.date, t.target]))

  const missing = dates.filter((date) => !existingMap.has(date))
  const weights = missing.length > 0 ? await weightsUntil(sorted[sorted.length - 1], settings) : []
  const toStore: DailyTarget[] = []

  for (const date of dates) {
    if (existingMap.has(date)) {
      result.set(date, existingMap.get(date)!)
    } else {
      const row = rowFromSettings(date, settings, weights)
      result.set(date, row.target)
      toStore.push(row)
    }
  }

  if (toStore.length > 0) {
    await db.dailyTargets.bulkPut(toStore)
  }

  return result
}
