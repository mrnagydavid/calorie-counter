import type { GoalScale } from '../hooks/useGoalScale'
import styles from './GoalScaleSwitch.module.css'

interface GoalScaleSwitchProps {
  scale: GoalScale
  onChange: (scale: GoalScale) => void
  eatenKcal: number
  plannedKcal: number
  /** The Meal planner, where the kcal eaten include the plan. */
  plan?: boolean
}

/** "Eaten so far · 1100 kcal | Planned · 2000 kcal" above the goal bars. */
export function GoalScaleSwitch({ scale, onChange, eatenKcal, plannedKcal, plan = false }: GoalScaleSwitchProps) {
  const options: { key: GoalScale; text: string }[] = [
    { key: 'eaten', text: `${plan ? 'With this plan' : 'Eaten so far'} · ${eatenKcal} kcal` },
    { key: 'planned', text: `Planned · ${plannedKcal} kcal` },
  ]
  return (
    <div class={styles.switch} role="group" aria-label="Goals for">
      {options.map(({ key, text }) => (
        <button
          key={key}
          class={`${styles.option} ${scale === key ? styles.active : ''}`}
          aria-pressed={scale === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** The start of the first note under the bars: which kcal the goals are for. */
export function scaleNote(scale: GoalScale, eatenKcal: number, plannedKcal: number, plan = false): string {
  return scale === 'eaten'
    ? `The bars show the goal for the ${eatenKcal} kcal you ate so far${plan ? ', with this plan' : ''}.`
    : `The bars show the goal for your planned ${plannedKcal} kcal.`
}
