import type { DailyTarget, GoalKey, GoalUnit, IntakeEntry } from '../db/index'
import { formatDate, parseDate, shiftDate } from '../db/dates'
import { fromGrams, goalGrams, hasLimit, SODIUM_MG_PER_SALT_G, type GramRange } from './goals'
import { hasNutrients, sumNutrients, type NutrientSums, type NutrientTotal } from './nutrients'

/** What the progress screens need of one day. */
export interface DayData {
  date: string
  /** The stored row. A day without a row, or without the goal in its copy, has no goal. */
  row?: DailyTarget
  intakes: IntakeEntry[]
  burned: number
}

/** The kcal a day's "% of kcal" goals use: the base target plus that day's burns. */
export function dayKcal(row: DailyTarget, burned: number): number {
  return row.target + burned
}

/** A nutrient's total. Unsaturated fat counts only entries with both fat and saturated fat. */
export function goalTotal(sums: NutrientSums, key: GoalKey): NutrientTotal {
  return key === 'unsaturatedFat' ? sums.unsaturated : sums.totals[key]
}

function hasValue(entry: IntakeEntry, key: GoalKey): boolean {
  const n = entry.unitNutrients
  if (!n) return false
  return key === 'unsaturatedFat' ? n.fat !== undefined && n.saturatedFat !== undefined : n[key] !== undefined
}

const kcalShare = (intakes: IntakeEntry[], covered: (e: IntakeEntry) => boolean): number => {
  const total = intakes.reduce((sum, e) => sum + e.calories, 0)
  if (total <= 0) return intakes.some(covered) ? 1 : 0
  return intakes.reduce((sum, e) => sum + (covered(e) ? e.calories : 0), 0) / total
}

/** The share of a day's kcal from entries with any nutrient data. */
export function kcalCoverage(intakes: IntakeEntry[]): number {
  return kcalShare(intakes, (e) => hasNutrients(e.unitNutrients))
}

/**
 * A day counts for a goal when at least half of its kcal comes from entries with a value for
 * that nutrient. A day with almost no data would pull the averages down.
 */
export function isCounted(intakes: IntakeEntry[], key: GoalKey): boolean {
  return intakes.length > 0 && kcalShare(intakes, (e) => hasValue(e, key)) >= 0.5
}

export interface DayGoal {
  amount: number
  grams: GramRange
  kcal: number
}

/** A counted day's amount and goal in grams. Undefined when the day has no goal or does not count. */
export function dayGoal(day: DayData, key: GoalKey): DayGoal | undefined {
  const goal = day.row?.nutrientGoals?.[key]
  if (!day.row || !hasLimit(goal) || !isCounted(day.intakes, key)) return undefined
  const kcal = dayKcal(day.row, day.burned)
  const grams = goalGrams(goal, key, { kcal, weightKg: day.row.weightKg })
  if (!grams) return undefined
  return { amount: goalTotal(sumNutrients(day.intakes), key).total, grams, kcal }
}

export type GoalStatus = 'within' | 'above' | 'below'

export function statusOf(amount: number, grams: GramRange): GoalStatus {
  if (grams.max !== undefined && amount > grams.max) return 'above'
  if (grams.min !== undefined && amount < grams.min) return 'below'
  return 'within'
}

/** A habit goal over some days: sums of the amounts and of each day's goal, in grams. */
export interface HabitResult {
  days: number
  amount: number
  kcal: number
  /** A side counts only when every counted day has it. */
  min?: number
  max?: number
  status: GoalStatus
}

/**
 * Sums stay correct when the goal or its unit changed inside the window: each day brings its
 * own goal in grams.
 */
export function habitResult(days: DayData[], key: GoalKey): HabitResult | undefined {
  const goals = days.map((d) => dayGoal(d, key)).filter((g) => g !== undefined)
  if (goals.length === 0) return undefined
  const sum = (f: (g: DayGoal) => number) => goals.reduce((s, g) => s + f(g), 0)
  const amount = sum((g) => g.amount)
  const min = goals.every((g) => g.grams.min !== undefined) ? sum((g) => g.grams.min!) : undefined
  const max = goals.every((g) => g.grams.max !== undefined) ? sum((g) => g.grams.max!) : undefined
  return { days: goals.length, amount, kcal: sum((g) => g.kcal), min, max, status: statusOf(amount, { min, max }) }
}

/** A sum of grams over the result's days, in a goal's unit. "% of kcal" divides by the sum of the targets. */
export function inUnit(gramsSum: number, result: HabitResult, unit: GoalUnit, key: GoalKey, weightKg?: number) {
  return fromGrams(gramsSum / result.days, unit, key, { kcal: result.kcal / result.days, weightKg })
}

/** "7.6%", "23.0 g", "1.45 g/kg", "12.1 g per 1000 kcal", "1920 mg". */
export function formatInUnit(value: number, unit: GoalUnit, key: GoalKey, saltUnit?: 'salt' | 'sodium'): string {
  if (key === 'salt' && saltUnit === 'sodium') return `${Math.round(value * SODIUM_MG_PER_SALT_G)} mg`
  switch (unit) {
    case 'pctKcal':
      return `${value.toFixed(1)}%`
    case 'gPerKg':
      return `${value.toFixed(2)} g/kg`
    case 'gPer1000Kcal':
      return `${value.toFixed(1)} g per 1000 kcal`
    case 'g':
      return `${value.toFixed(1)} g`
  }
}

/**
 * The average amount over the counted days that have a row, in a unit, with or without a goal.
 * For the weeks with no goal on the charts, and the "last 4 weeks" line in the Fat form.
 */
export function averageInUnit(days: DayData[], key: GoalKey, unit: GoalUnit, weightKg?: number): number | undefined {
  const counted = days.filter((d) => d.row && isCounted(d.intakes, key))
  if (counted.length === 0) return undefined
  const amount = counted.reduce((s, d) => s + goalTotal(sumNutrients(d.intakes), key).total, 0)
  const kcal = counted.reduce((s, d) => s + dayKcal(d.row!, d.burned), 0)
  return fromGrams(amount / counted.length, unit, key, { kcal: kcal / counted.length, weightKg })
}

export type DayMark = 'met' | 'missed' | 'none'

/** A daily goal on one day. "none": no goal, or the day does not count. */
export function dayMark(day: DayData, key: GoalKey): DayMark {
  const g = dayGoal(day, key)
  if (!g) return 'none'
  return statusOf(g.amount, g.grams) === 'within' ? 'met' : 'missed'
}

export interface DailyResult {
  met: number
  counted: number
  marks: DayMark[]
}

export function dailyResult(days: DayData[], key: GoalKey): DailyResult {
  const marks = days.map((d) => dayMark(d, key))
  return { met: marks.filter((m) => m === 'met').length, counted: marks.filter((m) => m !== 'none').length, marks }
}

/** The N days before today, oldest first. Today counts after it ends. */
export function daysBefore(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDate(today, i - n))
}

/** The Monday of a date's week. */
export function mondayOf(date: string): string {
  const d = parseDate(date)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return formatDate(d)
}

/** The dates of the last N weeks (Monday to Sunday), oldest first. The current week ends yesterday. */
export function weeksBefore(today: string, n: number): string[][] {
  const firstMonday = shiftDate(mondayOf(today), -7 * (n - 1))
  return Array.from({ length: n }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => shiftDate(firstMonday, w * 7 + d)).filter((date) => date < today),
  )
}
