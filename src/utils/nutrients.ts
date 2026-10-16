import type { IntakeEntry, Nutrients } from '../db/index'

export const NUTRIENT_KEYS = [
  'fat',
  'saturatedFat',
  'carbs',
  'sugars',
  'fiber',
  'protein',
  'salt',
] as const

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

export interface NutrientTotal {
  total: number
  count: number // entries that have a value
}

export interface NutrientSums {
  totals: Record<NutrientKey, NutrientTotal>
  unsaturated: NutrientTotal // only entries with both fat and saturated fat
  entryCount: number
}

/** Round to 2 decimals, the storage precision. */
export function roundStored(value: number): number {
  return Math.round(value * 100) / 100
}

/** Round every known field for storage. Unknown fields stay absent. */
export function roundNutrients(n: Nutrients): Nutrients {
  const out: Nutrients = {}
  for (const key of NUTRIENT_KEYS) {
    const value = n[key]
    if (value !== undefined) out[key] = roundStored(value)
  }
  return out
}

/** True when at least one field is known. */
export function hasNutrients(n: Nutrients | undefined): n is Nutrients {
  return !!n && NUTRIENT_KEYS.some((key) => n[key] !== undefined)
}

/** Spread into an entry: sets `unitNutrients` only when a value is known. */
export function entryNutrients(n: Nutrients | undefined): { unitNutrients?: Nutrients } {
  return hasNutrients(n) ? { unitNutrients: n } : {}
}

/**
 * Add up nutrient values. A nutrient is known only when every item has it,
 * because a partial sum would read as too low.
 */
export function sumKnownInAll(list: Nutrients[]): Nutrients {
  const out: Nutrients = {}
  if (list.length === 0) return out
  for (const key of NUTRIENT_KEYS) {
    if (list.every((n) => n[key] !== undefined)) {
      out[key] = list.reduce((sum, n) => sum + (n[key] ?? 0), 0)
    }
  }
  return out
}

/**
 * The kcal guard: a source and a food agree when they differ by 10 kcal or less,
 * or by 10% or less of the larger value.
 */
export function kcalAgrees(a: number, b: number): boolean {
  const diff = Math.abs(a - b)
  return diff <= 10 || diff <= 0.1 * Math.max(a, b)
}

/** Scale per-unit values by a DB quantity. Unknown fields stay absent. */
export function scaleNutrients(n: Nutrients, quantity: number): Nutrients {
  const out: Nutrients = {}
  for (const key of NUTRIENT_KEYS) {
    const value = n[key]
    if (value !== undefined) out[key] = value * quantity
  }
  return out
}

type SummableEntry = Pick<IntakeEntry, 'quantity' | 'unitNutrients'>

/** Sum entries. Each nutrient gets its own count of entries that have a value. */
export function sumNutrients(entries: SummableEntry[]): NutrientSums {
  const totals = {} as Record<NutrientKey, NutrientTotal>
  for (const key of NUTRIENT_KEYS) totals[key] = { total: 0, count: 0 }
  const unsaturated: NutrientTotal = { total: 0, count: 0 }

  for (const entry of entries) {
    const n = entry.unitNutrients
    if (!n) continue
    const scaled = scaleNutrients(n, entry.quantity)
    for (const key of NUTRIENT_KEYS) {
      const value = scaled[key]
      if (value === undefined) continue
      totals[key].total += value
      totals[key].count += 1
    }
    if (scaled.fat !== undefined && scaled.saturatedFat !== undefined) {
      unsaturated.total += Math.max(0, scaled.fat - scaled.saturatedFat)
      unsaturated.count += 1
    }
  }

  return { totals, unsaturated, entryCount: entries.length }
}

/** Below 10: 1 decimal. 10 or more: integer. Salt: always 1 decimal. */
export function formatNutrient(value: number, key?: NutrientKey): string {
  if (key === 'salt' || Math.abs(value) < 10) return value.toFixed(1)
  return String(Math.round(value))
}

export type NutrientInputs = Record<NutrientKey, string>

/** Text for the form inputs. A known value (even 0) shows. An unknown value is empty. */
export function nutrientsToInputs(n: Nutrients | undefined): NutrientInputs {
  const inputs = {} as NutrientInputs
  for (const key of NUTRIENT_KEYS) inputs[key] = n?.[key] === undefined ? '' : String(n[key])
  return inputs
}

// Digits with an optional decimal part: "7", "7.7", "7.", ".7". No sign, no exponent.
const DECIMAL = /^(\d+\.?\d*|\.\d+)$/

/**
 * Read the form inputs. A comma counts as the decimal separator ("7,7" is 7.7). An empty
 * input, or one that is not a number or is negative, is unknown. It is never 0. Known values
 * are rounded for storage.
 */
export function parseNutrientInputs(inputs: NutrientInputs): Nutrients {
  const out: Nutrients = {}
  for (const key of NUTRIENT_KEYS) {
    const text = inputs[key].trim().replace(',', '.')
    if (DECIMAL.test(text)) out[key] = Number(text)
  }
  return roundNutrients(out)
}

const SUMMARY_LABELS: [NutrientKey, string][] = [
  ['fat', 'fat'],
  ['saturatedFat', 'sat'],
  ['carbs', 'carbs'],
  ['protein', 'protein'],
]

/** "fat 30 · sat 19 · carbs 8.5 · protein 7.8 g" for the known values. Null when none is known. */
export function formatNutrientSummary(n: Nutrients): string | null {
  const parts = SUMMARY_LABELS.flatMap(([key, label]) => {
    const value = n[key]
    return value === undefined ? [] : [`${label} ${formatNutrient(value, key)}`]
  })
  return parts.length > 0 ? `${parts.join(' · ')} g` : null
}
