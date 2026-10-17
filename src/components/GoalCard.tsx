import type { ComponentChildren } from 'preact'
import type { GoalKey, GoalUnit } from '../db/index'
import { shortDate } from '../db/dates'
import type { LatestWeight } from '../hooks/useLatestWeight'
import {
  fromGrams,
  GOALS,
  matchPreset,
  minAboveMax,
  roundForUnit,
  SODIUM_MG_PER_SALT_G,
  toGrams,
  UNIT_OPTIONS,
  UNIT_TEXT,
  type GoalContext,
} from '../utils/goals'
import { parseDecimal } from '../utils/nutrients'
import { NumericInput } from './NumericInput'
import { Switch } from './Switch'
import styles from './GoalCard.module.css'

/** A goal while it is edited. The fields hold text, in the unit on the screen. */
export interface GoalDraft {
  on: boolean
  unit: GoalUnit
  min: string
  max: string
}

export type SaltUnit = 'salt' | 'sodium'

/** Salt shows as grams of salt or milligrams of sodium. Everything else shows as stored. */
const displayScale = (key: GoalKey, saltUnit: SaltUnit) =>
  key === 'salt' && saltUnit === 'sodium' ? SODIUM_MG_PER_SALT_G : 1

/** The draft's numbers in the stored unit (grams of salt for salt). */
export function draftValues(draft: GoalDraft, key: GoalKey, saltUnit: SaltUnit): { min?: number; max?: number } {
  const scale = displayScale(key, saltUnit)
  const read = (text: string) => {
    const value = parseDecimal(text)
    return value === undefined ? undefined : Math.round((value / scale) * 10000) / 10000
  }
  return { min: read(draft.min), max: read(draft.max) }
}

/** Text for a field from a stored number. */
export function valueText(value: number | undefined, key: GoalKey, saltUnit: SaltUnit): string {
  if (value === undefined) return ''
  return String(Math.round(value * displayScale(key, saltUnit) * 100) / 100)
}

export function draftHasError(draft: GoalDraft): boolean {
  return draft.on && minAboveMax(parseDecimal(draft.min), parseDecimal(draft.max))
}

const grams = (g: number) => String(g < 10 ? Math.round(g * 10) / 10 : Math.round(g))

interface GoalCardProps {
  goalKey: GoalKey
  draft: GoalDraft
  onChange: (draft: GoalDraft) => void
  /** The daily average of the calorie settings and the latest weight. */
  ctx: GoalContext
  weight: LatestWeight
  saltUnit: SaltUnit
  /** Notes inside the card, under the goal. */
  children?: ComponentChildren
}

