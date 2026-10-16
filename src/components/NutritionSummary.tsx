import { useState } from 'preact/hooks'
import type { IntakeEntry } from '../db/index'
import {
  NUTRIENT_KEYS,
  formatNutrient,
  sumNutrients,
  type NutrientKey,
  type NutrientTotal,
} from '../utils/nutrients'
import styles from './NutritionSummary.module.css'

const STORAGE_KEY = 'nutrition-today-open'

type Row = { key: NutrientKey | 'unsaturated'; label: string; sub?: boolean }

// Design 7.3. Unsaturated sits under saturated and is derived, so it has no input.
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

const CLOSED_ROWS: { key: NutrientKey; label: string }[] = [
  { key: 'fat', label: 'Fat' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'protein', label: 'Protein' },
]

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

interface NutritionSummaryProps {
  intakes: IntakeEntry[]
}

export function NutritionSummary({ intakes }: NutritionSummaryProps) {
  const [open, setOpen] = useState(readOpen)

  if (intakes.length === 0) return null

  const sums = sumNutrients(intakes)
  const hasData = NUTRIENT_KEYS.some((key) => sums.totals[key].count > 0)

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // The state is a convenience. The section still works without it.
    }
  }

  const totalOf = (key: Row['key']): NutrientTotal =>
    key === 'unsaturated' ? sums.unsaturated : sums.totals[key]

  const closedLine = hasData
    ? `${CLOSED_ROWS.map(({ key, label }) => {
        const { total, count } = sums.totals[key]
        return `${label} ${count > 0 ? formatNutrient(total, key) : '–'}`
      }).join(' · ')} g`
    : 'No nutrition data'

  return (
    <div>
      <button class={styles.header} onClick={toggle} aria-expanded={open}>
        <span class={styles.title}>Nutrition</span>
        {!open && <span class={styles.closedLine}>{closedLine}</span>}
        <span class={styles.chevron}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (hasData ? (
        <div class={styles.rows}>
          {ROWS.map(({ key, label, sub }) => {
            const { total, count } = totalOf(key)
            // The derived row shows only when some entry has both fat and saturated fat.
            if (key === 'unsaturated' && count === 0) return null
            return (
              <div key={key} class={sub ? styles.subRow : styles.row}>
                <span>{label}</span>
                <span class={styles.value}>
                  {/* One decimal on every row, so the list never mixes integers and decimals */}
                  {count > 0 ? `${total.toFixed(1)} g` : '–'}
                  {count > 0 && count < sums.entryCount && (
                    <span class={styles.coverage}>{count} of {sums.entryCount}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div class={styles.empty}>No nutrition data for this day</div>
      ))}
    </div>
  )
}
