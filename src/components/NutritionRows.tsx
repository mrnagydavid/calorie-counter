import type { KnownTotals, NutrientKey } from '../utils/nutrients'
import styles from './NutritionRows.module.css'

type Row = { key: NutrientKey | 'unsaturated'; label: string; sub?: boolean }

// Food label order. Unsaturated sits under saturated and is derived, so it has no input.
const ROWS: Row[] = [
  { key: 'fat', label: 'Fat' },
  { key: 'saturatedFat', label: 'saturated', sub: true },
  { key: 'unsaturated', label: 'unsaturated', sub: true },
  { key: 'carbs', label: 'Carbohydrate' },
  { key: 'sugars', label: 'sugars', sub: true },
  { key: 'fiber', label: 'Fiber' },
  { key: 'protein', label: 'Protein' },
  { key: 'salt', label: 'Salt' },
]

/** The nutrient list of Today and the Recipe calculator. An unknown value shows "–". */
export function NutritionRows({ nutrients, unsaturated }: KnownTotals) {
  return (
    <div class={styles.rows}>
      {ROWS.map(({ key, label, sub }) => {
        const value = key === 'unsaturated' ? unsaturated : nutrients[key]
        // The derived row shows only when some item has both fat and saturated fat.
        if (key === 'unsaturated' && value === undefined) return null
        return (
          <div key={key} class={sub ? styles.subRow : styles.row}>
            <span>{label}</span>
            <span class={styles.value}>
              {/* One decimal on every row, so the list never mixes integers and decimals */}
              {value !== undefined ? `${value.toFixed(1)} g` : '–'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
