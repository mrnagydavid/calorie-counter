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
 * Otherwise, backfills by inheriting from the nearest previous day's target,
 * falling back to current settings if no previous day exists.
 */
export async function getTargetForDate(date: string, settings: Settings): Promise<number> {
  const existing = await db.dailyTargets.get(date)
  if (existing) return existing.target

  // Find the nearest previous day that has a target
  const prev = await db.dailyTargets
    .where('date')
    .below(date)
    .reverse()
    .first()

  const target = prev ? prev.target : targetFromSettings(date, settings)

  // Backfill so we don't re-compute next time
  await db.dailyTargets.put({ date, target })
  return target
}

/**
 * Get targets for a range of dates (for History page).
 * Backfills any missing days lazily.
 */
export async function getTargetsForRange(
  dates: string[],
  settings: Settings,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (dates.length === 0) return result

  // Fetch all existing targets in the range
  const sorted = [...dates].sort()
  const existing = await db.dailyTargets
    .where('date')
    .between(sorted[0], sorted[sorted.length - 1], true, true)
    .toArray()

  const existingMap = new Map(existing.map((t) => [t.date, t.target]))

  // For missing dates, find the nearest previous target (before the range)
  let fallback: number | null = null
  if ([...dates].some((d) => !existingMap.has(d))) {
    const prev = await db.dailyTargets
      .where('date')
      .below(sorted[0])
      .reverse()
      .first()
    fallback = prev ? prev.target : null
  }

  // Process dates in chronological order so each missing day can inherit from the previous
  const toBackfill: { date: string; target: number }[] = []
  const chronological = [...dates].sort()

  for (const date of chronological) {
    if (existingMap.has(date)) {
      const target = existingMap.get(date)!
      result.set(date, target)
      fallback = target
    } else {
      const target = fallback ?? targetFromSettings(date, settings)
      result.set(date, target)
      toBackfill.push({ date, target })
      fallback = target
    }
  }

  // Backfill missing days in one batch
  if (toBackfill.length > 0) {
    await db.dailyTargets.bulkPut(toBackfill)
  }

  return result
}
