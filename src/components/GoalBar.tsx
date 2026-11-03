import { GREEN, GREY, overColor, underColor } from '../utils/barColor'
import type { GoalKind } from '../utils/goals'
import styles from './GoalBar.module.css'

export interface GoalBarData {
  /** Today's amount and the goal, in grams. */
  amount: number
  /** Grams that a plan adds (Meal planner). They show as a lighter piece after the amount. */
  planned?: number
  min?: number
  max?: number
  /** For the note under the bars. The colors are the same for both kinds. */
  kind: GoalKind
  /** For screen readers, because the goal number is not shown as text. */
  label: string
  /** A past day. Under a minimum, its bar shows the result; today's bar is only "not yet". */
  dayEnded: boolean
}

// The bars work like the calorie bar: the end of the bar is the maximum, and an amount above
// it fills the bar. Without a maximum, the minimum sits at 80%.
const MIN_ONLY_POS = 80

function position(g: number, min?: number, max?: number): number {
  if (max !== undefined) return Math.min(100, (g / max) * 100)
  if (min !== undefined) return Math.min(100, (g / min) * MIN_ONLY_POS)
  return 0
}

/**
 * Under a minimum: grey on today, because the day is not finished (as on the calorie bar); red
 * to orange on a past day. Green from the minimum on, and from 0 under a maximum alone, because
 * 0 is the best value there. Above a maximum, the calorie bar's warning: orange from 105%, red
 * from 120%.
 */
function fillColor(amount: number, dayEnded: boolean, min?: number, max?: number): string {
  if (min !== undefined && amount < min) return dayEnded ? underColor(amount / min) : GREY
  return max === undefined ? GREEN : overColor(amount / max, GREEN)
}

const g = (n: number) => String(n < 10 ? Math.round(n * 10) / 10 : Math.round(n))

/** The label for screen readers: "Goal: 45–60 g", "Goal: at least 25 g", "Goal: at most 16 g". */
export function goalLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `Goal: ${g(min)}–${g(max)} g`
  return min !== undefined ? `Goal: at least ${g(min)} g` : `Goal: at most ${g(max!)} g`
}

export function GoalBar(props: GoalBarData) {
  // A limit of 0 has no place on the bar
  const min = props.min !== undefined && props.min > 0 ? props.min : undefined
  const max = props.max !== undefined && props.max > 0 ? props.max : undefined
  // With a plan, the color shows the result of eating it
  const total = props.amount + (props.planned ?? 0)
  const color = fillColor(total, props.dayEnded, min, max)

  return (
    <div class={styles.bar} role="img" aria-label={props.label}>
      <div class={styles.track}>
        {/* Under the amount, from 0, so the rounded end of the amount has no gap after it */}
        {props.planned !== undefined && (
          <div class={styles.plannedFill} style={{ width: `${position(total, min, max)}%`, background: color }} />
        )}
        <div class={styles.fill} style={{ width: `${position(props.amount, min, max)}%`, background: color }} />
      </div>
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
