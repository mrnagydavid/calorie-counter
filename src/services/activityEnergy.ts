import type { ActivityKind, Sex } from '../db/index'

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

/** Range the Keytel equation was validated over. */
export const HR_MIN = 90
export const HR_MAX = 150

export interface ActivityInputs {
  kind: ActivityKind
  weightKg: number
  distanceKm?: number // walk, run
  durationMin?: number // bike
  avgHr?: number // bike
  age?: number // bike
  sex?: Sex // bike
}

export function netWalkKcal(distanceKm: number, weightKg: number): number {
  return NET_KCAL_PER_KG_KM.walk * weightKg * distanceKm
}

export function netRunKcal(distanceKm: number, weightKg: number): number {
  return NET_KCAL_PER_KG_KM.run * weightKg * distanceKm
}

/** Keytel et al. (2005): gross energy expenditure in kJ/min from heart rate. */
function keytelKjPerMin(avgHr: number, weightKg: number, age: number, sex: Sex): number {
  return sex === 'female'
    ? -20.4022 + 0.4472 * avgHr - 0.1263 * weightKg + 0.074 * age
    : -55.0969 + 0.6309 * avgHr + 0.1988 * weightKg + 0.2017 * age
}

export function netBikeKcal(
  durationMin: number,
  avgHr: number,
  weightKg: number,
  age: number,
  sex: Sex,
): number {
  const gross = Math.max(0, keytelKjPerMin(avgHr, weightKg, age, sex) / 4.184) * durationMin
  const resting = RESTING_KCAL_PER_KG_MIN * weightKg * durationMin
  return Math.max(0, gross - resting)
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
  if (!(i.age && i.age > 0) || !i.sex) return null
  return Math.round(netBikeKcal(i.durationMin, i.avgHr, i.weightKg, i.age, i.sex))
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
  if (i.avgHr && (i.avgHr < HR_MIN || i.avgHr > HR_MAX)) {
    return {
      text: `Heart rate outside ${HR_MIN}–${HR_MAX} bpm — treat this as a rough estimate.`,
      warn: true,
    }
  }
  return { text: `Most accurate between ${HR_MIN} and ${HR_MAX} bpm.`, warn: false }
}
