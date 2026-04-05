import { barColor } from '../utils/barColor'
import styles from './CalorieBudgetBar.module.css'

interface CalorieBudgetBarProps {
  consumed: number
  target: number
}

export function CalorieBudgetBar({ consumed, target }: CalorieBudgetBarProps) {
  const ratio = target > 0 ? consumed / target : 0
  const remaining = target - consumed
  const pct = Math.min(ratio * 100, 100)

  return (
    <div class={styles.wrapper}>
      <div class={styles.barTrack}>
        <div
          class={styles.barFill}
          style={{ width: `${pct}%`, backgroundColor: barColor(ratio) }}
        />
      </div>
      <div class={styles.numbers}>
        <span>{consumed} consumed</span>
        <span>{target} target</span>
      </div>
      <div class={styles.remaining} style={{ color: barColor(ratio) }}>
        {remaining >= 0 ? remaining : remaining}
        <div class={styles.remainingLabel}>
          {remaining >= 0 ? 'remaining' : 'over budget'}
        </div>
      </div>
    </div>
  )
}
