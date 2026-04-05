import { useState, useMemo, useCallback, useRef } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { FoodSearch, type FoodSearchResult } from './FoodSearch'
import { CustomFoodSearch, type CustomFoodResult } from './CustomFoodSearch'
import { BarcodeScanner, type ScannedEntry } from './BarcodeScanner'
import { FoodForm, type FoodFormResult } from './FoodForm'
import styles from './FoodPicker.module.css'

export type { FoodFormResult as FoodPickerResult }

interface FoodPickerProps {
  onSelect: (result: FoodFormResult) => void
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

interface FormFill {
  name: string
  unit: string
  unitCalories: number
  /** Display quantity (grams for 100g/100ml, count for others) */
  quantity: number
  portions?: { desc: string; g: number }[] | null
  isLiquid?: boolean
  searchQuery?: string
}

export function FoodPicker({
  onSelect,
  onClose,
  date = '',
  showSaveAsCustom = false,
  submitLabel = 'Add',
  showSaveAndAddNew = false,
}: FoodPickerProps) {
  const [searching, setSearching] = useState(false)
  const [searchingCustom, setSearchingCustom] = useState(false)
  const [scanning, setScanning] = useState(false)

  // When a search/barcode/recent fills the form, we store the fill data
  // and bump formKey to remount FoodForm with new initial values.
  const [formFill, setFormFill] = useState<FormFill | null>(null)
  const [formKey, setFormKey] = useState(0)

  const bodyRef = useRef<HTMLDivElement>(null)
  const unitRef = useRef<HTMLDivElement>(null)

  const scrollToUnit = useCallback(() => {
    requestAnimationFrame(() => {
      unitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

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

  const applyFill = useCallback((fill: FormFill) => {
    setFormFill(fill)
    setFormKey((k) => k + 1)
    scrollToUnit()
  }, [scrollToUnit])

  const handleSearchResult = useCallback((result: FoodSearchResult, query: string) => {
    const liquid = /beverages/i.test(result.cat) ||
      /\b(juice|milk|drink|smoothie|water|broth|soup|soda|tea|coffee|wine|beer)\b/i.test(result.name)
    applyFill({
      name: result.name,
      unitCalories: result.kcal,
      unit: '100g',
      quantity: 100,
      portions: result.portions || null,
      isLiquid: liquid,
      searchQuery: query,
    })
    setSearching(false)
  }, [applyFill])

  const handleCustomFoodResult = useCallback((result: CustomFoodResult) => {
    const qty = (result.unit === '100g' || result.unit === '100ml') ? 100 : 1
    applyFill({
      name: result.name,
      unitCalories: result.caloriesPerUnit,
      unit: result.unit,
      quantity: qty,
    })
    setSearchingCustom(false)
  }, [applyFill])

  const handleScannedEntry = useCallback((entry: ScannedEntry) => {
    let qty: number
    if (entry.unit === '100g' || entry.unit === '100ml') {
      qty = Math.round(entry.quantity * 100)
    } else if (entry.unit === 'total') {
      qty = 1
    } else {
      qty = entry.quantity
    }
    applyFill({
      name: entry.name,
      unitCalories: entry.unitCalories,
      unit: entry.unit,
      quantity: qty,
      portions: entry.portions || null,
    })
    setScanning(false)
  }, [applyFill])

  const handleRecentTap = useCallback((item: RecentFood) => {
    let qty: number
    if (item.unit === '100g' || item.unit === '100ml') {
      qty = Math.round(item.quantity * 100)
    } else if (item.unit === 'total') {
      qty = 1
    } else {
      qty = item.quantity
    }
    applyFill({
      name: item.name,
      unitCalories: item.unitCalories,
      unit: item.unit,
      quantity: qty,
    })
  }, [applyFill])

  const clearSearch = useCallback(() => {
    setFormFill(null)
    setFormKey((k) => k + 1)
  }, [])

  const handleSubmit = useCallback((result: FoodFormResult) => {
    onSelect(result)
    onClose()
  }, [onSelect, onClose])

  const handleSaveAndAddNew = useCallback((result: FoodFormResult) => {
    onSelect(result)
    setFormFill(null)
    setFormKey((k) => k + 1)
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onSelect])

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
          {!formFill && (
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
          {recents.length > 0 && !formFill && (
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

          {/* Search info banner (when filled from search) */}
          {formFill && (
            <div ref={unitRef}>
              <div class={styles.searchInfo}>
                <span
                  class={styles.searchInfoText}
                  onClick={() => formFill.searchQuery !== undefined && setSearching(true)}
                >
                  {formFill.name} · {formFill.unitCalories} kcal/{formFill.unit === '100ml' ? '100ml' : '100g'}
                </span>
                <button class={styles.searchInfoClear} onClick={clearSearch}>Clear</button>
              </div>
              {formFill.isLiquid && (
                <div class={styles.liquidNote}>
                  Nutritional data is per 100g by weight. For liquids, use a kitchen scale for best accuracy.
                </div>
              )}
            </div>
          )}

          {/* The form */}
          <FoodForm
            key={formKey}
            initial={formFill ? {
              name: formFill.name,
              unit: formFill.unit,
              unitCalories: formFill.unitCalories,
              quantity: formFill.quantity,
            } : undefined}
            hideUnitAndCalories={!!formFill}
            portions={formFill?.portions ?? null}
            showSaveAsCustom={showSaveAsCustom}
            submitLabel={submitLabel}
            showSaveAndAddNew={showSaveAndAddNew}
            onSubmit={handleSubmit}
            onSaveAndAddNew={showSaveAndAddNew ? handleSaveAndAddNew : undefined}
            scrollAnchorRef={formFill ? undefined : unitRef}
          />
        </div>

        {searching && (
          <FoodSearch
            onSelect={handleSearchResult}
            onClose={() => setSearching(false)}
            initialQuery={formFill?.searchQuery ?? ''}
          />
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
