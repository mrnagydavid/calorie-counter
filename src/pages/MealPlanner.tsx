import { useState, useEffect, useCallback, useRef } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { todayString } from '../db/dates'
import { getTargetForDate } from '../db/dailyTargets'
import { FoodPicker, type FoodPickerResult } from '../components/FoodPicker'
import { FeatureIntro } from '../components/FeatureIntro'
import { DraftRestoreBanner } from '../components/DraftRestoreBanner'
import { NumericInput } from '../components/NumericInput'
import { useDraftCache } from '../hooks/useDraftCache'
import { barColor } from '../utils/barColor'
import styles from './MealPlanner.module.css'

interface MealPlannerDraft {
  items: DraftItem[]
  budgetOverride: string | null
}

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

export function MealPlanner({ date: dateProp }: MealPlannerProps) {
  const date = dateProp || todayString()
  const [items, setItems] = useState<DraftItem[]>([])
  const [picking, setPicking] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Budget
  const [budgetOverride, setBudgetOverride] = useState<string | null>(null)

  // Draft cache
  const draft = useDraftCache<MealPlannerDraft>(
    'meal-planner',
    (d) => d.items.length === 0,
  )

  const budgetRef = useRef(budgetOverride)
  budgetRef.current = budgetOverride

  // Save on item add/remove (discrete events)
  useEffect(() => {
    draft.save({ items, budgetOverride: budgetRef.current })
  }, [items])

  // Save on budget input blur
  const saveDraft = useCallback(() => {
    draft.save({ items, budgetOverride })
  }, [items, budgetOverride, draft])

  useEffect(() => { getOrCreateSettings() }, [])

  const settings = useLiveQuery(() => db.settings.get('user-settings'))
  const intakes = useLiveQuery(() => db.intakeEntries.where('date').equals(date).toArray(), [date])
  const burns = useLiveQuery(() => db.burnEntries.where('date').equals(date).toArray(), [date])

  const storedTarget = useLiveQuery(() => db.dailyTargets.get(date), [date])
  const [baseTarget, setBaseTarget] = useState<number | null>(null)
  useEffect(() => {
    if (!settings) return
    if (storedTarget) {
      setBaseTarget(storedTarget.target)
    } else {
      getTargetForDate(date, settings).then((t) => setBaseTarget(t))
    }
  }, [date, settings, storedTarget])

  const remaining = (() => {
    if (baseTarget == null || !intakes || !burns) return null
    const burned = burns.reduce((sum, e) => sum + e.calories, 0)
    const target = baseTarget + burned
    const consumed = intakes.reduce((sum, e) => sum + e.calories, 0)
    return target - consumed
  })()

  if (remaining === null) return null

  const budget = budgetOverride !== null ? (parseInt(budgetOverride, 10) || 0) : remaining
  const draftTotal = items.reduce((sum, i) => sum + i.calories, 0)
  const budgetLeft = budget - draftTotal
  const ratio = budget > 0 ? draftTotal / budget : 0
  const pct = Math.min(ratio * 100, 100)

  const handleFoodPicked = useCallback((result: FoodPickerResult) => {
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: result.name,
      calories: result.calories,
      unitCalories: result.unitCalories,
      quantity: result.quantity,
      unit: result.unit,
    }])
    setPicking(false)
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
    draft.clear()
    route(`/?date=${date}`)
  }

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => { draft.clear(); route(`/?date=${date}`) }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Plan a Meal</h1>
      </div>

      <FeatureIntro featureKey="meal-planner" version={1}>
        Plan your meal before eating. Add items to see how they fit in your
        remaining calorie budget, then log them all at once.
      </FeatureIntro>

      {draft.pending && (
        <DraftRestoreBanner
          onRestore={() => {
            const data = draft.restore()
            setItems(data.items)
            setBudgetOverride(data.budgetOverride)
          }}
          onDiscard={() => draft.discard()}
        />
      )}

      {/* Budget */}
      <div class={styles.section}>
        <div class={styles.budgetRow}>
          <span class={styles.budgetLabel}>Budget</span>
          <div class={styles.budgetInputRow}>
            <NumericInput
              class={styles.budgetInput}
              value={budgetOverride !== null ? budgetOverride : String(remaining)}
              onInput={(e) => setBudgetOverride((e.target as HTMLInputElement).value)}
              onBlur={saveDraft}
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

      {/* Add item */}
      <div class={styles.section}>
        <button class={styles.addItemButton} onClick={() => setPicking(true)}>
          + Add item
        </button>
      </div>

      {/* Actions */}
      <div class={styles.actions}>
        <button class={styles.dismissButton} onClick={() => { draft.clear(); route(`/?date=${date}`) }}>
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

      {picking && (
        <FoodPicker
          date={date}
          onSelect={handleFoodPicked}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
