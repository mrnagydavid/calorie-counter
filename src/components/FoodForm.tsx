import { useState, useCallback, useMemo } from 'preact/hooks'
import { NumericInput } from './NumericInput'
import styles from './FoodForm.module.css'

export interface FoodFormResult {
  name: string
  calories: number
  unitCalories: number
  quantity: number
  unit: string
  saveAsCustom: boolean
}

export interface FoodFormInitial {
  name?: string
  unit?: string
  customUnit?: string
  unitCalories?: number
  /** Display quantity: grams for 100g/100ml, count for piece/serving/total */
  quantity?: number
}

interface FoodFormProps {
  initial?: FoodFormInitial
  /** Hide unit selector and calories input (used when filled from search) */
  hideUnitAndCalories?: boolean
  portions?: { desc: string; g: number }[] | null
  showSaveAsCustom?: boolean
  /** When set, the food is already saved — hide checkbox, show label, auto-sync */
  existingCustomFoodId?: string
  showNameField?: boolean
  nameRequired?: boolean
  submitLabel?: string
  showSaveAndAddNew?: boolean
  onSubmit: (result: FoodFormResult) => void
  onSaveAndAddNew?: (result: FoodFormResult) => void
  scrollAnchorRef?: { current: HTMLDivElement | null }
}

const UNITS = ['100g', '100ml', 'total', 'piece'] as const

function quantityLabel(unit: string): string {
  if (unit === '100g') return 'g'
  if (unit === '100ml') return 'ml'
  if (unit === 'piece') return 'piece(s)'
  return unit
}

function computeTotal(unit: string, cal: number, qty: number): number {
  if (unit === 'total') return cal
  if (unit === '100g' || unit === '100ml') return Math.round(cal * qty / 100)
  return Math.round(cal * qty)
}

function computeDbQuantity(unit: string, qty: number): number {
  if (unit === 'total') return 1
  if (unit === '100g' || unit === '100ml') return qty / 100
  return qty
}

function initQuantity(unit?: string, qty?: number): string {
  if (qty !== undefined) return String(qty)
  if (unit === '100g' || unit === '100ml') return '100'
  return '1'
}

