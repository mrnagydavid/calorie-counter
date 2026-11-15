import type { IntakeEntry } from '../db/index'
import type { NutrientKey } from './nutrients'

/** A nutrient, or the derived unsaturated fat by its row name or its goal name. */
export type SourceKey = NutrientKey | 'unsaturated' | 'unsaturatedFat'

export type SourceEntry = Pick<IntakeEntry, 'name' | 'barcode' | 'date' | 'quantity' | 'unitNutrients' | 'createdAt'>

/** The grams of a nutrient in an entry. Undefined when the entry has no value, as in `sumNutrients`. */
export function entryAmount(entry: SourceEntry, key: SourceKey): number | undefined {
  const n = entry.unitNutrients
  if (!n) return undefined
  if (key === 'unsaturated' || key === 'unsaturatedFat') {
    if (n.fat === undefined || n.saturatedFat === undefined) return undefined
    return Math.max(0, n.fat * entry.quantity - n.saturatedFat * entry.quantity)
  }
  const value = n[key]
  return value === undefined ? undefined : value * entry.quantity
}

const nameKey = (name: string) => name.trim().toLowerCase()

/**
 * Which food an entry is. The same barcode is the same food, also after a rename. Without a
 * barcode, the same name with case ignored. An entry without a barcode joins a barcode food
 * with its name, because a food picked from a list can lose its barcode.
 */
function foodKeyOf(entries: SourceEntry[]): (entry: SourceEntry) => string {
  const barcodeOfName = new Map<string, string>()
  for (const e of entries) {
    if (e.barcode && !barcodeOfName.has(nameKey(e.name))) barcodeOfName.set(nameKey(e.name), e.barcode)
  }
  return (e) => {
    const barcode = e.barcode ?? barcodeOfName.get(nameKey(e.name))
    return barcode ? `barcode:${barcode}` : `name:${nameKey(e.name)}`
  }
}

export interface FoodSource {
  /** The name of the newest entry, so a renamed food shows its new name. */
  name: string
  /** Grams. */
  amount: number
  /** Entries with a value. */
  entries: number
  /** Dates on which the food gave some of the nutrient. */
  days: number
}

/** The foods that gave a nutrient, most first. A food that gave none is not in the list. */
export function foodSources(entries: SourceEntry[], key: SourceKey): FoodSource[] {
  const keyOf = foodKeyOf(entries)
  const foods = new Map<string, FoodSource & { newest: string; dates: Set<string> }>()
  for (const e of entries) {
    const amount = entryAmount(e, key)
    if (amount === undefined) continue
    const id = keyOf(e)
    const food = foods.get(id) ?? { name: e.name, amount: 0, entries: 0, days: 0, newest: e.createdAt, dates: new Set<string>() }
    food.amount += amount
    food.entries += 1
    if (amount > 0) food.dates.add(e.date)
    if (e.createdAt > food.newest) {
      food.newest = e.createdAt
      food.name = e.name
    }
    foods.set(id, food)
  }
  return [...foods.values()]
    .filter((f) => f.amount > 0)
    .map(({ name, amount, entries, dates }) => ({ name, amount, entries, days: dates.size }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
}

/** "29%", or "<1%" for a share that rounds to 0. */
export function shareText(part: number, total: number): string {
  const percent = total > 0 ? (part / total) * 100 : 0
  return percent < 0.5 ? '<1%' : `${Math.round(percent)}%`
}
