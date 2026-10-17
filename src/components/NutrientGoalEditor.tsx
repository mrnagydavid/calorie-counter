import { useState } from 'preact/hooks'
import type { GoalKey, NutrientGoals, Settings } from '../db/index'
import { shiftDate } from '../db/dates'
import { computeWeeklyAverage, updateSettings } from '../db/settings'
import { useGoalDays } from '../hooks/useGoalDays'
import { useLatestWeight } from '../hooks/useLatestWeight'
import { useToday } from '../hooks/useToday'
import { averageInUnit } from '../utils/goalProgress'
import { GOAL_GROUPS, GOALS, unsaturatedAboveFatMax, type GoalGroupId } from '../utils/goals'
import { EditScreen } from './EditScreen'
import { draftHasError, draftValues, GoalCard, valueText, type GoalDraft, type SaltUnit } from './GoalCard'
import styles from './NutrientGoalEditor.module.css'

interface NutrientGoalEditorProps {
  group: GoalGroupId
  settings: Settings
  onClose: () => void
}

type Drafts = Record<GoalKey, GoalDraft>

/** The mini-form of one nutrient: a card for each of its goals, and Save. */
export function NutrientGoalEditor({ group, settings, onClose }: NutrientGoalEditorProps) {
  const { title, keys } = GOAL_GROUPS.find((g) => g.id === group)!
  const [saltUnit, setSaltUnit] = useState<SaltUnit>(settings.saltUnit ?? 'salt')
  const [drafts, setDrafts] = useState<Drafts>(() => {
    const out = {} as Drafts
    for (const key of keys) {
      const goal = settings.nutrientGoals?.[key]
      out[key] = goal
        ? { on: goal.on, unit: goal.unit, min: valueText(goal.min, key, saltUnit), max: valueText(goal.max, key, saltUnit) }
        : { on: false, unit: GOALS[key].units[0], min: '', max: '' }
    }
    return out
  })
  const weight = useLatestWeight(settings.lastWeightKg)
  // "About x g a day" uses the daily average of the calorie settings, with the day overrides.
  const ctx = { kcal: computeWeeklyAverage(settings.baselineCalories, settings.dayOverrides), weightKg: weight.weightKg }

  // The Fat form shows the unsaturated fat of the last 4 weeks, with the Overview's rules.
  const today = useToday()
  const last28 = useGoalDays(shiftDate(today, -28), shiftDate(today, -1))
  const unsaturatedLast4Weeks =
    group === 'fat' && last28 ? averageInUnit([...last28.values()], 'unsaturatedFat', 'pctKcal') : undefined

  const setDraft = (key: GoalKey, draft: GoalDraft) => setDrafts((d) => ({ ...d, [key]: draft }))

  // The salt fields follow the unit on the screen.
  const changeSaltUnit = (unit: SaltUnit) => {
    if (unit === saltUnit) return
    const values = draftValues(drafts.salt, 'salt', saltUnit)
    setDraft('salt', { ...drafts.salt, min: valueText(values.min, 'salt', unit), max: valueText(values.max, 'salt', unit) })
    setSaltUnit(unit)
  }

  /** The goals of this form, from the drafts, merged into the other goals. */
  const goalsFromDrafts = (): NutrientGoals => {
    const goals: NutrientGoals = { ...settings.nutrientGoals }
    for (const key of keys) {
      const draft = drafts[key]
      const { min, max } = draftValues(draft, key, saltUnit)
      // A goal that is off keeps its values. One that was never set stays absent.
      if (!draft.on && min === undefined && max === undefined) {
        delete goals[key]
        continue
      }
      goals[key] = {
        on: draft.on,
        unit: draft.unit,
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      }
    }
    return goals
  }

  const canSave = !keys.some((key) => draftHasError(drafts[key]))

  const save = async () => {
    if (!canSave) return
    const nutrientGoals = goalsFromDrafts()
    await updateSettings(group === 'salt' ? { nutrientGoals, saltUnit } : { nutrientGoals })
    onClose()
  }

  const card = (key: GoalKey) => (
    <GoalCard
      key={key}
      goalKey={key}
      draft={drafts[key]}
      onChange={(d) => setDraft(key, d)}
      ctx={ctx}
      weight={weight}
      saltUnit={saltUnit}
    >
      {key === 'unsaturatedFat' && unsaturatedLast4Weeks !== undefined && (
        <p class={styles.cardNote}>
          Your last 4 weeks: <strong>{unsaturatedLast4Weeks.toFixed(1)}% of kcal</strong>
        </p>
      )}
      {key === 'unsaturatedFat' && (
        <p class={styles.cardNote}>
          This goal works with the saturated fat limit. It shows if unsaturated fat took the place of the
          saturated fat you cut.
        </p>
      )}
      {key === 'sugars' && (
        <p class={styles.cardNote}>
          This goal counts all sugars, like your labels, also the natural sugar in fruit and milk.
        </p>
      )}
    </GoalCard>
  )

  return (
    <EditScreen title={title} onClose={onClose}>
      {group === 'salt' && (
        <div class={styles.showAs}>
          <span class={styles.caption}>Show as</span>
          <div class={styles.segmented}>
            {(['salt', 'sodium'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                aria-pressed={saltUnit === unit}
                class={`${styles.segment} ${saltUnit === unit ? styles.segmentActive : ''}`}
                onClick={() => changeSaltUnit(unit)}
              >
                {unit === 'salt' ? 'Salt (g)' : 'Sodium (mg)'}
              </button>
            ))}
          </div>
          <span class={styles.caption}>Today and Overview use the same unit.</span>
        </div>
      )}

      {keys.map(card)}

      {group === 'fat' && (
        <>
          {unsaturatedAboveFatMax(goalsFromDrafts(), ctx) && (
            <p class={styles.warning}>
              ⚠️ Your unsaturated fat minimum is above your total fat maximum, so no day can meet both.
            </p>
          )}
          <p class={styles.footnote}>
            Labels give only fat and saturated fat. So unsaturated fat is fat minus saturated fat. It is a rough
            value, but good enough for a trend.
          </p>
        </>
      )}
      {group === 'salt' && (
        <p class={styles.footnote}>
          EU labels calculate salt from all the sodium in the food (sodium × 2.5). Potassium in low-sodium salt
          does not count.
        </p>
      )}

      <button type="button" class={styles.saveButton} disabled={!canSave} onClick={save}>
        Save
      </button>
    </EditScreen>
  )
}
