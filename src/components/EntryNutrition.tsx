import type { IntakeEntry } from '../db/index'
import { knownTotals, sumNutrients, type NutrientKey } from '../utils/nutrients'
import { NutritionRows, amountText } from './NutritionRows'
import styles from './EntryNutrition.module.css'

// Food label order, as in the table
const LINE_LABELS: [NutrientKey, string][] = [
  ['fat', 'Fat'],
  ['saturatedFat', 'saturated'],
  ['carbs', 'Carbs'],
  ['sugars', 'sugars'],
  ['fiber', 'Fiber'],
  ['protein', 'Protein'],
  ['salt', 'Salt'],
]

interface EntryNutritionProps {
  entry: IntakeEntry
  /** The full table when the Nutrition section is open; one line when it is closed. */
  table: boolean
  saltUnit?: 'salt' | 'sodium'
}

/** A tapped entry's nutrients, for the amount eaten. Nothing when the entry has none. */
export function EntryNutrition({ entry, table, saltUnit }: EntryNutritionProps) {
  const totals = knownTotals(sumNutrients([entry]))
  const known = LINE_LABELS.filter(([key]) => totals.nutrients[key] !== undefined)
  if (known.length === 0) return null

  if (table) {
    return (
      <div class={styles.table}>
        <NutritionRows {...totals} saltUnit={saltUnit} />
      </div>
    )
  }

  // The line leaves out unknown values, where the table shows "–"
  const line = known
    .map(([key, label]) => {
      const sodium = key === 'salt' && saltUnit === 'sodium'
      return `${sodium ? 'Sodium' : label} ${amountText(totals.nutrients[key]!, sodium)}`
    })
    .join(' · ')
  return <div class={styles.line}>{line}</div>
}
