import type { ActivityKind, BurnActivity } from '../db/index'

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
 * Net cost of walking one km, as a U-curve in speed. Slow strolling wastes energy
 * on balance and long single-leg support; fast walking wastes it fighting the
 * geometry of the gait. The floor sits near 4.4 km/h.
 *
 * The ACSM gait equation cannot express this. `VO2 = 0.1*S + 3.5` makes the per-km
 * cost identical at every speed, which is why the flat 0.5 constant this replaces
 * sat on the floor of the curve and understated every walk that was not close to
 * optimal. These coefficients are a least-squares fit to the level-walking entries
 * of the Compendium of Physical Activities, taken net of 1 MET.
 *
 * A check on the fit: it crosses RUN_KCAL_PER_KG_KM at 7.6 km/h, and real people
 * change to running at about 7.0-7.5 km/h. The curve finds the gait change on its
 * own, from data that never mentions running.
 */
const WALK_FIT = { pivotKmh: 4.5, base: 0.53, linear: 0.009, quadratic: 0.041 }

/** Outside this band the fit leaves its data, so the speed given to it is clamped. */
const WALK_KMH_RANGE = { min: 2.5, max: 7.5 }

/** Pace assumed when no duration is given — a typical adult self-selected walk. */
const ASSUMED_WALK_KMH = 4.75

/**
 * Net cost of running one km. Unlike walking this really is near-constant across
 * recreational speeds, so distance alone is enough and a duration adds nothing.
 *
 * 0.95 rather than the classic Margaria 1.0: the compendium's running entries work
 * out at 0.90-0.98 net, so 1.0 sat at the top of the measured range while the old
 * walking constant sat on the floor of its own. The pair overstated how much more
 * a run costs than a walk.
 */
const RUN_KCAL_PER_KG_KM = 0.95

/** Below this speed a "run" is really a walk, and the flat constant stops holding. */
const MIN_RUN_KMH = 8

/**
 * Cost of climbing, per kg per vertical metre.
 *
 * ACSM adds a grade term alongside the horizontal one — `1.8*S*G` walking and
 * `0.9*S*G` running, where `S*G` is simply vertical speed. That reduces to a fixed
 * cost per metre climbed, whatever the gradient. On a hilly route this term can
 * beat the horizontal one, which is why the field is worth asking for at all.
 *
 * Descent is ignored. It costs roughly a fifth of the climb, so leaving it out
 * errs low — the direction this file always errs.
 */
const ASCENT_KCAL_PER_KG_M: Record<'walk' | 'run', number> = { walk: 0.009, run: 0.0045 }

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
  durationMin?: number // bike; optional for walk (sets the pace) and run (checks it)
  ascentM?: number // walk, run — optional
  avgHr?: number // bike
  maxHr?: number // bike, defaults to DEFAULT_MAX_HR
}

/** Pace in km/h, or null when no usable duration was given. */
function paceKmh(distanceKm: number, durationMin?: number): number | null {
  if (!durationMin || durationMin <= 0) return null
  return (distanceKm / durationMin) * 60
}

/** Net kcal per kg per km of level walking, at a pace clamped to the fitted band. */
function walkCostPerKgKm(speedKmh: number): number {
  const v = Math.min(WALK_KMH_RANGE.max, Math.max(WALK_KMH_RANGE.min, speedKmh))
  const d = v - WALK_FIT.pivotKmh
  return WALK_FIT.base + WALK_FIT.linear * d + WALK_FIT.quadratic * d * d
}

export function netWalkKcal(
  distanceKm: number,
  weightKg: number,
  durationMin?: number,
  ascentM = 0,
): number {
  const pace = paceKmh(distanceKm, durationMin) ?? ASSUMED_WALK_KMH
  return (
    walkCostPerKgKm(pace) * weightKg * distanceKm +
    ASCENT_KCAL_PER_KG_M.walk * weightKg * ascentM
  )
}

