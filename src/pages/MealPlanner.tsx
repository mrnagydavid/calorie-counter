import { useState, useEffect, useMemo, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { todayString, getDayOfWeek } from '../db/dates'
import { BarcodeScanner, type ScannedEntry } from '../components/BarcodeScanner'
import styles from './MealPlanner.module.css'

interface MealPlannerProps {
  date?: string
}

interface DraftItem {
  id: string
  name: string
  calories: number
  unitCalories: number
  quantity: number
  unit: string
}

function barColor(ratio: number): string {
  if (ratio >= 1) return 'var(--color-red)'
  if (ratio >= 0.75) return 'var(--color-yellow)'
  return 'var(--color-green)'
}

export function MealPlanner({ date: dateProp }: MealPlannerProps) {
  const date = dateProp || todayString()
  const [items, setItems] = useState<DraftItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Inline add form
  const [addCal, setAddCal] = useState('')
  const [addName, setAddName] = useState('')

  // Budget
  const [budgetOverride, setBudgetOverride] = useState<string | null>(null)

  useEffect(() => { getOrCreateSettings() }, [])

  const settings = useLiveQuery(() => db.settings.get('user-settings'))
  const intakes = useLiveQuery(() => db.intakeEntries.where('date').equals(date).toArray(), [date])
  const burns = useLiveQuery(() => db.burnEntries.where('date').equals(date).toArray(), [date])

  // Recents for quick-add
  const allIntakes = useLiveQuery(() =>
    db.intakeEntries.orderBy('createdAt').reverse().toArray(),
  )

  const recents = useMemo(() => {
    if (!allIntakes) return []
    const seen = new Set<string>()
    const result: { name: string; unitCalories: number; unit: string }[] = []
    for (const entry of allIntakes) {
      if (!entry.name || seen.has(entry.name)) continue
      seen.add(entry.name)
      result.push({ name: entry.name, unitCalories: entry.unitCalories, unit: entry.unit })
      if (result.length >= 6) break
    }
    return result
  }, [allIntakes])

  const remaining = useMemo(() => {
    if (!settings || !intakes || !burns) return null
    const dayOfWeek = getDayOfWeek(date)
    const baseTarget = settings.dayOverrides[dayOfWeek] ?? settings.baselineCalories
    const burned = burns.reduce((sum, e) => sum + e.calories, 0)
    const target = baseTarget + burned
    const consumed = intakes.reduce((sum, e) => sum + e.calories, 0)
    return target - consumed
  }, [settings, intakes, burns, date])

  if (remaining === null) return null

  const budget = budgetOverride !== null ? (parseInt(budgetOverride, 10) || 0) : remaining
  const draftTotal = items.reduce((sum, i) => sum + i.calories, 0)
  const budgetLeft = budget - draftTotal
  const ratio = budget > 0 ? draftTotal / budget : 0
  const pct = Math.min(ratio * 100, 100)

  const addManualItem = () => {
    const cal = parseInt(addCal, 10)
    if (!cal || cal <= 0) return
    setItems([...items, {
      id: crypto.randomUUID(),
      name: addName.trim() || `${cal} kcal`,
      calories: cal,
      unitCalories: cal,
      quantity: 1,
      unit: 'piece',
    }])
    setAddCal('')
    setAddName('')
  }

  const addRecentItem = (recent: { name: string; unitCalories: number; unit: string }) => {
    setItems([...items, {
      id: crypto.randomUUID(),
      name: recent.name,
      calories: recent.unitCalories,
      unitCalories: recent.unitCalories,
      quantity: 1,
      unit: recent.unit,
    }])
  }

  const handleScannedEntry = useCallback((entry: ScannedEntry) => {
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: entry.name,
      calories: entry.calories,
      unitCalories: entry.unitCalories,
      quantity: entry.quantity,
      unit: entry.unit,
    }])
  }, [])

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id))
    setExpandedId(null)
  }

  const logAll = async () => {
    const now = new Date().toISOString()
    await Promise.all(items.map((item) =>
      db.intakeEntries.add({
        id: crypto.randomUUID(),
        date,
        name: item.name,
        calories: item.calories,
        quantity: item.quantity,
        unitCalories: item.unitCalories,
        unit: item.unit,
        source: 'manual',
        createdAt: now,
      }),
    ))
    route(`/?date=${date}`)
  }

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route(`/?date=${date}`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Plan a Meal</h1>
      </div>

      {/* Budget */}
      <div class={styles.section}>
        <div class={styles.budgetRow}>
          <span class={styles.budgetLabel}>Budget</span>
          <div class={styles.budgetInputRow}>
            <input
              type="number"
              class={styles.budgetInput}
              value={budgetOverride !== null ? budgetOverride : String(remaining)}
              onInput={(e) => setBudgetOverride((e.target as HTMLInputElement).value)}
              onFocus={(e) => (e.target as HTMLInputElement).select()}
            />
            <span class={styles.budgetUnit}>kcal</span>
          </div>
        </div>
        <div class={styles.barTrack}>
          <div
            class={styles.barFill}
            style={{ width: `${pct}%`, backgroundColor: barColor(ratio) }}
          />
        </div>
        <div class={styles.budgetStatus} style={{ color: barColor(ratio) }}>
          {budgetLeft >= 0 ? `${budgetLeft} left` : `${-budgetLeft} over`}
        </div>
      </div>

      {/* Draft items */}
      {items.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Items</div>
          <div class={styles.itemList}>
            {items.map((item) => (
              <div key={item.id}>
                <div
                  class={styles.item}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <span class={styles.itemName}>{item.name}</span>
                  <span class={styles.itemCal}>{item.calories} kcal</span>
                </div>
                {expandedId === item.id && (
                  <div class={styles.itemActions}>
                    <button class={styles.deleteButton} onClick={() => removeItem(item.id)}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div class={styles.draftTotal}>
            Total: {draftTotal} / {budget} kcal
          </div>
        </div>
      )}

      {/* Quick add from recents */}
      {recents.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Recent</div>
          <div class={styles.recentList}>
            {recents.map((r) => (
              <button key={r.name} class={styles.recentItem} onClick={() => addRecentItem(r)}>
                <span class={styles.recentName}>{r.name}</span>
                <span class={styles.recentCal}>{r.unitCalories} kcal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline add */}
      <div class={styles.section}>
        <div class={styles.sectionTitle}>Add item</div>
        <div class={styles.addRow}>
          <input
            type="number"
            inputMode="numeric"
            class={styles.addCalInput}
            value={addCal}
            onInput={(e) => setAddCal((e.target as HTMLInputElement).value)}
            placeholder="kcal"
          />
          <input
            type="text"
            class={styles.addNameInput}
            value={addName}
            onInput={(e) => setAddName((e.target as HTMLInputElement).value)}
            placeholder="Name (optional)"
          />
          <button
            class={styles.addButton}
            disabled={!addCal || parseInt(addCal, 10) <= 0}
            onClick={addManualItem}
          >
            +
          </button>
        </div>
        <button class={styles.scanButton} onClick={() => setScanning(true)}>
          Scan Barcode
        </button>
      </div>

      {/* Actions */}
      <div class={styles.actions}>
        <button class={styles.dismissButton} onClick={() => route(`/?date=${date}`)}>
          Dismiss
        </button>
        <button
          class={styles.logButton}
          disabled={items.length === 0}
          onClick={logAll}
        >
          Log All ({items.length})
        </button>
      </div>

      {scanning && (
        <BarcodeScanner
          date={date}
          onClose={() => setScanning(false)}
          onAddEntry={handleScannedEntry}
        />
      )}
    </div>
  )
}
