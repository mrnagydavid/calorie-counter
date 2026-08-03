import type { ActivityKind } from '../db/index'

/**
 * Energy cost of an activity, always NET of resting metabolism.
 *
 * The daily target already covers a full day at rest, so a burn entry must only
 * add the extra above rest — otherwise the resting calories spent during the
 * activity get counted twice and the budget quietly inflates. Every function
 * here subtracts 1 MET for the duration.
 */

/** 1 MET = 3.5 ml O2/kg/min, 1 L O2 ~ 5 kcal, so 0.0175 kcal/kg/min at rest. */
const RESTING_KCAL_PER_KG_MIN = (3.5 * 5) / 1000

/**
 * The ACSM gait equations split oxygen cost into a horizontal and a resting
 * term: walking VO2 = 0.1*S + 3.5, running VO2 = 0.2*S + 3.5 (S in m/min).
 * Dropping the 3.5 leaves a per-km cost that speed cancels out of, so distance
 * and body mass are all we need — no pace, no duration.
 */
const NET_KCAL_PER_KG_KM: Record<'walk' | 'run', number> = { walk: 0.5, run: 1.0 }

/**
 * Fallback max heart rate when the rider hasn't set their own. Erring high here
 * errs low on calories, which is the direction we want, so the default itself
 * carries no extra correction.
 */
export const DEFAULT_MAX_HR = 180

/**
 * Assumed aerobic capacity in ml O2/kg/min, deliberately at the LOW end of the
 * plausible range.
 *
 * This is the ONE place a conservative bias is applied. An overstated burn
 * inflates the day's budget and the error compounds against you; an understated
 * one is self-correcting. Do not add further margin elsewhere — stacked safety
 * factors multiply into a number too low to be useful. Raise this toward 40
 * (neutral, average fitness) if real rides come out consistently understated.
 */
const ASSUMED_VO2MAX = 35

/** Below this share of max HR the linear fit degenerates, so results are clamped. */
const MIN_USEFUL_HR_FRACTION = 0.5

export interface ActivityInputs {
  kind: ActivityKind
  weightKg: number
  distanceKm?: number // walk, run
  durationMin?: number // bike
  avgHr?: number // bike
  maxHr?: number // bike, defaults to DEFAULT_MAX_HR
}

export function netWalkKcal(distanceKm: number, weightKg: number): number {
  return NET_KCAL_PER_KG_KM.walk * weightKg * distanceKm
}

export function netRunKcal(distanceKm: number, weightKg: number): number {
  return NET_KCAL_PER_KG_KM.run * weightKg * distanceKm
}

/**
 * Effort as a MET value, from heart rate read as a share of maximum.
 *
 * Absolute bpm says nothing on its own — 130 is easy at one max HR and hard at
 * another — so intensity goes through %HRmax, converted with Swain's relation
 * (%VO2max = 1.41 * %HRmax - 42) and scaled by assumed aerobic capacity.
 *
 * The earlier Keytel equation was dropped because it carries no fitness term at
 * all: it maps heart rate to energy at whatever fitness its cohort had, and that
 * cohort was fitter than average, so it overstated every ride.
 */
export function metFromHeartRate(avgHr: number, maxHr: number = DEFAULT_MAX_HR): number {
  const pctMax = (avgHr / maxHr) * 100
  const pctVo2Max = 1.41 * pctMax - 42
  const met = (ASSUMED_VO2MAX / 3.5) * (pctVo2Max / 100)
  return Math.max(1, met) // 1 MET is rest — never below it
}

export function netBikeKcal(
  durationMin: number,
  avgHr: number,
  weightKg: number,
  maxHr: number = DEFAULT_MAX_HR,
): number {
  const met = metFromHeartRate(avgHr, maxHr)
  return (met - 1) * RESTING_KCAL_PER_KG_MIN * weightKg * durationMin
}

/** Net kcal rounded to a whole number, or null when the inputs are incomplete. */
export function calcNetKcal(i: ActivityInputs): number | null {
  if (!(i.weightKg > 0)) return null

  if (i.kind === 'walk' || i.kind === 'run') {
    if (!(i.distanceKm && i.distanceKm > 0)) return null
    const kcal = i.kind === 'walk'
      ? netWalkKcal(i.distanceKm, i.weightKg)
      : netRunKcal(i.distanceKm, i.weightKg)
    return Math.round(kcal)
  }

  if (!(i.durationMin && i.durationMin > 0)) return null
  if (!(i.avgHr && i.avgHr > 0)) return null
  return Math.round(netBikeKcal(i.durationMin, i.avgHr, i.weightKg, i.maxHr))
}

/** Auto-generated entry name, e.g. "Run · 5 km" or "Bike · 45 min @ 132 bpm". */
export function activityName(i: ActivityInputs): string {
  if (i.kind === 'walk' || i.kind === 'run') {
    const label = i.kind === 'walk' ? 'Walk' : 'Run'
    return i.distanceKm ? `${label} · ${i.distanceKm} km` : label
  }
  if (i.durationMin && i.avgHr) return `Bike · ${i.durationMin} min @ ${i.avgHr} bpm`
  if (i.durationMin) return `Bike · ${i.durationMin} min`
  return 'Bike'
}

/** Honest note about where the estimate holds, shown under the result. */
export function accuracyNote(i: ActivityInputs): { text: string; warn: boolean } {
  if (i.kind === 'walk') {
    return {
      text: 'Valid 3–6 km/h on the flat. Very slow strolling and hills both cost more per km.',
      warn: false,
    }
  }
  if (i.kind === 'run') {
    return {
      text: 'Assumes ≥ 8 km/h. Outdoor drag pushes real cost ~3–5% higher.',
      warn: false,
    }
  }
  const maxHr = i.maxHr || DEFAULT_MAX_HR
  if (i.avgHr && i.avgHr / maxHr < MIN_USEFUL_HR_FRACTION) {
    return {
      text: `Heart rate is low against your max of ${maxHr} — treat this as a rough estimate.`,
      warn: true,
    }
  }
  return {
    text: 'Deliberately cautious, so your real burn is likely a little higher.',
    warn: false,
  }
}
