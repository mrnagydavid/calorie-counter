import { useState, useMemo, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { SortToggle } from '../components/SortToggle'
import { sortCustomFoods, type SortMode } from '../utils/sortCustomFoods'
import styles from './MyFoodsPage.module.css'

export function MyFoodsPage() {
  const [sort, setSort] = useState<SortMode>('date')
  const [hideBarcode, setHideBarcode] = useState(true)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const allCustomFoods = useLiveQuery(() => db.customFoods.toArray())

  const foods = useMemo(() => {
    if (!allCustomFoods) return []
    const list = hideBarcode ? allCustomFoods.filter((f) => !f.barcode) : allCustomFoods
    return sortCustomFoods(list, sort)
  }, [allCustomFoods, hideBarcode, sort])

  const handleDelete = useCallback((foodId: string) => {
    if (confirmingDeleteId === foodId) {
      db.customFoods.delete(foodId)
      setConfirmingDeleteId(null)
    } else {
      setConfirmingDeleteId(foodId)
    }
  }, [confirmingDeleteId])

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route('/settings')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>My Foods</h1>
      </div>

      <div class={styles.controls}>
        <SortToggle value={sort} onChange={setSort} />
        <label class={styles.filterLabel}>
          <input
            type="checkbox"
            checked={hideBarcode}
            onChange={(e) => setHideBarcode((e.target as HTMLInputElement).checked)}
          />
          Hide barcode scans
        </label>
      </div>

      <div class={styles.list}>
        {foods.length === 0 && (
          <div class={styles.empty}>No saved foods yet</div>
        )}
        {foods.map((food) => (
          <div key={food.id} class={styles.row}>
            <div class={styles.info}>
              <div class={styles.name}>{food.name}</div>
              <div class={styles.meta}>{food.caloriesPerUnit} kcal/{food.unit}</div>
            </div>
            <button
              class={`${styles.deleteButton} ${confirmingDeleteId === food.id ? styles.deleteConfirm : ''}`}
              onClick={() => handleDelete(food.id)}
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
  )
}
