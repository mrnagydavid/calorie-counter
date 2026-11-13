import type { DailyTarget, GoalKey, GoalUnit, IntakeEntry } from '../db/index'
import { formatDate, parseDate, shiftDate } from '../db/dates'
import { fromGrams, GOAL_KEYS, GOALS, goalGrams, hasLimit, SODIUM_MG_PER_SALT_G, type GramRange } from './goals'
import { hasNutrients, sumNutrients, type NutrientSums, type NutrientTotal } from './nutrients'

/** What the progress screens need of one day. */
export interface DayData {
  date: string
  /** The stored row. A day without a row, or without the goal in its copy, has no goal. */
  row?: DailyTarget
  intakes: IntakeEntry[]
}

/** An intake, or an item of a meal plan. */
export type GoalEntry = Pick<IntakeEntry, 'calories' | 'quantity' | 'unitNutrients'>

/** A nutrient's total. Unsaturated fat counts only entries with both fat and saturated fat. */
export function goalTotal(sums: NutrientSums, key: GoalKey): NutrientTotal {
  return key === 'unsaturatedFat' ? sums.unsaturated : sums.totals[key]
}

function hasValue(entry: GoalEntry, key: GoalKey): boolean {
  const n = entry.unitNutrients
  if (!n) return false
  return key === 'unsaturatedFat' ? n.fat !== undefined && n.saturatedFat !== undefined : n[key] !== undefined
}

const kcalShare = (entries: GoalEntry[], covered: (e: GoalEntry) => boolean): number => {
  const total = entries.reduce((sum, e) => sum + e.calories, 0)
  if (total <= 0) return entries.some(covered) ? 1 : 0
  return entries.reduce((sum, e) => sum + (covered(e) ? e.calories : 0), 0) / total
}

/** The share of a day's kcal from entries with any nutrient data. */
export function kcalCoverage(entries: GoalEntry[]): number {
  return kcalShare(entries, (e) => hasNutrients(e.unitNutrients))
}

/**
 * A day counts for a goal when at least half of its kcal comes from entries with a value for
 * that nutrient. A day with almost no data would pull the averages down.
 */
export function isCounted(entries: GoalEntry[], key: GoalKey): boolean {
  return entries.length > 0 && kcalShare(entries, (e) => hasValue(e, key)) >= 0.5
}

/**
 * The kcal that a "% of kcal" goal is a share of: the kcal eaten, from entries with a value for
 * the nutrient. Why: the guidelines are shares of the energy eaten, and food without the value
 * adds kcal but no grams.
 */
export function coveredKcal(entries: GoalEntry[], key: GoalKey): number {
  return entries.reduce((sum, e) => sum + (hasValue(e, key) ? e.calories : 0), 0)
}

/** "% of kcal" and "per 1000 kcal" goals follow the kcal eaten. Grams and g/kg do not. */
export function followsKcal(unit: GoalUnit): boolean {
  return unit === 'pctKcal' || unit === 'gPer1000Kcal'
}

/**
 * The color of a goal on a day that has not ended.
 * - met: met if you stop eating now.
 * - behind: not met if you stop eating now, but the planned kcal that are left can still meet it.
 * - notYet: a goal in grams under its minimum that the planned kcal left can still meet.
 * - unreachable: the planned kcal left cannot meet it.
 */
export type LiveStatus = 'met' | 'behind' | 'notYet' | 'unreachable'

export interface LiveGoal {
  key: GoalKey
  amount: number
  /** The goal in grams if the planned kcal are eaten (the bar). On an ended day, for the kcal eaten. */
  goal: GramRange
  /** The goal for the kcal eaten so far, when it is not `goal`. It sets the color and the screen reader label. */
  soFar?: GramRange
  /** Absent on an ended day: its bar shows the result. */
  status?: LiveStatus
}

/**
 * The goals of a day on Today and in the Meal planner. The planned kcal are the target plus
 * burns. A goal that follows kcal is a share of the kcal eaten, as on the Overview, so a day
 * that is green at midnight is also green the next day. The rest of the planned kcal can be
 * eaten with none of the nutrient (a maximum) or with the food that has the most of it (a
 * minimum). Eating more than the plan does not count, because the app must not suggest it.
 */
