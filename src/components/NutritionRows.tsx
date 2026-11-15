import { Fragment, type ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import type { KnownTotals, NutrientKey } from '../utils/nutrients'
import { shareText, type FoodSource } from '../utils/foodSources'
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

/** "7.5 g", or "80 mg" for salt shown as sodium. One decimal everywhere, so a list never mixes integers and decimals. */
export function amountText(grams: number, sodium: boolean): string {
  return sodium ? `${Math.round(grams * SODIUM_MG_PER_SALT_G)} mg` : `${grams.toFixed(1)} g`
}

interface NutritionRowsProps extends KnownTotals {
  /** A bar for each row with a goal (Today). */
  goals?: Partial<Record<RowKey, GoalBarData>>
  /** Salt can show as sodium (Today). */
  saltUnit?: 'salt' | 'sodium'
  /** The foods behind each row (Today). A row with foods opens a list of them when tapped. */
  sources?: Partial<Record<RowKey, FoodSource[]>>
}

/** The nutrient list of Today and the Recipe calculator. An unknown value shows "–". */
export function NutritionRows({ nutrients, unsaturated, goals, saltUnit, sources }: NutritionRowsProps) {
  const [open, setOpen] = useState<RowKey | null>(null)

  const rows = ROWS.flatMap(({ key, label, sub }) => {
    const value = key === 'unsaturated' ? unsaturated : nutrients[key]
    const goal = goals?.[key]
    // The derived row shows only when some item has both fat and saturated fat, or has a goal.
    if (key === 'unsaturated' && value === undefined && !goal) return []
    const sodium = key === 'salt' && saltUnit === 'sodium'
    const text = value === undefined ? '–' : amountText(value, sodium)
    const foods = sources?.[key] ?? []
    return [{ key, label: sodium ? 'Sodium' : label, sub, text, goal, foods, sodium, total: value ?? 0 }]
  })
  type ShownRow = (typeof rows)[number]

  const toggle = (key: RowKey) => setOpen(open === key ? null : key)

  // A row with foods is a button. The open row is grey and its list is under it.
  const line = ({ key, foods }: ShownRow, rowClass: string, cells: ComponentChildren) => {
    if (foods.length === 0) return <div class={rowClass}>{cells}</div>
    return (
      <button
        type="button"
        class={`${rowClass} ${styles.tappable} ${open === key ? styles.open : ''}`}
        aria-expanded={open === key}
        aria-controls={`sources-${key}`}
        onClick={() => toggle(key)}
      >
        {cells}
      </button>
    )
  }
  const list = (row: ShownRow) =>
    open === row.key && row.foods.length > 0 && <SourceList id={`sources-${row.key}`} {...row} />

  // With goals, every row is label | bar | value in a shared grid. The bars start and end in
  // the same place, so the triangles line up; only the labels are indented.
  if (goals && Object.keys(goals).length > 0) {
    return (
      <div class={styles.grid}>
        {rows.map((row) => (
          <Fragment key={row.key}>
            {line(
              row,
              styles.gridRow,
              <>
                <span class={row.sub ? styles.subLabel : styles.label}>{row.label}</span>
                <span class={styles.barCell}>{row.goal && <GoalBar {...row.goal} />}</span>
                <span class={row.sub ? styles.subValue : styles.value}>{row.text}</span>
              </>,
            )}
            {list(row)}
          </Fragment>
        ))}
      </div>
    )
  }

  return (
    <div class={sources ? `${styles.rows} ${styles.tapRows}` : styles.rows}>
      {rows.map((row) => (
        <Fragment key={row.key}>
          {line(
            row,
            row.sub ? styles.subRow : styles.row,
            <>
              <span>{row.label}</span>
              <span class={styles.value}>{row.text}</span>
            </>,
          )}
          {list(row)}
        </Fragment>
      ))}
    </div>
  )
}

interface SourceListProps {
  id: string
  foods: FoodSource[]
  /** The row's amount, in grams. The shares are parts of it, so they add up to 100%. */
  total: number
  sodium: boolean
}

/** The foods behind a row, most first: name, amount and share. */
function SourceList({ id, foods, total, sodium }: SourceListProps) {
  return (
    <div id={id} class={styles.sources}>
      {foods.map((food, i) => (
        <div key={i} class={styles.source}>
          <span class={styles.sourceName}>
            {food.name}
            {food.entries > 1 && <span class={styles.times}> · {food.entries} times</span>}
          </span>
          <span class={styles.sourceAmount}>{amountText(food.amount, sodium)}</span>
          <span class={styles.sourceShare}>{shareText(food.amount, total)}</span>
        </div>
      ))}
    </div>
  )
}
