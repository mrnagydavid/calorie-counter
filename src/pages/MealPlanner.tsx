import { useState, useEffect, useCallback, useRef } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Nutrients } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { applyCustomFoodAction } from '../db/customFoods'
import { todayString } from '../db/dates'
import { getTargetForDate } from '../db/dailyTargets'
import { FoodPicker, type FoodPickerResult } from '../components/FoodPicker'
import { displayQuantity } from '../components/FoodForm'
import { FeatureIntro } from '../components/FeatureIntro'
import { DraftRestoreBanner } from '../components/DraftRestoreBanner'
import { NumericInput } from '../components/NumericInput'
import { PlannerGoals, itemGoalLine } from '../components/PlannerGoals'
import { useDraftCache } from '../hooks/useDraftCache'
import { barColor } from '../utils/barColor'
import { liveGoals } from '../utils/goalProgress'
import { entryNutrients, parseDecimal, sumNutrients } from '../utils/nutrients'
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
  unitNutrients?: Nutrients
  quantity: number
  unit: string
}

const isPer100 = (unit: string) => unit === '100g' || unit === '100ml'

/** The label after the amount box: "g" for 100g, "ml" for 100ml, else the unit itself. */
function amountUnit(unit: string): string {
  if (unit === '100g') return 'g'
  if (unit === '100ml') return 'ml'
  return unit
}

/** The item with a new amount in the box's unit (grams for 100g). An empty box gives 0 kcal. */
function withAmount(item: DraftItem, amount: number): DraftItem {
  return {
    ...item,
    quantity: isPer100(item.unit) ? amount / 100 : amount,
    calories: Math.round(isPer100(item.unit) ? item.unitCalories * amount / 100 : item.unitCalories * amount),
  }
}

/** Keeps the typed text, so "0," or an empty box stays as typed while the kcal follow it. */
function AmountInput({ item, onChange }: { item: DraftItem; onChange: (amount: number) => void }) {
  const [text, setText] = useState(() => String(displayQuantity(item.unit, item.quantity)))
  return (
    <span class={styles.amount}>
      <NumericInput
        type="text"
        inputMode="decimal"
        class={styles.amountInput}
        value={text}
        // A tap on the box must not open or close the item
        onClick={(e) => e.stopPropagation()}
        onInput={(e) => {
          const value = (e.target as HTMLInputElement).value
          setText(value)
          onChange(parseDecimal(value) ?? 0)
        }}
      />
      <span class={styles.amountUnit}>{amountUnit(item.unit)}</span>
    </span>
  )
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

  const burned = burns?.reduce((sum, e) => sum + e.calories, 0) ?? 0
  const remaining = (() => {
    if (baseTarget == null || !intakes || !burns) return null
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

  // The plan counts as eaten. The planned kcal are the target with burns, as on Today: the
  // budget is for kcal only.
  const goals = liveGoals(storedTarget, burned, [...(intakes ?? []), ...items], date < todayString())
  const saltUnit = settings?.saltUnit

  const handleFoodPicked = useCallback(async (result: FoodPickerResult) => {
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: result.name,
      calories: result.calories,
      unitCalories: result.unitCalories,
      unitNutrients: result.unitNutrients,
      quantity: result.quantity,
      unit: result.unit,
    }])
    setPicking(false)
    // The same tick as Add intake, so a planned food can be kept in My foods
    await applyCustomFoodAction(result)
  }, [])

  const setAmount = (id: string, amount: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? withAmount(i, amount) : i)))
  }

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
        ...entryNutrients(item.unitNutrients),
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

      {goals.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Nutrition goals</div>
          <PlannerGoals
            goals={goals}
            planned={sumNutrients(items)}
            plannedKcal={Math.round((storedTarget?.target ?? 0) + burned)}
            saltUnit={saltUnit}
          />
        </div>
      )}

      {/* Draft items */}
      {items.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Items</div>
          <div class={styles.itemList}>
            {items.map((item) => (
              <div key={item.id} class={styles.itemBlock}>
                <div
                  class={styles.item}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  {item.unit === 'total' ? (
                    <div class={styles.itemLine}>
                      <span class={styles.itemName}>{item.name}</span>
                      <span class={styles.itemCal}>{item.calories} kcal</span>
                    </div>
                  ) : (<>
                    <span class={styles.itemName}>{item.name}</span>
                    <div class={styles.itemLine}>
                      <AmountInput item={item} onChange={(amount) => setAmount(item.id, amount)} />
                      <span class={styles.itemCal}>{item.calories} kcal</span>
                    </div>
                  </>)}
                </div>
                {expandedId === item.id && (
                  <div class={styles.itemActions}>
                    {(() => {
                      const line = itemGoalLine(sumNutrients([item]), goals, saltUnit)
                      return line && <div class={styles.itemNutrients}>{line}</div>
                    })()}
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
          showSaveAsCustom
        />
      )}
    </div>
  )
}
