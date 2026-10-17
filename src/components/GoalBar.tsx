import { GREEN, GREY, overColor } from '../utils/barColor'
import type { GoalKind } from '../utils/goals'
import styles from './GoalBar.module.css'

export interface GoalBarData {
  /** Today's amount and the goal, in grams. */
  amount: number
  min?: number
  max?: number
  /** For the note under the bars. The colors are the same for both kinds. */
  kind: GoalKind
  /** For screen readers, because the goal number is not shown as text. */
  label: string
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
 * Grey under a minimum, green from the minimum on. Above a maximum, the calorie bar's warning:
 * orange from 105%, red from 120%. A maximum alone has no green, because it is not a target.
 */
function fillColor(amount: number, min?: number, max?: number): string {
  if (min !== undefined && amount < min) return GREY
  const base = min !== undefined ? GREEN : GREY
  return max === undefined ? base : overColor(amount / max, base)
}

export function GoalBar(props: GoalBarData) {
  // A limit of 0 has no place on the bar
  const min = props.min !== undefined && props.min > 0 ? props.min : undefined
  const max = props.max !== undefined && props.max > 0 ? props.max : undefined

  return (
    <div class={styles.bar} role="img" aria-label={props.label}>
      <div class={styles.track}>
        <div
          class={styles.fill}
          style={{ width: `${position(props.amount, min, max)}%`, background: fillColor(props.amount, min, max) }}
        />
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
