import { useState } from 'preact/hooks'
import type { DailyTarget, GoalKey, IntakeEntry } from '../db/index'
import { dayKcal, goalTotal, kcalCoverage } from '../utils/goalProgress'
import { GOAL_KEYS, GOALS, goalGrams, hasLimit } from '../utils/goals'
import {
  NUTRIENT_KEYS,
  formatNutrient,
  knownTotals,
  sumNutrients,
  type NutrientKey,
  type NutrientSums,
} from '../utils/nutrients'
import type { GoalBarData } from './GoalBar'
import { NutritionRows, type RowKey } from './NutritionRows'
import styles from './NutritionSummary.module.css'

const STORAGE_KEY = 'nutrition-today-open'

const CLOSED_ROWS: { key: NutrientKey; label: string }[] = [
  { key: 'fat', label: 'Fat' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'protein', label: 'Protein' },
]

const ROW_OF_GOAL: Record<GoalKey, RowKey> = {
  saturatedFat: 'saturatedFat',
  unsaturatedFat: 'unsaturated',
  fat: 'fat',
  carbs: 'carbs',
  sugars: 'sugars',
  fiber: 'fiber',
  protein: 'protein',
  salt: 'salt',
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

const g = (n: number) => String(n < 10 ? Math.round(n * 10) / 10 : Math.round(n))

/** A bar for each goal in the day's copy, in grams of that day. */
function goalBars(sums: NutrientSums, row: DailyTarget | undefined, burned: number) {
  const bars: Partial<Record<RowKey, GoalBarData>> = {}
  if (!row?.nutrientGoals) return bars
  for (const key of GOAL_KEYS) {
    const goal = row.nutrientGoals[key]
    if (!hasLimit(goal)) continue
    const grams = goalGrams(goal, key, { kcal: dayKcal(row, burned), weightKg: row.weightKg })
    if (!grams) continue
    const { min, max } = grams
    const label =
      min !== undefined && max !== undefined
        ? `Goal: ${g(min)}–${g(max)} g`
        : min !== undefined
          ? `Goal: at least ${g(min)} g`
          : `Goal: at most ${g(max!)} g`
    bars[ROW_OF_GOAL[key]] = { amount: goalTotal(sums, key).total, min, max, kind: GOALS[key].kind, label }
  }
  return bars
}

interface NutritionSummaryProps {
  intakes: IntakeEntry[]
  /** The day's row, with its copy of the goals. */
  row?: DailyTarget
  burned: number
  isToday: boolean
  saltUnit?: 'salt' | 'sodium'
}

export function NutritionSummary({ intakes, row, burned, isToday, saltUnit }: NutritionSummaryProps) {
  const [open, setOpen] = useState(readOpen)

  if (intakes.length === 0) return null

  const sums = sumNutrients(intakes)
  const hasData = NUTRIENT_KEYS.some((key) => sums.totals[key].count > 0)
  const bars = goalBars(sums, row, burned)
  const hasBars = Object.keys(bars).length > 0
  const hasHabitGoal = Object.values(bars).some((b) => b.kind === 'habit')
  const coverage = kcalCoverage(intakes)

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
            <>
              <NutritionRows {...knownTotals(sums)} goals={bars} saltUnit={saltUnit} />
              {hasHabitGoal && (
                <p class={styles.note}>
                  Some of these goals are judged on your average over weeks, not on one day. You can follow them
                  best on the Overview.
                </p>
              )}
              {hasBars && coverage < 1 && (
                <p class={styles.note}>
                  Nutrient data exists for only {Math.floor(coverage * 100)}% of {isToday ? 'today’s' : 'this day’s'} kcal,
                  which means that the real amounts are probably higher than shown.
                </p>
              )}
            </>
          ) : (
            <div class={styles.empty}>No nutrition data for this day</div>
          )}
        </div>
      )}
    </div>
  )
}