export function GoalCard({ goalKey, draft, onChange, ctx, weight, saltUnit, children }: GoalCardProps) {
  const config = GOALS[goalKey]
  const sodium = goalKey === 'salt' && saltUnit === 'sodium'
  const title = sodium ? 'Sodium' : config.title
  const values = draftValues(draft, goalKey, saltUnit)
  const preset = matchPreset(config.presets, { unit: draft.unit, ...values })
  const error = draftHasError(draft)
  const both = config.hasMin && config.hasMax
  const unitText = goalKey === 'salt' ? (sodium ? 'mg sodium' : 'g salt') : UNIT_TEXT[draft.unit]

  const set = (patch: Partial<GoalDraft>) => onChange({ ...draft, ...patch })

  const pickPreset = (p: (typeof config.presets)[number]) =>
    set({ unit: p.unit, min: valueText(p.min, goalKey, saltUnit), max: valueText(p.max, goalKey, saltUnit) })

  // A change of unit converts the numbers, with the daily average and the latest weight.
  const changeUnit = (unit: GoalUnit) => {
    const convert = (text: string) => {
      const value = parseDecimal(text)
      if (value === undefined) return text
      const g = toGrams(value, draft.unit, goalKey, ctx)
      const next = g === undefined ? undefined : fromGrams(g, unit, goalKey, ctx)
      return next === undefined ? text : String(roundForUnit(next, unit))
    }
    set({ unit, min: convert(draft.min), max: convert(draft.max) })
  }

  const unitSelect = (
    <select
      class={styles.select}
      aria-label={`${title} unit`}
      value={draft.unit}
      onChange={(e) => changeUnit((e.target as HTMLSelectElement).value as GoalUnit)}
    >
      {config.units.map((u) => (
        <option key={u} value={u}>{UNIT_OPTIONS[u]}</option>
      ))}
    </select>
  )

  const field = (side: 'min' | 'max', inlineUnit: boolean) => {
    const id = `goal-${goalKey}-${side}`
    return (
      <div class={styles.fieldRow}>
        <label for={id} class={styles.fieldLabel}>{side === 'min' ? 'At least' : 'At most'}</label>
        <NumericInput
          id={id}
          type="text"
          inputMode="decimal"
          class={`${styles.input} ${error ? styles.inputError : ''}`}
          value={draft[side]}
          onInput={(e) => {
            const text = (e.target as HTMLInputElement).value
            set(side === 'min' ? { min: text } : { max: text })
          }}
        />
        {inlineUnit && config.units.length > 1 ? unitSelect : <span class={styles.unit}>{unitText}</span>}
      </div>
    )
  }

  return (
    <div class={styles.card}>
      <div class={styles.header}>
        <h2 class={styles.title}>{title}</h2>
        <Switch checked={draft.on} onChange={(on) => set({ on })} label={`${title} goal`} />
      </div>

      {draft.on && (
        <div class={styles.body}>
          <div class={styles.presets}>
            <span class={styles.caption}>Preset</span>
            <div class={styles.chips}>
              {config.presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  class={`${styles.chip} ${p === preset ? styles.chipSelected : ''}`}
                  aria-pressed={p === preset}
                  onClick={() => pickPreset(p)}
                >
                  {sodium && p.sodiumLabel ? p.sodiumLabel : p.label}
                </button>
              ))}
              {/* "Own" is selected when no preset matches. A tap only moves to the first field. */}
              <button
                type="button"
                class={`${styles.chip} ${!preset ? styles.chipSelected : ''}`}
                aria-pressed={!preset}
                onClick={() => document.getElementById(`goal-${goalKey}-${config.hasMin ? 'min' : 'max'}`)?.focus()}
              >
                Own
              </button>
            </div>
          </div>

          {both && config.units.length > 1 && (
            <div class={styles.fieldRow}>
              <span class={styles.fieldLabel}>Unit</span>
              {unitSelect}
            </div>
          )}
          {config.hasMin && field('min', !both)}
          {config.hasMax && field('max', !both)}

          {error && (
            <p role="alert" class={styles.error}>The minimum is above the maximum. Change one of them to save.</p>
          )}
          <HelpLine goalKey={goalKey} unit={draft.unit} values={values} ctx={ctx} weight={weight} saltUnit={saltUnit} presetLabel={preset?.label} />
          {both && <p class={styles.help}>Leave a field empty for no limit on that side.</p>}

          {children}

          <p class={styles.help}>{config.kindNote}</p>
        </div>
      )}
    </div>
  )
}

interface HelpLineProps {
  goalKey: GoalKey
  unit: GoalUnit
  values: { min?: number; max?: number }
  ctx: GoalContext
  weight: LatestWeight
  saltUnit: SaltUnit
  presetLabel?: string
}

/** What the goal means in grams, or why it has no grams. */
function HelpLine({ goalKey, unit, values, ctx, weight, saltUnit, presetLabel }: HelpLineProps) {
  const { min, max } = values
  if (min === undefined && max === undefined && unit !== 'gPerKg') return null

  const range = () => {
    const a = min === undefined ? undefined : toGrams(min, unit, goalKey, ctx)
    const b = max === undefined ? undefined : toGrams(max, unit, goalKey, ctx)
    if (a !== undefined && b !== undefined) return `${grams(a)}–${grams(b)} g`
    if (a !== undefined) return `${grams(a)} g`
    if (b !== undefined) return `${grams(b)} g`
    return null
  }

  if (goalKey === 'salt') {
    const sodium = saltUnit === 'sodium'
    const other = (g: number) => (sodium ? `${Math.round(g * 100) / 100} g salt` : `${Math.round(g * SODIUM_MG_PER_SALT_G)} mg sodium`)
    const parts = [
      min !== undefined ? `at least ${other(min)}` : null,
      max !== undefined ? `at most ${other(max)}` : null,
    ].filter(Boolean)
    return <p class={styles.help}>That is {parts.join(' and ')}.</p>
  }

  if (unit === 'gPerKg') {
    const text = range()
    return (
      <>
        <p class={styles.weight}>
          {weight.weightKg
            ? <>Weight: <strong>{weight.weightKg} kg</strong> {weight.date ? `(last weigh-in, ${shortDate(weight.date)})` : '(the weight you last used in a calculator)'}</>
            : 'No weight yet. Log your weight on Today to use g/kg.'}
        </p>
        {text && <p class={styles.help}>That is {text} a day.</p>}
      </>
    )
  }

  if (unit === 'g') {
    return (
      <p class={styles.help}>
        {goalKey === 'protein' || goalKey === 'carbs'
          ? 'A fixed amount. It does not follow your weight or calorie target.'
          : 'A fixed amount. It does not follow your calorie target.'}
      </p>
    )
  }

  const text = range()
  if (!text) return null
  const nordic = goalKey === 'fiber' && presetLabel === GOALS.fiber.presets[2].label
  return (
    <p class={styles.help}>
      {nordic && '3 g per MJ is 12.6 g per 1000 kcal. '}About {text} a day
    </p>
  )
}
