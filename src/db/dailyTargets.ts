import { db, type Settings } from './index'
import { getDayOfWeek, todayString } from './dates'

/** Compute the base target for a date from settings (baseline + day-of-week override). */
function targetFromSettings(date: string, settings: Settings): number {
  const dow = getDayOfWeek(date)
  return settings.dayOverrides[dow] ?? settings.baselineCalories
}

/**
 * Ensure today has a daily target row. Called on app startup (Dashboard mount).
 * If today has no row, compute from settings and write it.
 */
export async function ensureTodayTarget(settings: Settings): Promise<void> {
  const today = todayString()
  const existing = await db.dailyTargets.get(today)
  if (existing) return
  await db.dailyTargets.put({ date: today, target: targetFromSettings(today, settings) })
}

/**
 * When the user changes calorie settings, update today's target to match.
 * Future days don't exist yet and will pick up new settings when created.
 */
export async function updateTodayTarget(settings: Settings): Promise<void> {
  const today = todayString()
  await db.dailyTargets.put({ date: today, target: targetFromSettings(today, settings) })
}

/**
 * Get the base target for a date. Returns the stored value if it exists.
 * Otherwise, computes from current settings and stores it.
 */
export async function getTargetForDate(date: string, settings: Settings): Promise<number> {
  const existing = await db.dailyTargets.get(date)
  if (existing) return existing.target

  const target = targetFromSettings(date, settings)
  await db.dailyTargets.put({ date, target })
  return target
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

  const toStore: { date: string; target: number }[] = []

  for (const date of dates) {
    if (existingMap.has(date)) {
      result.set(date, existingMap.get(date)!)
    } else {
      const target = targetFromSettings(date, settings)
      result.set(date, target)
      toStore.push({ date, target })
    }
  }

  if (toStore.length > 0) {
    await db.dailyTargets.bulkPut(toStore)
  }

  return result
}
