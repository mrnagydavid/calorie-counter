import type { DayOfWeek, GoalKey, GoalUnit, NutrientGoal, NutrientGoals, WeightEntry } from '../db/index'

/** The order of the goals in the Settings summary and on the Overview. */
export const GOAL_KEYS: GoalKey[] = [
  'saturatedFat',
  'unsaturatedFat',
  'fat',
  'carbs',
  'sugars',
  'fiber',
  'protein',
  'salt',
]

/** A habit goal is judged on averages over weeks. A daily goal is judged day by day. */
export type GoalKind = 'habit' | 'daily'

export interface GoalPreset {
  label: string
  /** The label when salt shows as sodium. */
  sodiumLabel?: string
  unit: GoalUnit
  min?: number
  max?: number
}

export interface GoalConfig {
  title: string
  /** The label in a form with more than one goal: "Saturated: at most 7% of kcal". */
  short: string
  kind: GoalKind
  hasMin: boolean
  hasMax: boolean
  /** The first unit is the default. */
  units: GoalUnit[]
  /** Needed to turn "% of kcal" into grams. */
  kcalPerGram?: number
  kindNote: string
  presets: GoalPreset[]
}

const HABIT_NOTE = 'Judged on your average over weeks.'

// Sources of the presets: plan-macro-goals.md and Settings > Legal > Terms & Conditions.
export const GOALS: Record<GoalKey, GoalConfig> = {
  saturatedFat: {
    title: 'Saturated fat',
    short: 'Saturated',
    kind: 'habit',
    hasMin: false,
    hasMax: true,
    units: ['pctKcal', 'g'],
    kcalPerGram: 9,
    kindNote: `${HABIT_NOTE} One high day does not matter.`,
    presets: [
      { label: 'WHO · US · Nordic 10%', unit: 'pctKcal', max: 10 },
      { label: 'ESC, high LDL 7%', unit: 'pctKcal', max: 7 },
      { label: 'AHA, high LDL 6%', unit: 'pctKcal', max: 6 },
    ],
  },
  unsaturatedFat: {
    title: 'Unsaturated fat',
    short: 'Unsaturated',
    kind: 'habit',
    hasMin: true,
    hasMax: false,
    units: ['pctKcal'],
    kcalPerGram: 9,
    kindNote: `${HABIT_NOTE} One low day does not matter.`,
    // Monounsaturated 10% + polyunsaturated 5%: the sum of the Nordic minimums
    presets: [{ label: 'Nordic ≥ 15% (derived)', unit: 'pctKcal', min: 15 }],
  },
  fat: {
    title: 'Total fat',
    short: 'Total',
    kind: 'habit',
    hasMin: true,
    hasMax: true,
    units: ['pctKcal', 'g'],
    kcalPerGram: 9,
    kindNote: `${HABIT_NOTE} One day does not matter.`,
    presets: [
      { label: 'EU · US 20–35%', unit: 'pctKcal', min: 20, max: 35 },
      { label: 'Nordic 25–40%', unit: 'pctKcal', min: 25, max: 40 },
      { label: 'WHO ≤ 30%', unit: 'pctKcal', max: 30 },
    ],
  },
  carbs: {
    title: 'Carbs',
    short: 'Carbs',
    kind: 'daily',
    hasMin: true,
    hasMax: true,
    units: ['pctKcal', 'g', 'gPerKg'],
    kcalPerGram: 4,
    kindNote: 'Judged day by day.',
    presets: [
      { label: 'EU · Nordic 45–60%', unit: 'pctKcal', min: 45, max: 60 },
      { label: 'US 45–65%', unit: 'pctKcal', min: 45, max: 65 },
    ],
  },
  sugars: {
    title: 'Sugars',
    short: 'Sugars',
    kind: 'habit',
    hasMin: false,
    hasMax: true,
    units: ['g', 'pctKcal'],
    kcalPerGram: 4,
    kindNote: `${HABIT_NOTE} One high day does not matter.`,
    // Only a limit the app can measure: labels give total sugars. WHO, Nordic and US limits
    // count added sugars only (US: per meal), so they have no chip.
    presets: [{ label: 'EU label 90 g', unit: 'g', max: 90 }],
  },
  fiber: {
    title: 'Fiber',
    short: 'Fiber',
    kind: 'habit',
    hasMin: true,
    hasMax: true,
    units: ['g', 'gPer1000Kcal'],
    kindNote: `${HABIT_NOTE} One low day does not matter.`,
    presets: [
      { label: 'WHO · EU 25 g', unit: 'g', min: 25 },
      { label: 'US 14 g per 1000 kcal', unit: 'gPer1000Kcal', min: 14 },
      // 3 g per MJ is 12.55 g per 1000 kcal
      { label: 'Nordic 3 g per MJ', unit: 'gPer1000Kcal', min: 12.6 },
    ],
  },
  protein: {
    title: 'Protein',
    short: 'Protein',
    kind: 'daily',
    hasMin: true,
    hasMax: true,
    units: ['gPerKg', 'pctKcal', 'g'],
    kcalPerGram: 4,
    kindNote: 'Judged day by day. Your body does not store protein.',
    presets: [
      { label: 'EU · WHO 0.83 g/kg', unit: 'gPerKg', min: 0.83 },
      { label: 'US 2025: 1.2–1.6 g/kg', unit: 'gPerKg', min: 1.2, max: 1.6 },
      { label: 'Nordic 10–20%', unit: 'pctKcal', min: 10, max: 20 },
      { label: 'Nordic, 65+: 1.2–1.5 g/kg', unit: 'gPerKg', min: 1.2, max: 1.5 },
    ],
  },
  salt: {
    title: 'Salt',
    short: 'Salt',
    kind: 'habit',
    hasMin: true,
    hasMax: true,
    units: ['g'],
    kindNote: `${HABIT_NOTE} One salty meal does not matter.`,
    presets: [
      { label: 'WHO 5 g', sodiumLabel: 'WHO 2000 mg', unit: 'g', max: 5 },
      { label: 'US · Nordic 5.75 g', sodiumLabel: 'US · Nordic 2300 mg', unit: 'g', max: 5.75 },
      { label: 'AHA, ideal 3.75 g', sodiumLabel: 'AHA, ideal 1500 mg', unit: 'g', max: 3.75 },
    ],
  },
}

