import { GREEN, GREY, overColor, RED, underColor, YELLOW } from '../utils/barColor'
import type { LiveGoal, LiveStatus } from '../utils/goalProgress'
import type { GoalKind, GramRange } from '../utils/goals'
import styles from './GoalBar.module.css'

export interface GoalBarData {
  /** The day's amount, in grams. */
  amount: number
  /** Grams that a plan adds (Meal planner). They show as a lighter piece after the amount. */
  planned?: number
  /** The goal in grams if the planned kcal are eaten. On an ended day, for the kcal eaten. */
  min?: number
  max?: number
  /** The goal for the kcal eaten so far: a thin line for each side. */
  soFar?: GramRange
  /** For the note under the bars. The colors are the same for both kinds. */
  kind: GoalKind
  /** For screen readers, because the goal number is not shown as text. */
  label: string
  /** Absent on an ended day: its bar shows the result. */
  status?: LiveStatus
}

// The bars work like the calorie bar: the end of the bar is the maximum, and an amount above
// it fills the bar. Without a maximum, the minimum sits at 80%.
const MIN_ONLY_POS = 80

function position(g: number, min?: number, max?: number): number {
  if (max !== undefined) return Math.min(100, (g / max) * 100)
  if (min !== undefined) return Math.min(100, (g / min) * MIN_ONLY_POS)
  return 0
}

/** A day that has not ended. Grey: a goal in grams that is not reached yet, as on the calorie bar. */
const STATUS_COLOR: Record<LiveStatus, string> = { met: GREEN, behind: YELLOW, notYet: GREY, unreachable: RED }

/**
 * An ended day: under a minimum, red to orange. Green from the minimum on, and from 0 under a
 * maximum alone, because 0 is the best value there. Above a maximum, the calorie bar's warning:
 * orange from 105%, red from 120%.
 */
function resultColor(amount: number, min?: number, max?: number): string {
  if (min !== undefined && amount < min) return underColor(amount / min)
  return max === undefined ? GREEN : overColor(amount / max, GREEN)
}

const g = (n: number) => String(n < 10 ? Math.round(n * 10) / 10 : Math.round(n))

const range = (min?: number, max?: number) => {
  if (min !== undefined && max !== undefined) return `${g(min)}–${g(max)} g`
  return min !== undefined ? `at least ${g(min)} g` : `at most ${g(max!)} g`
}

/**
 * The label for screen readers: "Goal: 45–60 g", "Goal: at least 25 g", "Goal: at most 16 g",
 * then "For the kcal eaten so far: at most 9.3 g" when the bar has thin lines.
 */
export function goalLabel(min?: number, max?: number, soFar?: GramRange): string {
  const label = `Goal: ${range(min, max)}`
  return soFar ? `${label}. For the kcal eaten so far: ${range(soFar.min, soFar.max)}` : label
}

/** The bar data of a goal from `liveGoals`. */
export function liveBar(goal: LiveGoal, kind: GoalKind, planned?: number): GoalBarData {
  const { min, max } = goal.goal
  return {
    amount: goal.amount - (planned ?? 0),
    planned,
    min,
    max,
    soFar: goal.soFar,
    kind,
    label: goalLabel(min, max, goal.soFar),
    status: goal.status,
  }
}

export function GoalBar(props: GoalBarData) {
  // A limit of 0 has no place on the bar
  const positive = (n?: number) => (n !== undefined && n > 0 ? n : undefined)
  const min = positive(props.min)
  const max = positive(props.max)
  // With a plan, the color shows the result of eating it
  const total = props.amount + (props.planned ?? 0)
  const color = props.status ? STATUS_COLOR[props.status] : resultColor(total, min, max)
  const lines = [positive(props.soFar?.min), positive(props.soFar?.max)].filter((n) => n !== undefined)

  return (
    <div class={styles.bar} role="img" aria-label={props.label}>
      <div class={styles.track}>
        {/* Under the amount, from 0, so the rounded end of the amount has no gap after it */}
        {props.planned !== undefined && (
          <div class={styles.plannedFill} style={{ width: `${position(total, min, max)}%`, background: color }} />
        )}
        <div class={styles.fill} style={{ width: `${position(props.amount, min, max)}%`, background: color }} />
      </div>
      {lines.map((line) => (
        <div key={line} class={styles.soFarMark} style={{ left: `${position(line, min, max)}%` }} />
      ))}
      {/* The tip of the triangle sits on the minimum. The maximum is the end of the bar. */}
      {min !== undefined && (
        <svg
          class={styles.minMark}
          style={{ left: `calc(${position(min, min, max)}% - 7px)` }}
          viewBox="0 0 8 10"
          aria-hidden="true"
        >
          <path d="M1 1 L7 5 L1 9 Z" />
        </svg>
      )}
    </div>
  )
}

/**
 * The notes under goal bars. `plan`: the Meal planner, where the amounts include the plan.
 * The markers note shows on every day. The others only on a day that has not ended.
 */
export function goalNotes(goals: LiveGoal[], plan = false): string[] {
  const notes: string[] = []
  // The same test as the bar: a limit of 0 has no marker
  const hasMin = goals.some(({ goal }) => (goal.min ?? 0) > 0)
  const hasMax = goals.some(({ goal }) => (goal.max ?? 0) > 0)
  if (hasMin) {
    notes.push(
      `The green triangle is the minimum for the day.${hasMax ? ' If a goal has a maximum, the end of the bar is the maximum.' : ''}`,
    )
  } else if (hasMax) {
    notes.push('The end of a bar is the maximum for the day.')
  }
  if (goals.some((goal) => goal.soFar)) {
    notes.push(`The thin lines show the same goal for the kcal you ate so far${plan ? ', with this plan' : ''}.`)
  }
  if (goals.some((goal) => goal.status === 'behind')) {
    notes.push(
      `Yellow: you miss the goal if you stop eating ${plan ? 'after this plan' : 'now'}. You can still meet it without going over your planned calories.`,
    )
  }
  if (goals.some((goal) => goal.status === 'unreachable')) {
    notes.push('Red: you cannot meet the goal today without going over your planned calories.')
  }
  return notes
}
