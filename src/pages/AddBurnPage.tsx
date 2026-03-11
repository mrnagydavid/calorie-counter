import { useState, useMemo, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import styles from './AddBurnPage.module.css'

interface AddBurnPageProps {
  date?: string
}

interface RecentBurn {
  name: string
  calories: number
}

export function AddBurnPage({ date = '' }: AddBurnPageProps) {
  const [calories, setCalories] = useState('')
  const [name, setName] = useState('')

  const allBurns = useLiveQuery(() =>
    db.burnEntries.orderBy('createdAt').reverse().toArray(),
  )

  const recents = useMemo<RecentBurn[]>(() => {
    if (!allBurns) return []
    const seen = new Set<string>()
    const result: RecentBurn[] = []
    for (const entry of allBurns) {
      if (!entry.name || seen.has(entry.name)) continue
      seen.add(entry.name)
      result.push({ name: entry.name, calories: entry.calories })
      if (result.length >= 10) break
    }
    return result
  }, [allBurns])

  const cal = parseInt(calories, 10) || 0
  const canSubmit = cal > 0

  const handleRecentTap = useCallback((item: RecentBurn) => {
    setName(item.name)
    setCalories(String(item.calories))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    await db.burnEntries.add({
      id: crypto.randomUUID(),
      date,
      name: name.trim() || `Burned ${cal} kcal`,
      calories: cal,
      createdAt: new Date().toISOString(),
    })

    route('/')
  }, [canSubmit, date, name, cal])

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Add Burned Calories</h1>
      </div>

      {recents.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Recent</div>
          <div class={styles.recentList}>
            {recents.map((item) => (
              <button
                key={item.name}
                class={styles.recentItem}
                onClick={() => handleRecentTap(item)}
              >
                <span class={styles.recentName}>{item.name}</span>
                <span class={styles.recentCal}>{item.calories} kcal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div class={styles.section}>
        <div class={styles.fieldLabel}>Calories burned</div>
        <div class={styles.inputRow}>
          <input
            type="number"
            inputMode="numeric"
            class={styles.calorieInput}
            value={calories}
            onInput={(e) => setCalories((e.target as HTMLInputElement).value)}
            placeholder="0"
            min="0"
          />
          <span class={styles.unit}>kcal</span>
        </div>
      </div>

      <div class={styles.section}>
        <div class={styles.fieldLabel}>Name (optional)</div>
        <input
          type="text"
          class={styles.textInput}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="e.g. Running"
        />
      </div>

      <button class={styles.submitButton} disabled={!canSubmit} onClick={handleSubmit}>
        Add Entry
      </button>
    </div>
  )
}
