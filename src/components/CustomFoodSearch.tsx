import { useState, useEffect, useRef } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import styles from './CustomFoodSearch.module.css'

export interface CustomFoodResult {
  name: string
  caloriesPerUnit: number
  unit: string
}

interface CustomFoodSearchProps {
  onSelect: (result: CustomFoodResult) => void
  onClose: () => void
}

function matchesQuery(name: string, query: string): boolean {
  const lower = name.toLowerCase()
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.every((w) => lower.includes(w))
}

export function CustomFoodSearch({ onSelect, onClose }: CustomFoodSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Only show foods without a barcode — these are user-prepared recipes (from Recipe Calculator).
  // Foods with a barcode come from the barcode scanner's "save as custom food" flow
  // and are already discoverable by scanning.
  const allCustomFoods = useLiveQuery(() =>
    db.customFoods.filter((f) => !f.barcode).sortBy('lastUsed').then((r) => r.reverse()),
  )

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = allCustomFoods
    ? query.length >= 1
      ? allCustomFoods.filter((f) => matchesQuery(f.name, query))
      : allCustomFoods
    : []

  return (
    <div class={styles.overlay}>
      <div class={styles.container}>
        <div class={styles.header}>
          <button class={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            class={styles.searchInput}
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Filter custom foods..."
          />
        </div>

        <div class={styles.resultList}>
          {results.length === 0 && query.length >= 1 && (
            <div class={styles.noResults}>No custom foods match</div>
          )}
          {results.length === 0 && query.length < 1 && allCustomFoods?.length === 0 && (
            <div class={styles.noResults}>No custom foods yet</div>
          )}
          {results.map((food) => (
            <button
              key={food.id}
              class={styles.resultItem}
              onClick={() => onSelect({
                name: food.name,
                caloriesPerUnit: food.caloriesPerUnit,
                unit: food.unit,
              })}
            >
              <div class={styles.resultName}>{food.name}</div>
              <div class={styles.resultMeta}>
                {food.caloriesPerUnit} kcal/{food.unit}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
