import { db, type Settings, type DayOfWeek } from './index'

const DEFAULT_SETTINGS: Settings = {
  id: 'user-settings',
  baselineCalories: 2000,
  dayOverrides: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export async function getOrCreateSettings(): Promise<Settings> {
  const existing = await db.settings.get('user-settings')
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function updateSettings(
  updates: Partial<Pick<Settings, 'baselineCalories' | 'dayOverrides'>>,
): Promise<void> {
  const current = await getOrCreateSettings()
  await db.settings.put({
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  })
}

/** Remove overrides that equal the baseline (they're effectively "reset"). */
export function cleanOverrides(
  overrides: Partial<Record<DayOfWeek, number>>,
  baseline: number,
): Partial<Record<DayOfWeek, number>> {
  const cleaned: Partial<Record<DayOfWeek, number>> = {}
  for (const [day, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== baseline) {
      cleaned[day as DayOfWeek] = value
    }
  }
  return cleaned
}

export const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Mo' },
  { key: 'tuesday', label: 'Tu' },
  { key: 'wednesday', label: 'We' },
  { key: 'thursday', label: 'Th' },
  { key: 'friday', label: 'Fr' },
  { key: 'saturday', label: 'Sa' },
  { key: 'sunday', label: 'Su' },
]

export function computeWeeklyAverage(
  baseline: number,
  overrides: Partial<Record<DayOfWeek, number>>,
): number {
  const total = DAYS.reduce((sum, { key }) => sum + (overrides[key] ?? baseline), 0)
  return Math.round(total / 7)
}
