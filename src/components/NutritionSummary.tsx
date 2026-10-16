import { useState } from 'preact/hooks'
import type { IntakeEntry } from '../db/index'
import {
  NUTRIENT_KEYS,
  formatNutrient,
  knownTotals,
  sumNutrients,
  type NutrientKey,
} from '../utils/nutrients'
import { NutritionRows } from './NutritionRows'
import styles from './NutritionSummary.module.css'

const STORAGE_KEY = 'nutrition-today-open'

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

      {open && (
        <div class={styles.content}>
          {hasData ? (
            <NutritionRows {...knownTotals(sums)} />
          ) : (
            <div class={styles.empty}>No nutrition data for this day</div>
          )}
        </div>
      )}
    </div>
  )
}
