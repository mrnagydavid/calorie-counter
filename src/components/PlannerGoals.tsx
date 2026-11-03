import { Fragment } from 'preact'
import type { GoalKey } from '../db/index'
import { goalTotal, type DayGoalRange } from '../utils/goalProgress'
import { GOALS, SODIUM_MG_PER_SALT_G } from '../utils/goals'
import { formatNutrient, type NutrientSums } from '../utils/nutrients'
import { GoalBar, goalLabel } from './GoalBar'
import styles from './PlannerGoals.module.css'

type SaltUnit = 'salt' | 'sodium'

const name = (key: GoalKey, saltUnit?: SaltUnit) =>
  key === 'salt' && saltUnit === 'sodium' ? 'Sodium' : GOALS[key].title

/** "5.0 g", "18 g", "480 mg" for sodium. */
function amountText(grams: number, key: GoalKey, saltUnit?: SaltUnit): string {
  if (key === 'salt' && saltUnit === 'sodium') return `${Math.round(grams * SODIUM_MG_PER_SALT_G)} mg`
  return `${formatNutrient(grams, key === 'unsaturatedFat' ? undefined : key)} g`
}

/** What is left after the plan: "0.9 g over", "14 g to go", "6.6 g left", or "Met" for a minimum alone. */
function leftText(total: number, { key, min, max }: DayGoalRange, saltUnit?: SaltUnit): string {
  if (max !== undefined && total > max) return `${amountText(total - max, key, saltUnit)} over`
  if (min !== undefined && total < min) return `${amountText(min - total, key, saltUnit)} to go`
  if (max !== undefined) return `${amountText(max - total, key, saltUnit)} left`
  return 'Met'
}

interface PlannerGoalsProps {
  /** The day's goals in grams. */
  goals: DayGoalRange[]
  eaten: NutrientSums
  planned: NutrientSums
  /** A past day: under a minimum, the bar shows a result, as on Today. */
  dayEnded: boolean
  saltUnit?: SaltUnit
}

/** A row for each goal: the day's amount plus the plan on a bar, and what is left after the plan. */
export function PlannerGoals({ goals, eaten, planned, dayEnded, saltUnit }: PlannerGoalsProps) {
  return (
    <div class={styles.grid}>
      {goals.map((goal) => {
        const { key, min, max } = goal
        const amount = goalTotal(eaten, key).total
        const plan = goalTotal(planned, key).total
        return (
          <Fragment key={key}>
            <span class={styles.label}>{name(key, saltUnit)}</span>
            <GoalBar
              amount={amount}
              planned={plan}
              min={min}
              max={max}
              kind={GOALS[key].kind}
              label={goalLabel(min, max)}
              dayEnded={dayEnded}
            />
            <span class={styles.value}>{leftText(amount + plan, goal, saltUnit)}</span>
          </Fragment>
        )
      })}
    </div>
  )
}

/**
 * One item's grams of the nutrients with a goal: "Saturated fat 5.0 g · Fiber 3.0 g".
 * Null when the item has none of them.
 */
export function itemGoalLine(sums: NutrientSums, goals: DayGoalRange[], saltUnit?: SaltUnit): string | null {
  const parts = goals.flatMap(({ key }) => {
    const { total, count } = goalTotal(sums, key)
    return count > 0 ? [`${name(key, saltUnit)} ${amountText(total, key, saltUnit)}`] : []
  })
  return parts.length > 0 ? parts.join(' · ') : null
}
