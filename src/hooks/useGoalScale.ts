import { useState } from 'preact/hooks'

/** Which kcal the goal bars are for: the kcal eaten so far, or the planned kcal. */
export type GoalScale = 'eaten' | 'planned'

// One choice for Today and the Meal planner. Kept in localStorage, so the bars open as the
// user left them.
const STORAGE_KEY = 'goal-scale'

function readScale(): GoalScale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'planned' ? 'planned' : 'eaten'
  } catch {
    return 'eaten'
  }
}

export function useGoalScale(): [GoalScale, (scale: GoalScale) => void] {
  const [scale, setScale] = useState(readScale)

  const choose = (next: GoalScale) => {
    setScale(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The choice is a convenience. The switch still works without it.
    }
  }

  return [scale, choose]
}
