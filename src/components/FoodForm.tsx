import { useState, useCallback, useMemo } from 'preact/hooks'
import type { Nutrients } from '../db/index'
import type { CustomFoodAction } from '../db/customFoods'
import {
  formatNutrientSummary,
  hasNutrients,
  nutrientsToInputs,
  parseNutrientInputs,
  scaleNutrients,
  type NutrientKey,
} from '../utils/nutrients'
import { NumericInput } from './NumericInput'
import { NutritionFields } from './NutritionFields'
import styles from './FoodForm.module.css'

export interface FoodFormResult {
  name: string
  calories: number
  unitCalories: number
  /** Per unit, like `unitCalories`. Absent when no value is known. */
  unitNutrients?: Nutrients
  quantity: number
  unit: string
  /** What the caller writes to My foods, from the "Save as custom food" tick. */
  customFoodAction: CustomFoodAction
  /** Barcode to save the food under. Empty when none was scanned, or the user cleared it. */
  barcode: string
  /** The linked saved food, for the caller to update or delete. */
  existingCustomFoodId?: string
}

export interface FoodFormInitial {
  name?: string
  unit?: string
  unitCalories?: number
  nutrients?: Nutrients
  /** Display quantity: grams for 100g/100ml, count for piece/serving/total */
  quantity?: number
}

interface FoodFormProps {
  initial?: FoodFormInitial
  /** Hide unit selector and calories input (used when filled from search) */
  hideUnitAndCalories?: boolean
  portions?: { desc: string; g: number }[] | null
  showSaveAsCustom?: boolean
  /** Controlled, because the barcode banner above the form shows and clears the same value. */
  barcode?: string
  onBarcodeChange?: (value: string) => void
  /** Clearing is more than emptying the field: it also drops the barcode context above. */
  onBarcodeClear?: () => void
  /** Controlled, because clearing the barcode also unticks a tick the barcode context made. */
  saveAsCustom?: boolean
  onSaveAsCustomChange?: (value: boolean) => void
  /** The linked saved food. The tick then stands for it: on replaces its values, off deletes it. */
  existingCustomFoodId?: string
  /** Hide name, Nutrition and the tick: the short form for a picked saved food. */
  hideFoodDetails?: boolean
  /** Edit a saved food: no quantity, no totals and no tick. The name is required. */
  savedFood?: boolean
  submitLabel?: string
  showSaveAndAddNew?: boolean
  onSubmit: (result: FoodFormResult) => void
  onSaveAndAddNew?: (result: FoodFormResult) => void
  scrollAnchorRef?: { current: HTMLDivElement | null }
}

const UNITS = ['100g', '100ml', 'total', 'piece'] as const

function isListedUnit(unit: string): boolean {
  return (UNITS as readonly string[]).includes(unit)
}

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

/** The reverse of the stored quantity: grams for 100g/100ml, count for the others. */
export function displayQuantity(unit: string, dbQuantity: number): number {
  if (unit === 'total') return 1
  // 2 decimals, so a save with no change gives back the same amount
  if (unit === '100g' || unit === '100ml') return Math.round(dbQuantity * 10000) / 100
  return dbQuantity
}

function customFoodAction(tickShown: boolean, ticked: boolean, linked: boolean): CustomFoodAction {
  if (!tickShown) return 'none'
  if (linked) return ticked ? 'update' : 'delete'
  return ticked ? 'add' : 'none'
}