export function netRunKcal(distanceKm: number, weightKg: number, ascentM = 0): number {
  return (
    RUN_KCAL_PER_KG_KM * weightKg * distanceKm +
    ASCENT_KCAL_PER_KG_M.run * weightKg * ascentM
  )
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
      ? netWalkKcal(i.distanceKm, i.weightKg, i.durationMin, i.ascentM)
      : netRunKcal(i.distanceKm, i.weightKg, i.ascentM)
    return Math.round(kcal)
  }

  if (!(i.durationMin && i.durationMin > 0)) return null
  if (!(i.avgHr && i.avgHr > 0)) return null
  return Math.round(netBikeKcal(i.durationMin, i.avgHr, i.weightKg, i.maxHr))
}

/**
 * The storable record of what a calculation used, so it can be replayed later.
 * Blank optionals are left off rather than stored as zero, so a later replay can
 * tell "no duration given" from "a duration of nothing".
 */
export function toActivity(i: ActivityInputs): BurnActivity {
  const a: BurnActivity = { kind: i.kind, weightKg: i.weightKg }
  if (i.kind === 'bike') {
    a.durationMin = i.durationMin
    a.avgHr = i.avgHr
    return a
  }
  a.distanceKm = i.distanceKm
  if (i.durationMin) a.durationMin = i.durationMin
  if (i.ascentM) a.ascentM = i.ascentM
  return a
}

/**
 * Auto-generated entry name, e.g. "Walk · 5 km ↑120 m" or "Bike · 45 min @ 132 bpm".
 *
 * For walk and run this names the route and nothing else. Recents are grouped by
 * name, so folding in a duration would split one daily loop into a fresh row for
 * every slightly different time and push the rest of the list off the end.
 */
export function activityName(i: ActivityInputs): string {
  if (i.kind === 'walk' || i.kind === 'run') {
    const label = i.kind === 'walk' ? 'Walk' : 'Run'
    if (!i.distanceKm) return label
    const climb = i.ascentM ? ` ↑${i.ascentM} m` : ''
    return `${label} · ${i.distanceKm} km${climb}`
  }
  if (i.durationMin && i.avgHr) return `Bike · ${i.durationMin} min @ ${i.avgHr} bpm`
  if (i.durationMin) return `Bike · ${i.durationMin} min`
  return 'Bike'
}

const pace1dp = (kmh: number): string => kmh.toFixed(1)

function walkNote(pace: number | null): { text: string; warn: boolean } {
  if (pace === null) {
    return {
      text: `Assuming a typical ${ASSUMED_WALK_KMH} km/h. Add a duration to use your own pace.`,
      warn: false,
    }
  }
  if (pace > WALK_KMH_RANGE.max) {
    return {
      text: `${pace1dp(pace)} km/h is running pace for most people — Run fits this better.`,
      warn: true,
    }
  }
  if (pace < WALK_KMH_RANGE.min) {
    return {
      text: `${pace1dp(pace)} km/h is very slow — treat this as a rough figure.`,
      warn: true,
    }
  }
  return { text: `Based on your ${pace1dp(pace)} km/h pace.`, warn: false }
}

function runNote(pace: number | null): { text: string; warn: boolean } {
  if (pace !== null && pace < MIN_RUN_KMH) {
    return {
      text: `${pace1dp(pace)} km/h is walking pace — Walk fits this better.`,
      warn: true,
    }
  }
  return {
    text: 'Cost per km barely moves with pace. Outdoor drag adds ~3–5%.',
    warn: false,
  }
}

/** Honest note about where the estimate holds, shown under the result. */
export function accuracyNote(i: ActivityInputs): { text: string; warn: boolean } {
  if (i.kind === 'walk' || i.kind === 'run') {
    const pace = i.distanceKm ? paceKmh(i.distanceKm, i.durationMin) : null
    return i.kind === 'walk' ? walkNote(pace) : runNote(pace)
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
