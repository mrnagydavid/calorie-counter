export type SortMode = 'date' | 'name'

/** Sort custom foods by most-recently-used ('date', desc) or alphabetically ('name'). */
export function sortCustomFoods<T extends { name: string; lastUsed: string }>(
  foods: T[],
  sort: SortMode,
): T[] {
  const sorted = [...foods]
  if (sort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  } else {
    // Date: most recently used first
    sorted.sort((a, b) => (a.lastUsed < b.lastUsed ? 1 : a.lastUsed > b.lastUsed ? -1 : 0))
  }
  return sorted
}