function nutritionUnitLabel(unit: string): string {
  return unit === 'total' ? 'total' : `per ${unit}`
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
  barcode = '',
  onBarcodeChange,
  onBarcodeClear,
  saveAsCustom = false,
  onSaveAsCustomChange,
  existingCustomFoodId,
  hideFoodDetails = false,
  savedFood = false,
  submitLabel = 'Add',
  showSaveAndAddNew = false,
  onSubmit,
  onSaveAndAddNew,
  scrollAnchorRef,
}: FoodFormProps) {
  // A unit with no radio (an OFF serving, a custom unit) shows as the custom one.
  const initialUnit = initial?.unit ?? '100g'
  const [unit, setUnit] = useState(isListedUnit(initialUnit) ? initialUnit : 'custom')
  const [customUnit, setCustomUnit] = useState(isListedUnit(initialUnit) ? '' : initialUnit)
  const [unitCalories, setUnitCalories] = useState(
    initial?.unitCalories !== undefined ? String(initial.unitCalories) : '',
  )
  const [quantity, setQuantity] = useState(initQuantity(initial?.unit, initial?.quantity))
  const [name, setName] = useState(initial?.name ?? '')
  const [nutrientInputs, setNutrientInputs] = useState(() => nutrientsToInputs(initial?.nutrients))

  const cal = parseInt(unitCalories, 10) || 0
  const qty = parseFloat(quantity) || 0
  const resolvedUnit = unit === 'custom' ? (customUnit.trim() || 'portion') : unit
  const total = computeTotal(resolvedUnit, cal, qty)
  const isTotal = unit === 'total'
  const showQuantity = !isTotal && !savedFood

  const enteredNutrients = useMemo(() => parseNutrientInputs(nutrientInputs), [nutrientInputs])
  const nutrientSummary = isTotal || savedFood || qty <= 0
    ? null
    : formatNutrientSummary(scaleNutrients(enteredNutrients, computeDbQuantity(resolvedUnit, qty)))
  const nutritionResult = hideFoodDetails
    ? initial?.nutrients // a saved food keeps its own values, and the section is hidden
    : hasNutrients(enteredNutrients) ? enteredNutrients : undefined
  const tickShown = showSaveAsCustom && !hideFoodDetails && !savedFood
  const nameRequired = savedFood || (tickShown && saveAsCustom)

  const handleNutrientChange = useCallback((key: NutrientKey, value: string) => {
    setNutrientInputs((prev) => ({ ...prev, [key]: value }))
  }, [])

  const canSubmit = cal > 0 && (!nameRequired || name.trim().length > 0)

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
    unitNutrients: nutritionResult,
    quantity: computeDbQuantity(resolvedUnit, qty),
    unit: resolvedUnit,
    customFoodAction: customFoodAction(tickShown, saveAsCustom, !!existingCustomFoodId),
    barcode: barcode.trim(),
    existingCustomFoodId,
  }), [name, total, cal, qty, resolvedUnit, tickShown, saveAsCustom, barcode, existingCustomFoodId, nutritionResult])

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
    setNutrientInputs(nutrientsToInputs(undefined))
    onSaveAsCustomChange?.(false)
    onBarcodeChange?.('')
  }, [canSubmit, buildResult, onSaveAndAddNew, onSaveAsCustomChange, onBarcodeChange])

  const handlePortionTap = useCallback((portion: { desc: string; g: number }) => {
    setQuantity(String(portion.g))
  }, [])

  const displayPortions = useMemo(() => {
    if (!portions || portions.length === 0) return null
    if (unit !== '100g' && unit !== '100ml') return null
    return portions
  }, [portions, unit])

  const barcodeField = (label: string) => (
    <div class={styles.section}>
      <div class={styles.fieldLabel}>{label}</div>
      <div class={styles.inputRow}>
        <input
          type="text"
          inputMode="numeric"
          class={styles.barcodeInput}
          value={barcode}
          onInput={(e) => onBarcodeChange?.((e.target as HTMLInputElement).value)}
          placeholder="e.g. 7622210100234"
        />
        {barcode.length > 0 && (
          <button
            class={styles.clearButton}
            onClick={() => (onBarcodeClear ?? (() => onBarcodeChange?.('')))()}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )

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

      {!savedFood && <div class={styles.total}>Total: {total} kcal</div>}

      {/* Nutrition */}
      {!hideFoodDetails && (
        <NutritionFields
          values={nutrientInputs}
          onChange={handleNutrientChange}
          unitLabel={nutritionUnitLabel(resolvedUnit)}
          summary={nutrientSummary && `Total: ${nutrientSummary}`}
        />
      )}

      {/* Name */}
      {!hideFoodDetails && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>
            Name {nameRequired ? <span class={styles.required}>*</span> : '(optional)'}
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
      {tickShown && (<>
        <div class={styles.checkboxRow}>
          <input
            type="checkbox"
            id="ffSaveCustom"
            checked={saveAsCustom}
            onChange={(e) => onSaveAsCustomChange?.((e.target as HTMLInputElement).checked)}
          />
          <label for="ffSaveCustom">Save as custom food</label>
        </div>
        <div class={styles.checkboxHint}>All entries are available under "Recents" <em>for a while</em>. A saved custom food is available under "My foods" <em>forever</em>.</div>
        {/* A barcode is only kept on a saved food, so the field appears only when the tick is on. */}
        {saveAsCustom && barcodeField('Save under this barcode (optional)')}
      </>)}

      {savedFood && barcodeField('Barcode (optional)')}

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
