import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
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
  initialQuery?: string
}

function matchesQuery(name: string, query: string): boolean {
  const lower = name.toLowerCase()
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.every((w) => lower.includes(w))
}

export function CustomFoodSearch({ onSelect, onClose, initialQuery = '' }: CustomFoodSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [hideBarcode, setHideBarcode] = useState(true)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allCustomFoods = useLiveQuery(() =>
    db.customFoods.orderBy('lastUsed').reverse().toArray(),
  )

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = allCustomFoods
    ? hideBarcode ? allCustomFoods.filter((f) => !f.barcode) : allCustomFoods
    : []

  const results = query.length >= 1
    ? filtered.filter((f) => matchesQuery(f.name, query))
    : filtered

  const handleDelete = useCallback((e: Event, foodId: string) => {
    e.stopPropagation()
    if (confirmingDeleteId === foodId) {
      db.customFoods.delete(foodId)
      setConfirmingDeleteId(null)
    } else {
      setConfirmingDeleteId(foodId)
    }
  }, [confirmingDeleteId])

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
            placeholder="Search"
          />
        </div>

        <div class={styles.filterRow}>
          <label class={styles.filterLabel}>
            <input
              type="checkbox"
              checked={hideBarcode}
              onChange={(e) => setHideBarcode((e.target as HTMLInputElement).checked)}
            />
            Hide barcode scans
          </label>
        </div>

        <div class={styles.resultList}>
          {results.length === 0 && query.length >= 1 && (
            <div class={styles.noResults}>No matching foods</div>
          )}
          {results.length === 0 && query.length < 1 && filtered.length === 0 && (
            <div class={styles.noResults}>No saved foods yet</div>
          )}
          {results.map((food) => (
            <div key={food.id} class={styles.resultRow}>
              <button
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
              <button
                class={`${styles.deleteButton} ${confirmingDeleteId === food.id ? styles.deleteConfirm : ''}`}
                onClick={(e) => handleDelete(e, food.id)}
              >
                {confirmingDeleteId === food.id ? (
                  'Delete?'
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