export type GoalGroupId = 'fat' | 'carbohydrate' | 'fiber' | 'protein' | 'salt'

/** One mini-form for each group, in the order of the Today NUTRITION section. */
export const GOAL_GROUPS: { id: GoalGroupId; title: string; keys: GoalKey[] }[] = [
  { id: 'fat', title: 'Fat', keys: ['saturatedFat', 'unsaturatedFat', 'fat'] },
  { id: 'carbohydrate', title: 'Carbohydrate', keys: ['carbs', 'sugars'] },
  { id: 'fiber', title: 'Fiber', keys: ['fiber'] },
  { id: 'protein', title: 'Protein', keys: ['protein'] },
  { id: 'salt', title: 'Salt', keys: ['salt'] },
]

/** Labels for the unit select. */
export const UNIT_OPTIONS: Record<GoalUnit, string> = {
  pctKcal: '% of kcal',
  g: 'g',
  gPerKg: 'g per kg of body weight',
  gPer1000Kcal: 'g per 1000 kcal',
}

/** Short labels after a number. */
export const UNIT_TEXT: Record<GoalUnit, string> = {
  pctKcal: '% of kcal',
  g: 'g',
  gPerKg: 'g/kg',
  gPer1000Kcal: 'g per 1000 kcal',
}

/** Milligrams of sodium in a gram of salt (salt = sodium × 2.5). */
export const SODIUM_MG_PER_SALT_G = 400

/** What a goal in "% of kcal" or g/kg needs to become grams. */
export interface GoalContext {
  kcal: number
  weightKg?: number
}

export function toGrams(value: number, unit: GoalUnit, key: GoalKey, ctx: GoalContext): number | undefined {
  switch (unit) {
    case 'g':
      return value
    case 'pctKcal': {
      const perGram = GOALS[key].kcalPerGram
      return perGram ? ((value / 100) * ctx.kcal) / perGram : undefined
    }
    case 'gPer1000Kcal':
      return (value * ctx.kcal) / 1000
    case 'gPerKg':
      return ctx.weightKg ? value * ctx.weightKg : undefined
  }
}

export function fromGrams(grams: number, unit: GoalUnit, key: GoalKey, ctx: GoalContext): number | undefined {
  switch (unit) {
    case 'g':
      return grams
    case 'pctKcal': {
      const perGram = GOALS[key].kcalPerGram
      return perGram && ctx.kcal > 0 ? ((grams * perGram) / ctx.kcal) * 100 : undefined
    }
    case 'gPer1000Kcal':
      return ctx.kcal > 0 ? (grams * 1000) / ctx.kcal : undefined
    case 'gPerKg':
      return ctx.weightKg ? grams / ctx.weightKg : undefined
  }
}

