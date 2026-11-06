import { useState } from 'preact/hooks'
import type { DailyTarget, GoalKey, IntakeEntry } from '../db/index'
import { kcalCoverage, liveGoals, type LiveGoal } from '../utils/goalProgress'
import { GOALS } from '../utils/goals'
import { NUTRIENT_KEYS, formatNutrient, knownTotals, sumNutrients, type NutrientKey } from '../utils/nutrients'
import { goalNotes, liveBar, type GoalBarData } from './GoalBar'
import { GoalNotes } from './GoalNotes'
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

/** A bar for each goal in the day's copy. */
function goalBars(goals: LiveGoal[]) {
  const bars: Partial<Record<RowKey, GoalBarData>> = {}
  for (const goal of goals) bars[ROW_OF_GOAL[goal.key]] = liveBar(goal, GOALS[goal.key].kind)
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
  // Today cannot go to a future day, so every other day has ended
  const goals = liveGoals(row, burned, intakes, !isToday)
  const bars = goalBars(goals)
  const hasBars = Object.keys(bars).length > 0
  const hasHabitGoal = Object.values(bars).some((b) => b.kind === 'habit')
  const coverage = kcalCoverage(intakes)
  const notes = [...goalNotes(goals)]
  if (hasHabitGoal) {
    notes.push(
      'Some of these goals are judged on your average over weeks, not on one day. You can follow them best on the Overview.',
    )
  }
  const warning =
    hasBars && coverage < 1
      ? `Nutrient data exists for only ${Math.floor(coverage * 100)}% of ${isToday ? 'today’s' : 'this day’s'} kcal, which means that the real amounts are probably higher than shown.`
      : undefined

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
              <GoalNotes notes={notes} warning={warning} />
            </>
          ) : (
            <div class={styles.empty}>No nutrition data for this day</div>
          )}
        </div>
      )}
    </div>
  )
}