export function FoodForm({
  initial,
  hideUnitAndCalories = false,
  portions = null,
  showSaveAsCustom = false,
  existingCustomFoodId,
  showNameField = true,
  nameRequired = false,
  submitLabel = 'Add',
  showSaveAndAddNew = false,
  onSubmit,
  onSaveAndAddNew,
  scrollAnchorRef,
}: FoodFormProps) {
  const [unit, setUnit] = useState(initial?.unit ?? '100g')
  const [customUnit, setCustomUnit] = useState(initial?.customUnit ?? '')
  const [unitCalories, setUnitCalories] = useState(
    initial?.unitCalories !== undefined ? String(initial.unitCalories) : '',
  )
  const [quantity, setQuantity] = useState(initQuantity(initial?.unit, initial?.quantity))
  const [name, setName] = useState(initial?.name ?? '')
  const [saveAsCustom, setSaveAsCustom] = useState(false)

  const cal = parseInt(unitCalories, 10) || 0
  const qty = parseFloat(quantity) || 0
  const resolvedUnit = unit === 'custom' ? (customUnit.trim() || 'portion') : unit
  const total = computeTotal(resolvedUnit, cal, qty)
  const isTotal = unit === 'total'
  const showQuantity = !isTotal

  const canSubmit = cal > 0 && (!nameRequired || name.trim().length > 0)
    && (!(showSaveAsCustom && saveAsCustom) || name.trim().length > 0)

  const handleUnitChange = useCallback((newUnit: string) => {
    setUnit(newUnit)
    if (newUnit === '100g' || newUnit === '100ml') {
      setQuantity('100')
    } else {
      setQuantity('1')
    }
  }, [])

  const buildResult = useCallback((): FoodFormResult => ({
    name: name.trim() || `${total} kcal`,
    calories: total,
    unitCalories: cal,
    quantity: computeDbQuantity(resolvedUnit, qty),
    unit: resolvedUnit,
    saveAsCustom,
  }), [name, total, cal, qty, resolvedUnit, saveAsCustom])

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    onSubmit(buildResult())
  }, [canSubmit, buildResult, onSubmit])

  const handleSaveAndAddNew = useCallback(() => {
    if (!canSubmit) return
    onSaveAndAddNew?.(buildResult())
    // Reset form
    setUnit('100g')
    setCustomUnit('')
    setUnitCalories('')
    setQuantity('100')
    setName('')
    setSaveAsCustom(false)
  }, [canSubmit, buildResult, onSaveAndAddNew])

  const handlePortionTap = useCallback((portion: { desc: string; g: number }) => {
    setQuantity(String(portion.g))
  }, [])

  const displayPortions = useMemo(() => {
    if (!portions || portions.length === 0) return null
    if (unit !== '100g' && unit !== '100ml') return null
    return portions
  }, [portions, unit])

  return (
    <>
      {/* Unit selector */}
      {!hideUnitAndCalories && (
        <div class={styles.section} ref={scrollAnchorRef}>
          <div class={styles.fieldLabel}>Unit</div>
          <div class={styles.unitOptions}>
            {UNITS.map((opt) => (
              <label key={opt} class={styles.unitOption}>
                <input
                  type="radio"
                  name="ff-unit"
                  value={opt}
                  checked={unit === opt}
                  onChange={() => handleUnitChange(opt)}
                />
                {opt}
              </label>
            ))}
            <label class={styles.unitOption}>
              <input
                type="radio"
                name="ff-unit"
                value="custom"
                checked={unit === 'custom'}
                onChange={() => handleUnitChange('custom')}
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
      )}

      {/* Calories per unit */}
      {!hideUnitAndCalories && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>
            {isTotal ? 'Total calories' : `Calories per ${resolvedUnit}`}
          </div>
          <div class={styles.inputRow}>
            <NumericInput
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
      )}

      {/* Portion quick-picks */}
      {showQuantity && displayPortions && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>Quick portion</div>
          <div class={styles.portionChips}>
            {displayPortions.map((p, i) => (
              <button
                key={i}
                class={styles.portionChip}
                onClick={() => handlePortionTap(p)}
              >
                {p.desc} <span class={styles.portionChipG}>{p.g}{unit === '100ml' ? 'ml' : 'g'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      {showQuantity && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>Quantity ({quantityLabel(resolvedUnit)})</div>
          <div class={styles.inputRow}>
            <NumericInput
              class={styles.calorieInput}
              value={quantity}
              onInput={(e) => setQuantity((e.target as HTMLInputElement).value)}
              min="0"
            />
            <span class={styles.unit}>{quantityLabel(resolvedUnit)}</span>
          </div>
        </div>
      )}

      <div class={styles.total}>Total: {total} kcal</div>

      {/* Name */}
      {showNameField && !existingCustomFoodId && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>
            Name {showSaveAsCustom && saveAsCustom ? <span class={styles.required}>*</span> : '(optional)'}
          </div>
          <input
            type="text"
            class={styles.textInput}
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="e.g. Chicken salad"
          />
        </div>
      )}

      {/* Save as custom food */}
      {showSaveAsCustom && !existingCustomFoodId && (<>
        <div class={styles.checkboxRow}>
          <input
            type="checkbox"
            id="ffSaveCustom"
            checked={saveAsCustom}
            onChange={(e) => setSaveAsCustom((e.target as HTMLInputElement).checked)}
          />
          <label for="ffSaveCustom">Save as custom food</label>
        </div>
        <div class={styles.checkboxHint}>All entries are available under "Recents" <em>for a while</em>. A saved custom food is available under "My foods" <em>forever</em>.</div>
      </>)}

      {showSaveAndAddNew && onSaveAndAddNew && (
        <button class={styles.submitButton} disabled={!canSubmit} onClick={handleSaveAndAddNew}>
          Save and add new
        </button>
      )}
      <button
        class={`${styles.submitButton} ${showSaveAndAddNew ? styles.submitButtonSecondary : ''}`}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {showSaveAndAddNew ? 'Save and done' : submitLabel}
      </button>
    </>
  )
}
