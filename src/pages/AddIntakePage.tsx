import { useState, useMemo, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import styles from './AddIntakePage.module.css'

interface AddIntakePageProps {
  date?: string
}

interface RecentFood {
  name: string
  unitCalories: number
  quantity: number
}

export function AddIntakePage({ date = '' }: AddIntakePageProps) {
  const barcode = new URLSearchParams(window.location.search).get('barcode') || ''
  const hasBarcode = barcode.length > 0

  const [unitCalories, setUnitCalories] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [name, setName] = useState('')
  const [saveAsCustom, setSaveAsCustom] = useState(hasBarcode)
  const [unit, setUnit] = useState('100g')
  const [customUnit, setCustomUnit] = useState('')

  const allIntakes = useLiveQuery(() =>
    db.intakeEntries.orderBy('createdAt').reverse().toArray(),
  )

  const recents = useMemo<RecentFood[]>(() => {
    if (!allIntakes) return []
    const seen = new Set<string>()
    const result: RecentFood[] = []
    for (const entry of allIntakes) {
      if (!entry.name || seen.has(entry.name)) continue
      seen.add(entry.name)
      result.push({
        name: entry.name,
        unitCalories: entry.unitCalories,
        quantity: entry.quantity,
      })
      if (result.length >= 10) break
    }
    return result
  }, [allIntakes])

  const cal = parseInt(unitCalories, 10) || 0
  const total = Math.round(cal * quantity)

  const canSubmit = cal > 0 && (!saveAsCustom || name.trim().length > 0)

  const handleRecentTap = useCallback((item: RecentFood) => {
    setName(item.name)
    setUnitCalories(String(item.unitCalories))
    setQuantity(item.quantity)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    const entryName = name.trim() || `${total} kcal`

    await db.intakeEntries.add({
      id: crypto.randomUUID(),
      date,
      name: entryName,
      calories: total,
      quantity,
      unitCalories: cal,
      source: hasBarcode ? 'barcode' : 'manual',
      barcode: hasBarcode ? barcode : undefined,
      createdAt: new Date().toISOString(),
    })

    if (saveAsCustom && name.trim()) {
      await db.customFoods.put({
        id: crypto.randomUUID(),
        name: name.trim(),
        caloriesPerUnit: cal,
        unit: unit === 'custom' ? (customUnit.trim() || 'portion') : unit,
        barcode: hasBarcode ? barcode : undefined,
        lastUsed: new Date().toISOString(),
      })
    }

    route('/')
  }, [canSubmit, date, name, total, quantity, cal, saveAsCustom, unit, customUnit])

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Add Intake</h1>
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
                <span class={styles.recentCal}>{item.unitCalories} kcal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div class={styles.section}>
        <div class={styles.fieldLabel}>Calories per unit</div>
        <div class={styles.inputRow}>
          <input
            type="number"
            inputMode="numeric"
            class={styles.calorieInput}
            value={unitCalories}
            onInput={(e) => setUnitCalories((e.target as HTMLInputElement).value)}
            placeholder="0"
            min="0"
          />
          <span class={styles.unit}>kcal</span>
        </div>
      </div>

      <div class={styles.section}>
        <div class={styles.fieldLabel}>Quantity</div>
        <div class={styles.stepper}>
          <button
            class={styles.stepperButton}
            onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
          >
            -
          </button>
          <span class={styles.stepperValue}>{quantity}</span>
          <button
            class={styles.stepperButton}
            onClick={() => setQuantity(quantity + 0.5)}
          >
            +
          </button>
        </div>
      </div>

      <div class={styles.total}>Total: {total} kcal</div>

      <div class={styles.checkboxRow}>
        <input
          type="checkbox"
          id="saveCustom"
          checked={saveAsCustom}
          onChange={(e) => setSaveAsCustom((e.target as HTMLInputElement).checked)}
        />
        <label for="saveCustom">Save as custom food</label>
      </div>

      {saveAsCustom && (
        <div class={styles.customFoodFields}>
          <div>
            <div class={styles.fieldLabel}>
              Name <span class={styles.required}>*</span>
            </div>
            <input
              type="text"
              class={styles.textInput}
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="e.g. Chicken salad"
            />
          </div>
          <div>
            <div class={styles.fieldLabel}>Unit</div>
            <div class={styles.unitOptions}>
              {['100g', '100ml', 'piece'].map((opt) => (
                <label key={opt} class={styles.unitOption}>
                  <input
                    type="radio"
                    name="unit"
                    value={opt}
                    checked={unit === opt}
                    onChange={() => setUnit(opt)}
                  />
                  {opt}
                </label>
              ))}
              <label class={styles.unitOption}>
                <input
                  type="radio"
                  name="unit"
                  value="custom"
                  checked={unit === 'custom'}
                  onChange={() => setUnit('custom')}
                />
                <input
                  type="text"
                  class={styles.unitCustomInput}
                  value={customUnit}
                  onInput={(e) => {
                    setCustomUnit((e.target as HTMLInputElement).value)
                    setUnit('custom')
                  }}
                  onFocus={() => setUnit('custom')}
                  placeholder="custom"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {!saveAsCustom && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>Name (optional)</div>
          <input
            type="text"
            class={styles.textInput}
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="e.g. Chicken salad"
          />
        </div>
      )}

      <button class={styles.submitButton} disabled={!canSubmit} onClick={handleSubmit}>
        Add Entry
      </button>
    </div>
  )
}