/** The precision a person types in each unit. */
export function roundForUnit(value: number, unit: GoalUnit): number {
  const decimals = unit === 'gPerKg' ? 2 : unit === 'g' ? (value < 10 ? 2 : 0) : 1
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export interface GramRange {
  min?: number
  max?: number
}

/** The goal in grams. Undefined when a limit cannot be converted (g/kg with no weight). */
export function goalGrams(goal: NutrientGoal, key: GoalKey, ctx: GoalContext): GramRange | undefined {
  const out: GramRange = {}
  for (const side of ['min', 'max'] as const) {
    const value = goal[side]
    if (value === undefined) continue
    const grams = toGrams(value, goal.unit, key, ctx)
    if (grams === undefined) return undefined
    out[side] = grams
  }
  return out
}

/** True when the goal has a number to judge by. */
export function hasLimit(goal: NutrientGoal | undefined): goal is NutrientGoal {
  return !!goal && (goal.min !== undefined || goal.max !== undefined)
}

/** The goals that are on and have a number, for the copy in a day's row. Undefined when none. */
export function activeGoals(goals: NutrientGoals | undefined): NutrientGoals | undefined {
  if (!goals) return undefined
  const out: NutrientGoals = {}
  for (const key of GOAL_KEYS) {
    const goal = goals[key]
    if (goal?.on && hasLimit(goal)) out[key] = { ...goal }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function usesWeight(goals: NutrientGoals | undefined): boolean {
  return !!goals && GOAL_KEYS.some((key) => goals[key]?.unit === 'gPerKg')
}

/** The latest weigh-in on or before a date. */
export function latestWeighIn(date: string, entries: WeightEntry[]): WeightEntry | undefined {
  let latest: WeightEntry | undefined
  for (const e of entries) {
    if (e.date > date) continue
    if (!latest || e.date > latest.date || (e.date === latest.date && e.createdAt > latest.createdAt)) latest = e
  }
  return latest
}

/** The latest weigh-in on or before a date, else the remembered weight. */
export function weightOn(date: string, entries: WeightEntry[], fallback?: number): number | undefined {
  return latestWeighIn(date, entries)?.weight ?? fallback
}

export function minAboveMax(min: number | undefined, max: number | undefined): boolean {
  return min !== undefined && max !== undefined && min > max
}

/** True when the unsaturated fat minimum is above the total fat maximum, so no day can meet both. */
export function unsaturatedAboveFatMax(goals: NutrientGoals, ctx: GoalContext): boolean {
  const unsat = goals.unsaturatedFat
  const fat = goals.fat
  if (!unsat?.on || !fat?.on || unsat.min === undefined || fat.max === undefined) return false
  const min = toGrams(unsat.min, unsat.unit, 'unsaturatedFat', ctx)
  const max = toGrams(fat.max, fat.unit, 'fat', ctx)
  return min !== undefined && max !== undefined && min > max
}

/** A preset matches when it has the same unit and the same numbers. */
export function matchPreset(
  presets: GoalPreset[],
  goal: { unit: GoalUnit; min?: number; max?: number },
): GoalPreset | undefined {
  const same = (a?: number, b?: number) =>
    a === undefined ? b === undefined : b !== undefined && Math.abs(a - b) < 1e-9
  return presets.find((p) => p.unit === goal.unit && same(p.min, goal.min) && same(p.max, goal.max))
}

export interface DescribeOptions {
  saltUnit?: 'salt' | 'sodium'
  /** Adds the grams to a g/kg goal: "at least 1.6 g/kg (141 g)". */
  weightKg?: number
}

const num = (n: number) => String(Math.round(n * 100) / 100)

/** "at most 7% of kcal", "at least 25 g", "45–60% of kcal", "at most 2000 mg sodium". */
export function describeGoal(goal: NutrientGoal, key: GoalKey, opts: DescribeOptions = {}): string {
  const { min, max } = goal
  let unitText = UNIT_TEXT[goal.unit]
  let scale = 1
  if (key === 'salt' && opts.saltUnit === 'sodium') {
    unitText = 'mg sodium'
    scale = SODIUM_MG_PER_SALT_G
  }
  const join = (value: string) => (goal.unit === 'pctKcal' ? `${value}${unitText}` : `${value} ${unitText}`)
  let text: string
  if (min !== undefined && max !== undefined) text = join(`${num(min * scale)}–${num(max * scale)}`)
  else if (min !== undefined) text = `at least ${join(num(min * scale))}`
  else if (max !== undefined) text = `at most ${join(num(max * scale))}`
  else return ''

  if (goal.unit === 'gPerKg' && opts.weightKg) {
    const grams = [min, max].filter((v) => v !== undefined).map((v) => Math.round(v! * opts.weightKg!))
    text += ` (${grams.join('–')} g)`
  }
  return text
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The Settings row: one line for each goal that is on, or "Off". */
export function groupSummary(keys: GoalKey[], goals: NutrientGoals | undefined, opts: DescribeOptions = {}): string[] {
  const lines = keys.flatMap((key) => {
    const goal = goals?.[key]
    if (!goal?.on || !hasLimit(goal)) return []
    const text = describeGoal(goal, key, opts)
    return [keys.length > 1 ? `${GOALS[key].short}: ${text}` : capitalize(text)]
  })
  return lines.length > 0 ? lines : ['Off']
}

const WEEK: { key: DayOfWeek; name: string }[] = [
  { key: 'monday', name: 'Monday' },
  { key: 'tuesday', name: 'Tuesday' },
  { key: 'wednesday', name: 'Wednesday' },
  { key: 'thursday', name: 'Thursday' },
  { key: 'friday', name: 'Friday' },
  { key: 'saturday', name: 'Saturday' },
  { key: 'sunday', name: 'Sunday' },
]

/** "Monday", "Monday and Friday", "Monday, Tuesday and Friday", in week order. */
export function dayNames(days: DayOfWeek[]): string {
  const names = WEEK.filter((d) => days.includes(d.key)).map((d) => d.name)
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
}

/** "Every day", "On Monday", "On Monday and Friday". */
export function daysText(days: DayOfWeek[]): string {
  return days.length === WEEK.length ? 'Every day' : `On ${dayNames(days)}`
}

export interface KcalWarningItem {
  label: string
  kcal: number
}

export interface KcalWarning {
  kind: 'min' | 'max'
  days: DayOfWeek[]
  target: number
  total: number
  items: KcalWarningItem[]
}

/**
 * Goals that no day of the week can meet within its calorie target (baseline or override,
 * not burns): the minimums need more kcal than the target, or the maximums of protein, carbs
 * and total fat together cannot reach it. Days with the same result are grouped.
 */
export function kcalWarnings(
  goals: NutrientGoals | undefined,
  baseline: number,
  overrides: Partial<Record<DayOfWeek, number>>,
  weightKg: number | undefined,
): KcalWarning[] {
  const on = activeGoals(goals)
  if (!on) return []
  const warnings: KcalWarning[] = []

  const add = (w: Omit<KcalWarning, 'days'>, day: DayOfWeek) => {
    const same = warnings.find((x) => x.kind === w.kind && x.target === w.target && x.total === w.total)
    if (same) same.days.push(day)
    else warnings.push({ ...w, days: [day] })
  }

  for (const { key: day } of WEEK) {
    const target = overrides[day] ?? baseline
    const ctx = { kcal: target, weightKg }
    const item = (key: GoalKey, side: 'min' | 'max', perGram: number) => {
      const goal = on[key]
      const value = goal?.[side]
      if (!goal || value === undefined) return undefined
      const grams = toGrams(value, goal.unit, key, ctx)
      if (grams === undefined) return undefined
      const limit = { ...goal, min: side === 'min' ? value : undefined, max: side === 'max' ? value : undefined }
      return { grams, label: `${GOALS[key].title}, ${describeGoal(limit, key, { weightKg })}`, kcal: grams * perGram }
    }

    // Unsaturated fat is part of total fat, so the larger fat minimum counts.
    const fatMins = [item('fat', 'min', 9), item('unsaturatedFat', 'min', 9)].filter((x) => x !== undefined)
    const fatMin = fatMins.sort((a, b) => b.grams - a.grams)[0]
    const mins = [item('protein', 'min', 4), item('carbs', 'min', 4), fatMin].filter((x) => x !== undefined)
    const minTotal = Math.round(mins.reduce((sum, x) => sum + x.kcal, 0))
    if (minTotal > target) {
      add({ kind: 'min', target, total: minTotal, items: mins.map((x) => ({ label: x.label, kcal: Math.round(x.kcal) })) }, day)
    }

    const maxes = [item('protein', 'max', 4), item('carbs', 'max', 4), item('fat', 'max', 9)]
    if (maxes.every((x) => x !== undefined)) {
      const maxTotal = Math.round(maxes.reduce((sum, x) => sum + x!.kcal, 0))
      if (maxTotal < target) {
        add({ kind: 'max', target, total: maxTotal, items: maxes.map((x) => ({ label: x!.label, kcal: Math.round(x!.kcal) })) }, day)
      }
    }
  }
  return warnings
}
