import { useState, useMemo, useCallback, useRef } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { FoodSearch, type FoodSearchResult } from './FoodSearch'
import { CustomFoodSearch, type CustomFoodResult } from './CustomFoodSearch'
import { BarcodeScanner, type ScannedEntry } from './BarcodeScanner'
import { NumericInput } from './NumericInput'
import styles from './FoodPicker.module.css'

export interface FoodPickerResult {
  name: string
  calories: number
  unitCalories: number
  quantity: number
  unit: string
  saveAsCustom: boolean
}

interface FoodPickerProps {
  onSelect: (result: FoodPickerResult) => void
  onClose: () => void
  date?: string
  showSaveAsCustom?: boolean
  submitLabel?: string
  showSaveAndAddNew?: boolean
}

interface RecentFood {
  name: string
  unitCalories: number
  quantity: number
  unit: string
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

export function FoodPicker({
  onSelect,
  onClose,
  date = '',
  showSaveAsCustom = false,
  submitLabel = 'Add',
  showSaveAndAddNew = false,
}: FoodPickerProps) {
  const [unit, setUnit] = useState('100g')
  const [customUnit, setCustomUnit] = useState('')
  const [unitCalories, setUnitCalories] = useState('')
  const [quantity, setQuantity] = useState('100')
  const [name, setName] = useState('')
  const [saveAsCustom, setSaveAsCustom] = useState(false)

  const [searching, setSearching] = useState(false)
  const [searchingCustom, setSearchingCustom] = useState(false)
  const [scanning, setScanning] = useState(false)

  const [portions, setPortions] = useState<{ desc: string; g: number }[] | null>(null)
  const [fromSearch, setFromSearch] = useState(false)
  const [isLiquid, setIsLiquid] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  const customFoodCount = useLiveQuery(() => db.customFoods.filter((f) => !f.barcode).count())

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
        unit: entry.unit,
      })
      if (result.length >= 100) break
    }
    return result
  }, [allIntakes])

  const cal = parseInt(unitCalories, 10) || 0
  const qty = parseFloat(quantity) || 0
  const resolvedUnit = unit === 'custom' ? (customUnit.trim() || 'portion') : unit
  const total = computeTotal(resolvedUnit, cal, qty)
  const isTotal = unit === 'total'
  const showQuantity = !isTotal

  const canSubmit = cal > 0 && (!saveAsCustom || name.trim().length > 0)

  const handleUnitChange = useCallback((newUnit: string) => {
    setUnit(newUnit)
    if (newUnit === '100g' || newUnit === '100ml') {
      setQuantity('100')
    } else if (newUnit === 'total') {
      setQuantity('1')
    } else if (newUnit === 'piece' || newUnit === 'custom') {
      setQuantity('1')
    }
  }, [])

  const handleSearchResult = useCallback((result: FoodSearchResult, query: string) => {
    const liquid = /beverages/i.test(result.cat) ||
      /\b(juice|milk|drink|smoothie|water|broth|soup|soda|tea|coffee|wine|beer)\b/i.test(result.name)
    setName(result.name)
    setUnitCalories(String(result.kcal))
    setUnit('100g')
    setQuantity('100')
    setPortions(result.portions || null)
    setFromSearch(true)
    setIsLiquid(liquid)
    setSearchQuery(query)
    setSearching(false)
  }, [])

  const handleCustomFoodResult = useCallback((result: CustomFoodResult) => {
    setName(result.name)
    setUnitCalories(String(result.caloriesPerUnit))
    setUnit(result.unit)
    setPortions(null)
    setFromSearch(true)
    setIsLiquid(false)
    setSearchQuery('')
    if (result.unit === '100g' || result.unit === '100ml') {
      setQuantity('100')
    } else {
      setQuantity('1')
    }
    setSearchingCustom(false)
  }, [])

  const handleScannedEntry = useCallback((entry: ScannedEntry) => {
    setName(entry.name)
    setUnitCalories(String(entry.unitCalories))
    setUnit(entry.unit)
    setPortions(entry.portions || null)
    setFromSearch(true)
    setIsLiquid(false)
    setSearchQuery('')
    if (entry.unit === '100g' || entry.unit === '100ml') {
      setQuantity(String(Math.round(entry.quantity * 100)))
    } else if (entry.unit === 'total') {
      setQuantity('1')
    } else {
      setQuantity(String(entry.quantity))
    }
    setScanning(false)
  }, [])

  const handlePortionTap = useCallback((portion: { desc: string; g: number }) => {
    setQuantity(String(portion.g))
  }, [])

  const handleRecentTap = useCallback((item: RecentFood) => {
    setName(item.name)
    setUnitCalories(String(item.unitCalories))
    setUnit(item.unit)
    setPortions(null)
    setFromSearch(false)
    if (item.unit === '100g' || item.unit === '100ml') {
      setQuantity(String(Math.round(item.quantity * 100)))
    } else if (item.unit === 'total') {
      setQuantity('1')
    } else {
      setQuantity(String(item.quantity))
    }
  }, [])

  const clearSearch = useCallback(() => {
    setPortions(null)
    setFromSearch(false)
    setIsLiquid(false)
    setSearchQuery('')
    setName('')
    setUnitCalories('')
    setQuantity('100')
    setUnit('100g')
  }, [])

  const buildResult = useCallback((): FoodPickerResult => ({
    name: name.trim() || `${total} kcal`,
    calories: total,
    unitCalories: cal,
    quantity: computeDbQuantity(resolvedUnit, qty),
    unit: resolvedUnit,
    saveAsCustom,
  }), [name, total, cal, qty, resolvedUnit, saveAsCustom])

  const resetForm = useCallback(() => {
    setUnit('100g')
    setCustomUnit('')
    setUnitCalories('')
    setQuantity('100')
    setName('')
    setSaveAsCustom(false)
    setPortions(null)
    setFromSearch(false)
    setIsLiquid(false)
    setSearchQuery('')
  }, [])

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    onSelect(buildResult())
    onClose()
  }, [canSubmit, buildResult, onSelect, onClose])

  const handleSaveAndAddNew = useCallback(() => {
    if (!canSubmit) return
    onSelect(buildResult())
    resetForm()
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [canSubmit, buildResult, onSelect, resetForm])

  return (
    <div class={styles.overlay}>
      <div class={styles.container}>
        <div class={styles.header}>
          <button class={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 class={styles.headerTitle}>Select Food</h1>
        </div>

        <div class={styles.body} ref={bodyRef}>
          {/* Search buttons */}
          {!fromSearch && (
            <div class={styles.section}>
              <div class={styles.sectionTitle}>Search</div>
              <div class={styles.searchButtons}>
                <button class={styles.searchButton} onClick={() => setSearching(true)}>
                  Food
                </button>
                {(customFoodCount ?? 0) > 0 && (
                  <button class={styles.searchButton} onClick={() => setSearchingCustom(true)}>
                    My recipes
                  </button>
                )}
                <button class={styles.searchButton} onClick={() => setScanning(true)}>
                  Barcode
                </button>
              </div>
            </div>
          )}

          {/* Recents */}
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

          {/* Search info banner / Unit selector */}
          {fromSearch ? (
            <div>
              <div class={styles.searchInfo}>
                <span class={styles.searchInfoText} onClick={() => setSearching(true)}>
                  {name} · {unitCalories} kcal/{unit === '100ml' ? '100ml' : '100g'}
                </span>
                <button class={styles.searchInfoClear} onClick={clearSearch}>Clear</button>
              </div>
              {isLiquid && (
                <div class={styles.liquidNote}>
                  Nutritional data is per 100g by weight. For liquids, use a kitchen scale for best accuracy.
                </div>
              )}
            </div>
          ) : (
            <div class={styles.section}>
              <div class={styles.fieldLabel}>Unit</div>
              <div class={styles.unitOptions}>
                {UNITS.map((opt) => (
                  <label key={opt} class={styles.unitOption}>
                    <input
                      type="radio"
                      name="fp-unit"
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
                    name="fp-unit"
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
          {!fromSearch && (
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
          {showQuantity && portions && portions.length > 0 && (unit === '100g' || unit === '100ml') && (
            <div class={styles.section}>
              <div class={styles.fieldLabel}>Quick portion</div>
              <div class={styles.portionChips}>
                {portions.map((p, i) => (
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

          {/* Save as custom food */}
          {showSaveAsCustom && (
            <div class={styles.checkboxRow}>
              <input
                type="checkbox"
                id="fpSaveCustom"
                checked={saveAsCustom}
                onChange={(e) => setSaveAsCustom((e.target as HTMLInputElement).checked)}
              />
              <label for="fpSaveCustom">Save as custom food</label>
            </div>
          )}

          {showSaveAndAddNew && (
            <button class={styles.submitButton} disabled={!canSubmit} onClick={handleSaveAndAddNew}>
              Save and add new
            </button>
          )}
          <button class={`${styles.submitButton} ${showSaveAndAddNew ? styles.submitButtonSecondary : ''}`} disabled={!canSubmit} onClick={handleSubmit}>
            {showSaveAndAddNew ? 'Save and done' : submitLabel}
          </button>
        </div>

        {searching && (
          <FoodSearch onSelect={handleSearchResult} onClose={() => setSearching(false)} initialQuery={searchQuery} />
        )}

        {searchingCustom && (
          <CustomFoodSearch onSelect={handleCustomFoodResult} onClose={() => setSearchingCustom(false)} />
        )}

        {scanning && (
          <BarcodeScanner
            date={date}
            onClose={() => setScanning(false)}
            onAddEntry={handleScannedEntry}
          />
        )}
      </div>
    </div>
  )
}