export function liveGoals(row: DailyTarget | undefined, burned: number, entries: GoalEntry[], dayEnded: boolean): LiveGoal[] {
  const goals = row?.nutrientGoals
  if (!row || !goals) return []
  const eaten = entries.reduce((sum, e) => sum + e.calories, 0)
  const left = dayEnded ? 0 : Math.max(0, row.target + burned - eaten)
  const sums = sumNutrients(entries)
  return GOAL_KEYS.flatMap((key): LiveGoal[] => {
    const goal = goals[key]
    if (!hasLimit(goal)) return []
    const byKcal = followsKcal(goal.unit)
    const covered = coveredKcal(entries, key)
    if (byKcal && covered + left <= 0) return []
    const ctx = (kcal: number) => ({ kcal, weightKg: row.weightKg })
    const soFar = goalGrams(goal, key, ctx(covered))
    const full = byKcal ? goalGrams(goal, key, ctx(covered + left)) : soFar
    if (!soFar || !full) return []
    const amount = goalTotal(sums, key).total
    if (dayEnded) return [{ key, amount, goal: full }]

    const most = GOALS[key].mostPerKcal
    const canMeetMax = full.max === undefined || amount <= full.max
    const canMeetMin =
      full.min === undefined ||
      (soFar.min !== undefined && amount >= soFar.min) ||
      most === undefined ||
      amount + most * left >= full.min
    const status: LiveStatus =
      statusOf(amount, soFar) === 'within'
        ? 'met'
        : !canMeetMax || !canMeetMin
          ? 'unreachable'
          : byKcal
            ? 'behind'
            : 'notYet'
    return [{ key, amount, goal: full, soFar: byKcal && left > 0 ? soFar : undefined, status }]
  })
}

export interface DayGoal {
  amount: number
  grams: GramRange
  /** The kcal of the entries with a value for the nutrient. */
  kcal: number
}

/** A counted day's amount and goal in grams. Undefined when the day has no goal or does not count. */
export function dayGoal(day: DayData, key: GoalKey): DayGoal | undefined {
  const goal = day.row?.nutrientGoals?.[key]
  if (!day.row || !hasLimit(goal) || !isCounted(day.intakes, key)) return undefined
  const kcal = coveredKcal(day.intakes, key)
  if (followsKcal(goal.unit) && kcal <= 0) return undefined
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

/** A sum of grams over the result's days, in a goal's unit. "% of kcal" divides by the sum of the kcal eaten. */
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
  const kcal = counted.reduce((s, d) => s + coveredKcal(d.intakes, key), 0)
  return fromGrams(amount / counted.length, unit, key, { kcal: kcal / counted.length, weightKg })
}

export type DayMark = 'met' | 'close' | 'missed' | 'none'

/**
 * A missed day is "close" when it misses by this share of the goal or less. At the same point
 * a past day's bar on Today turns yellow, so the two screens agree.
 */
export const CLOSE_SHARE = 0.1

function isClose(amount: number, grams: GramRange): boolean {
  if (grams.max !== undefined && amount > grams.max) return amount <= grams.max * (1 + CLOSE_SHARE)
  if (grams.min !== undefined && amount < grams.min) return amount >= grams.min * (1 - CLOSE_SHARE)
  return true
}

/** A daily goal on one day. "none": no goal, or the day does not count. */
export function dayMark(day: DayData, key: GoalKey): DayMark {
  const g = dayGoal(day, key)
  if (!g) return 'none'
  if (statusOf(g.amount, g.grams) === 'within') return 'met'
  return isClose(g.amount, g.grams) ? 'close' : 'missed'
}

/** The side on which a counted day missed its goal. Undefined when it met the goal or does not count. */
export function missSide(day: DayData, key: GoalKey): 'above' | 'below' | undefined {
  const g = dayGoal(day, key)
  if (!g) return undefined
  const status = statusOf(g.amount, g.grams)
  return status === 'within' ? undefined : status
}

export interface DailyResult {
  met: number
  close: number
  counted: number
  marks: DayMark[]
}

export function dailyResult(days: DayData[], key: GoalKey): DailyResult {
  const marks = days.map((d) => dayMark(d, key))
  const count = (mark: DayMark) => marks.filter((m) => m === mark).length
  return { met: count('met'), close: count('close'), counted: marks.length - count('none'), marks }
}

/** A whole number for % and g, two decimals for g/kg. */
const DAY_DECIMALS: Record<GoalUnit, number> = { pctKcal: 0, g: 0, gPerKg: 2, gPer1000Kcal: 1 }

/**
 * A counted day's amount in a goal's unit, for a calendar cell: "44%", "182 g", "1.15". A missed
 * day rounds away from its goal, so a cell never shows "45%" for a day under a minimum of 45%.
 */
export function dayAmountText(day: DayData, key: GoalKey, unit: GoalUnit, weightKg?: number): string | undefined {
  const g = dayGoal(day, key)
  if (!g) return undefined
  const value = fromGrams(g.amount, unit, key, { kcal: g.kcal, weightKg: day.row?.weightKg ?? weightKg })
  if (value === undefined) return undefined
  const factor = 10 ** DAY_DECIMALS[unit]
  const status = statusOf(g.amount, g.grams)
  // The tolerance keeps float noise from moving a number: 1.15 * 100 is 114.99999999999999
  const scaled = value * factor
  const rounded = status === 'below' ? Math.floor(scaled + 1e-9) : status === 'above' ? Math.ceil(scaled - 1e-9) : Math.round(scaled)
  const text = (rounded / factor).toFixed(DAY_DECIMALS[unit])
  return unit === 'pctKcal' ? `${text}%` : unit === 'g' ? `${text} g` : text
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
