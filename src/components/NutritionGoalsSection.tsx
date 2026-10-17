import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import type { Settings } from '../db/index'
import { cleanOverrides } from '../db/settings'
import { useLatestWeight } from '../hooks/useLatestWeight'
import {
  activeGoals,
  dayNames,
  daysText,
  GOAL_GROUPS,
  groupSummary,
  kcalWarnings,
  type GoalGroupId,
  type KcalWarning,
} from '../utils/goals'
import { NutrientGoalEditor } from './NutrientGoalEditor'
import styles from './NutritionGoalsSection.module.css'

/** Settings: a row for each nutrient, and the warnings for goals that no day can meet. */
export function NutritionGoalsSection({ settings }: { settings: Settings }) {
  const [editing, setEditing] = useState<GoalGroupId | null>(null)
  const weight = useLatestWeight(settings.lastWeightKg)
  const goals = settings.nutrientGoals
  const warnings = kcalWarnings(
    goals,
    settings.baselineCalories,
    cleanOverrides(settings.dayOverrides, settings.baselineCalories),
    weight.weightKg,
  )
  const opts = { saltUnit: settings.saltUnit, weightKg: weight.weightKg }

  return (
    <section class={styles.section}>
      <h2 class={styles.sectionTitle}>Nutrition Goals</h2>
      {!activeGoals(goals) && <p class={styles.intro}>All goals are off. Turn on only the ones you care about.</p>}
      {warnings.map((w) => <Warning key={`${w.kind}-${w.target}`} warning={w} />)}
      {GOAL_GROUPS.map((group) => {
        const lines = groupSummary(group.keys, goals, opts)
        const off = lines.length === 1 && lines[0] === 'Off'
        return (
          <button key={group.id} type="button" class={styles.row} onClick={() => setEditing(group.id)}>
            <span class={styles.rowText}>
              <span class={styles.rowName}>{group.title}</span>
              {lines.map((line) => (
                <span key={line} class={off ? styles.rowOff : styles.rowLine}>{line}</span>
              ))}
            </span>
            <svg class={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )
      })}
      {editing && <NutrientGoalEditor group={editing} settings={settings} onClose={() => setEditing(null)} />}
    </section>
  )
}

function Warning({ warning: w }: { warning: KcalWarning }) {
  const everyDay = w.days.length === 7
  return (
    <div class={styles.warning}>
      <div class={styles.warningTitle}>
        <span aria-hidden="true">⚠️</span>
        <span>
          {w.kind === 'min'
            ? `${daysText(w.days)}, your minimums need ${w.total} kcal. The target is ${w.target} kcal.`
            : `${daysText(w.days)}, your maximums allow only ${w.total} kcal. The target is ${w.target} kcal.`}
        </span>
      </div>
      <div class={styles.warningItems}>
        {w.items.map((item) => (
          <Fragment key={item.label}>
            <span>{item.label}</span>
            <span class={styles.warningKcal}>{item.kcal} kcal</span>
          </Fragment>
        ))}
      </div>
      <p class={styles.warningNote}>
        {w.kind === 'min'
          ? `You can keep these goals, but ${everyDay ? 'no day can meet' : `${dayNames(w.days)} cannot meet`} all of them.`
          : 'You can keep these goals, but you cannot eat your target and stay under all of them.'}
      </p>
    </div>
  )
}
