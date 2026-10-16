import { useEffect, useState } from 'preact/hooks'

// One open/closed state for the Nutrition section of the intake form and of the Recipe
// calculator, so the user sets it once. Kept in localStorage, so it lasts to the next session.
const STORAGE_KEY = 'nutrition-form-open'

// Every mounted section, so a toggle in the intake form (an overlay) also updates the page below it
const listeners = new Set<(open: boolean) => void>()

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function useNutritionFormOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(readOpen)

  useEffect(() => {
    listeners.add(setOpen)
    return () => { listeners.delete(setOpen) }
  }, [])

  const toggle = () => {
    const next = !open
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // The state is a convenience. The section still works without it.
    }
    for (const listener of listeners) listener(next)
  }

  return [open, toggle]
}
