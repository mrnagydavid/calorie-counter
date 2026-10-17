import type { GoalStatus } from '../utils/goalProgress'

/** Texts shared by the Overview's Nutrition tab and the goal detail screens. */
export const CAVEAT = 'Foods without nutrient data are missing from these numbers, so your real amounts can be higher.'

export const COUNT_RULE = 'A day counts when at least half of its kcal has nutrient data. Today counts after it ends.'

export const STATUS_TEXT: Record<GoalStatus, string> = {
  within: 'Within goal',
  above: 'Above goal',
  below: 'Below goal',
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
