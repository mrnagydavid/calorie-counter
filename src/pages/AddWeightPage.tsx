import { useState, useMemo, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { NumericInput } from '../components/NumericInput'
import styles from './AddWeightPage.module.css'

interface AddWeightPageProps {
  date?: string
}

export function AddWeightPage({ date = '' }: AddWeightPageProps) {
  const [weight, setWeight] = useState('')

  const recentEntries = useLiveQuery(() =>
    db.weightEntries.orderBy('createdAt').reverse().limit(5).toArray(),
  )

  const recents = useMemo(() => {
    if (!recentEntries) return []
    return recentEntries.map((e) => ({
      date: e.date,
      weight: e.weight,
    }))
  }, [recentEntries])

  const weightNum = parseFloat(weight) || 0
  const canSubmit = weightNum > 0

  const handleRecentTap = useCallback((w: number) => {
    setWeight(String(w))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    await db.weightEntries.add({
      id: crypto.randomUUID(),
      date,
      weight: weightNum,
      createdAt: new Date().toISOString(),
    })

    route('/')
  }, [canSubmit, date, weightNum])

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Log Weight</h1>
      </div>

      {recents.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Recent</div>
          <div class={styles.recentList}>
            {recents.map((item) => (
              <button
                key={`${item.date}-${item.weight}`}
                class={styles.recentItem}
                onClick={() => handleRecentTap(item.weight)}
              >
                <span class={styles.recentDate}>{item.date}</span>
                <span class={styles.recentWeight}>{item.weight} kg</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div class={styles.section}>
        <div class={styles.fieldLabel}>Weight</div>
        <div class={styles.inputRow}>
          <NumericInput
            inputMode="decimal"
            class={styles.weightInput}
            value={weight}
            onInput={(e) => setWeight((e.target as HTMLInputElement).value)}
            placeholder="0.0"
            min="0"
            step="0.1"
            autoFocus
          />
          <span class={styles.unit}>kg</span>
        </div>
      </div>

      <button class={styles.submitButton} disabled={!canSubmit} onClick={handleSubmit}>
        Save
      </button>
    </div>
  )
}
