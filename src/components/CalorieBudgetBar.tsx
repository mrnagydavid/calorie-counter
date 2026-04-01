import styles from './CalorieBudgetBar.module.css'

interface CalorieBudgetBarProps {
  consumed: number
  target: number
}

// Interpolate between two hex colors. t=0 returns c1, t=1 returns c2.
function lerpColor(c1: string, c2: string, t: number): string {
  const p = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  const [r1, g1, b1] = p(c1)
  const [r2, g2, b2] = p(c2)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

const GREY = '#6b7280'
const GREEN = '#10b981'
const YELLOW = '#f59e0b'
const RED = '#ef4444'

function barColor(ratio: number): string {
  if (ratio <= 0.5) return GREY
  if (ratio <= 0.95) return lerpColor(GREY, GREEN, (ratio - 0.5) / 0.45)
  if (ratio <= 1.05) return GREEN
  if (ratio <= 1.4) return lerpColor(GREEN, YELLOW, (ratio - 1.05) / 0.35)
  return RED
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
