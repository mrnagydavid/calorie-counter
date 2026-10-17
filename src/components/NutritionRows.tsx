import { Fragment } from 'preact'
import type { KnownTotals, NutrientKey } from '../utils/nutrients'
import { SODIUM_MG_PER_SALT_G } from '../utils/goals'
import { GoalBar, type GoalBarData } from './GoalBar'
import styles from './NutritionRows.module.css'

export type RowKey = NutrientKey | 'unsaturated'

type Row = { key: RowKey; label: string; sub?: boolean }

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

interface NutritionRowsProps extends KnownTotals {
  /** A bar for each row with a goal (Today). */
  goals?: Partial<Record<RowKey, GoalBarData>>
  /** Salt can show as sodium (Today). */
  saltUnit?: 'salt' | 'sodium'
}

/** The nutrient list of Today and the Recipe calculator. An unknown value shows "–". */
export function NutritionRows({ nutrients, unsaturated, goals, saltUnit }: NutritionRowsProps) {
  const rows = ROWS.flatMap(({ key, label, sub }) => {
    const value = key === 'unsaturated' ? unsaturated : nutrients[key]
    const goal = goals?.[key]
    // The derived row shows only when some item has both fat and saturated fat, or has a goal.
    if (key === 'unsaturated' && value === undefined && !goal) return []
    const sodium = key === 'salt' && saltUnit === 'sodium'
    let text = '–'
    // One decimal on every row, so the list never mixes integers and decimals
    if (value !== undefined) text = sodium ? `${Math.round(value * SODIUM_MG_PER_SALT_G)} mg` : `${value.toFixed(1)} g`
    return [{ key, label: sodium ? 'Sodium' : label, sub, text, goal }]
  })

  // With goals, every row is label | bar | value in a shared grid. The bars start and end in
  // the same place, so the triangles line up; only the labels are indented.
  if (goals && Object.keys(goals).length > 0) {
    return (
      <div class={styles.grid}>
        {rows.map(({ key, label, sub, text, goal }) => (
          <Fragment key={key}>
            <span class={sub ? styles.subLabel : styles.label}>{label}</span>
            <span class={styles.barCell}>{goal && <GoalBar {...goal} />}</span>
            <span class={sub ? styles.subValue : styles.value}>{text}</span>
          </Fragment>
        ))}
      </div>
    )
  }

  return (
    <div class={styles.rows}>
      {rows.map(({ key, label, sub, text }) => (
        <div key={key} class={sub ? styles.subRow : styles.row}>
          <span>{label}</span>
          <span class={styles.value}>{text}</span>
        </div>
      ))}
    </div>
  )
}
