import { useState, useMemo, useCallback, useRef } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Nutrients } from '../db/index'
import { hasNutrients } from '../utils/nutrients'
import { findUsdaFoodByName } from '../services/usdaFoods'
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
  /** Seeds the form's barcode field, for callers that arrive with one (e.g. a scan route). */
  initialBarcode?: string
  /** Seeds the form's "save as custom food" tick. */
  initialSaveAsCustom?: boolean
}

interface RecentFood {
  name: string
  unitCalories: number
  unitNutrients?: Nutrients
  quantity: number
  unit: string
}

interface FormFill {
  name: string
  unit: string
  unitCalories: number
  nutrients?: Nutrients
  /** Display quantity (grams for 100g/100ml, count for others) */
  quantity: number
  portions?: { desc: string; g: number }[] | null
  isLiquid?: boolean
  searchQuery?: string
  customFoodId?: string
  /** The barcode of the saved food. Edit puts it in the field, as the tick then stands for that food. */
  barcode?: string
  /** The scan found this food, so its banner already stands for the barcode. */
  foundByBarcode?: boolean
}

export function FoodPicker({
  onSelect,
  onClose,
  date = '',
  showSaveAsCustom = false,
  submitLabel = 'Add',
  showSaveAndAddNew = false,
  initialBarcode = '',
  initialSaveAsCustom = false,
}: FoodPickerProps) {
  const [searching, setSearching] = useState(false)
  const [searchingCustom, setSearchingCustom] = useState(false)
  const [customSearchQuery, setCustomSearchQuery] = useState('')
  const [scanning, setScanning] = useState(false)

  // When a search/barcode/recent fills the form, we store the fill data
  // and bump formKey to remount FoodForm with new initial values.
  const [formFill, setFormFill] = useState<FormFill | null>(null)
  const [formKey, setFormKey] = useState(0)
  // Edit on the banner shows the full form for the picked food. The short form is the default.
  const [editing, setEditing] = useState(false)
  // The barcode, and whether it arrived from a scan. The banner shows while a scan supplied
  // it; a barcode the user types by hand is just a field value and raises no banner.
  const [barcode, setBarcode] = useState(initialBarcode)
  const [barcodeFromScan, setBarcodeFromScan] = useState(initialBarcode.length > 0)
  const [saveAsCustom, setSaveAsCustom] = useState(initialSaveAsCustom)
  // Clearing the barcode only unticks a tick the scan made, never one the user made.
  const [scanTickedSave, setScanTickedSave] = useState(initialSaveAsCustom)

  const handleSaveAsCustomChange = useCallback((value: boolean) => {
    setSaveAsCustom(value)
    // Once the user touches it, the tick is theirs to keep.
    setScanTickedSave(false)
  }, [])

  const clearBarcode = useCallback(() => {
    setBarcode('')
    setBarcodeFromScan(false)
    if (scanTickedSave) setSaveAsCustom(false)
    setScanTickedSave(false)
  }, [scanTickedSave])

  const handleBarcodeChange = useCallback((value: string) => {
    setBarcode(value)
  }, [])

  const bodyRef = useRef<HTMLDivElement>(null)
  const unitRef = useRef<HTMLDivElement>(null)

  const scrollToUnit = useCallback(() => {
    requestAnimationFrame(() => {
      unitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const customFoodCount = useLiveQuery(() => db.customFoods.count())

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
        unitNutrients: entry.unitNutrients,
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
    // A pick starts as the short form. But when a scanned barcode waits to be saved (the tick
    // is on after a scan miss), the full form opens, so the tick stays in sight.
    setEditing(barcodeFromScan && saveAsCustom && !fill.customFoodId && !fill.foundByBarcode)
    // The tick stands for the saved food. It shows only after Edit.
    if (fill.customFoodId) setSaveAsCustom(true)
    scrollToUnit()
  }, [scrollToUnit, barcodeFromScan, saveAsCustom])

  const handleSearchResult = useCallback((result: FoodSearchResult, query: string) => {
    const liquid = /beverages/i.test(result.cat) ||
      /\b(juice|milk|drink|smoothie|water|broth|soup|soda|tea|coffee|wine|beer)\b/i.test(result.name)
    applyFill({
      name: result.name,
      unitCalories: result.kcal,
      unit: '100g',
      quantity: 100,
      nutrients: result.nutrients,
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
      nutrients: result.nutrients,
      customFoodId: result.id,
      barcode: result.barcode,
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
      nutrients: entry.nutrients,
      portions: entry.portions || null,
      customFoodId: entry.customFoodId,
      foundByBarcode: true,
    })
    setBarcode(entry.barcode)
    setBarcodeFromScan(entry.barcode.length > 0)
    setScanning(false)
  }, [applyFill])

  const handleAddManually = useCallback((scanned: string, presetSave: boolean) => {
    setBarcode(scanned)
    setBarcodeFromScan(scanned.length > 0)
    if (presetSave) {
      setSaveAsCustom(true)
      setScanTickedSave(true)
    }
    setScanning(false)
  }, [])

  const handleRecentTap = useCallback(async (item: RecentFood) => {
    let qty: number
    if (item.unit === '100g' || item.unit === '100ml') {
      qty = Math.round(item.quantity * 100)
    } else if (item.unit === 'total') {
      qty = 1
    } else {
      qty = item.quantity
    }
    const match = await db.customFoods.where('name').equals(item.name).first()
    // First source with a known value: the saved food (same name and unit), the entry itself,
    // then the USDA food with the same name (100g only).
    let nutrients: Nutrients | undefined
    if (match && match.unit === item.unit && hasNutrients(match.nutrients)) {
      nutrients = match.nutrients
    } else if (hasNutrients(item.unitNutrients)) {
      nutrients = item.unitNutrients
    } else if (item.unit === '100g') {
      try {
        const usda = await findUsdaFoodByName(item.name)
        if (hasNutrients(usda?.n)) nutrients = usda.n
      } catch {
        // The file did not load. The tap must still fill the form.
      }
    }
    applyFill({
      name: item.name,
      unitCalories: item.unitCalories,
      unit: item.unit,
      quantity: qty,
      nutrients,
      customFoodId: match?.id,
      barcode: match?.barcode,
    })
  }, [applyFill])

  const startEdit = useCallback(() => {
    setEditing(true)
    // A scanned code stays: it is the one to save the food under
    if (formFill?.customFoodId && !barcodeFromScan) setBarcode(formFill.barcode ?? '')
  }, [formFill, barcodeFromScan])

  const clearSearch = useCallback(() => {
    if (formFill?.customFoodId) {
      // Undo what the saved food set: its tick (a scan's own tick stays) and its barcode
      setSaveAsCustom(scanTickedSave)
      if (!barcodeFromScan) setBarcode('')
    }
    setFormFill(null)
    setFormKey((k) => k + 1)
    setEditing(false)
  }, [formFill, scanTickedSave, barcodeFromScan])

  const handleSubmit = useCallback((result: FoodFormResult) => {
    onSelect(result)
    onClose()
  }, [onSelect, onClose])

  const handleSaveAndAddNew = useCallback((result: FoodFormResult) => {
    onSelect(result)
    setFormFill(null)
    setEditing(false)
    clearBarcode()
    setSaveAsCustom(false)
    setFormKey((k) => k + 1)
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onSelect, clearBarcode])

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
          {/* Why the user is here: the scan found nothing, and this is the number it read. */}
          {barcodeFromScan && barcode.length > 0 && !formFill?.foundByBarcode && (
            <div class={styles.barcodeInfo}>
              <span class={styles.barcodeInfoText}>
                Adding an entry for barcode{' '}
                <span class={styles.barcodeInfoCode}>{barcode}</span>
              </span>
              <button class={styles.searchInfoClear} onClick={clearBarcode}>Clear</button>
            </div>
          )}

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
                    My foods
                  </button>
                )}
                {!barcodeFromScan && (
                  <button class={styles.searchButton} onClick={() => setScanning(true)}>
                    Barcode
                  </button>
                )}
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
                  {/* After Edit the kcal can change, so the banner names the food only */}
                  {editing ? formFill.name : `${formFill.name} · ${formFill.unitCalories} kcal/${formFill.unit}`}
                </span>
                <span class={styles.searchInfoActions}>
                  {!editing && <button class={styles.searchInfoClear} onClick={startEdit}>Edit</button>}
                  <button class={styles.searchInfoClear} onClick={clearSearch}>Clear</button>
                </span>
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
              nutrients: formFill.nutrients,
            } : undefined}
            hideUnitAndCalories={!!formFill && !editing}
            portions={formFill?.portions ?? null}
            showSaveAsCustom={showSaveAsCustom}
            barcode={barcode}
            onBarcodeChange={handleBarcodeChange}
            onBarcodeClear={clearBarcode}
            saveAsCustom={saveAsCustom}
            onSaveAsCustomChange={handleSaveAsCustomChange}
            existingCustomFoodId={formFill?.customFoodId}
            hideFoodDetails={!!formFill && !editing}
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
            onShowMyFoods={(q) => {
              setSearching(false)
              setCustomSearchQuery(q)
              setSearchingCustom(true)
            }}
            initialQuery={formFill?.searchQuery ?? ''}
          />
        )}

        {searchingCustom && (
          <CustomFoodSearch
            onSelect={handleCustomFoodResult}
            onClose={() => { setSearchingCustom(false); setCustomSearchQuery('') }}
            initialQuery={customSearchQuery}
          />
        )}

        {scanning && (
          <BarcodeScanner
            date={date}
            onClose={() => setScanning(false)}
            onAddEntry={handleScannedEntry}
            onAddManually={handleAddManually}
          />
        )}
      </div>
    </div>
  )
}
