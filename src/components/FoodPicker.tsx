import { useState, useMemo, useCallback, useRef, useEffect } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Nutrients } from '../db/index'
import { hasNutrients } from '../utils/nutrients'
import { findUsdaFoodByName } from '../services/usdaFoods'
import { FoodSearch, type FoodSearchResult } from './FoodSearch'
import { CustomFoodSearch, type CustomFoodResult } from './CustomFoodSearch'
import { BarcodeScanner, type ScannedEntry } from './BarcodeScanner'
import { FoodForm, displayQuantity, type FoodFormResult } from './FoodForm'
import styles from './FoodPicker.module.css'

export type { FoodFormResult as FoodPickerResult }

interface FoodPickerProps {
  /** Called once per food. A multi-add from Recents calls it for each food, in tick order, then closes. */
  onSelect: (result: FoodFormResult) => void | Promise<void>
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

/** One food of a multi-add from Recents, and what the user did on its form. */
interface QueueItem {
  fill: FormFill
  /** Set by Next. When the user comes back to this food, the form shows these values. */
  result?: FoodFormResult
  editing: boolean
  saveAsCustom: boolean
  barcode: string
}

const LONG_PRESS_MS = 500
/** How far a finger can move before the press counts as a scroll. */
const LONG_PRESS_SLOP_PX = 10

/** The form fill for a Recent: the amount from last time, and nutrients from the first source that has them. */
async function recentFill(item: RecentFood): Promise<FormFill> {
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
  return {
    name: item.name,
    unitCalories: item.unitCalories,
    unit: item.unit,
    quantity: qty,
    nutrients,
    customFoodId: match?.id,
    barcode: match?.barcode,
  }
}

function foodsLabel(count: number): string {
  return count === 1 ? 'Add 1 food' : `Add ${count} foods`
}

function entriesLabel(count: number): string {
  return count === 1 ? 'Add entry' : `Add ${count} entries`
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

  // Multi-add from Recents: first the user ticks foods, then the queue shows one form per food.
  const [selecting, setSelecting] = useState(false)
  // Names in tick order, which is also the order of the entries
  const [selected, setSelected] = useState<string[]>([])
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [queueIndex, setQueueIndex] = useState(0)
  const [startingQueue, setStartingQueue] = useState(false)
  const savingQueue = useRef(false)
  const pressTimer = useRef<number | undefined>(undefined)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const pressFired = useRef(false)
  // A scanned barcode is for one food, so that flow has no multi-add.
  const canMultiSelect = !barcodeFromScan

  useEffect(() => () => window.clearTimeout(pressTimer.current), [])

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
    applyFill(await recentFill(item))
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

  // ---- Selecting Recents ----

  const stopSelecting = useCallback(() => {
    setSelecting(false)
    setSelected([])
  }, [])

  const toggleSelected = useCallback((name: string) => {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]
    setSelected(next)
    // Unticking the last food ends the selection, the same as Cancel
    if (next.length === 0) setSelecting(false)
  }, [selected])

  const cancelPress = useCallback(() => {
    window.clearTimeout(pressTimer.current)
    pressStart.current = null
  }, [])

  const handlePressStart = useCallback((e: PointerEvent, name: string) => {
    // A long-press whose click never came must not eat the next tap
    pressFired.current = false
    if (!canMultiSelect || selecting) return
    pressStart.current = { x: e.clientX, y: e.clientY }
    window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => {
      pressFired.current = true
      pressStart.current = null
      navigator.vibrate?.(10)
      setSelecting(true)
      setSelected([name])
    }, LONG_PRESS_MS)
  }, [canMultiSelect, selecting])

  const handlePressMove = useCallback((e: PointerEvent) => {
    const start = pressStart.current
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_SLOP_PX) cancelPress()
  }, [cancelPress])

  const handleRecentClick = useCallback((item: RecentFood) => {
    // The click at the end of a long-press only starts the selection
    if (pressFired.current) {
      pressFired.current = false
      return
    }
    if (selecting) toggleSelected(item.name)
    else void handleRecentTap(item)
  }, [selecting, toggleSelected, handleRecentTap])

  // ---- The queue: one form per ticked food ----

  const showQueueItem = useCallback((items: QueueItem[], index: number) => {
    const item = items[index]
    const r = item.result
    // A food the user already passed shows what they set, also after Edit
    setFormFill(r ? {
      ...item.fill,
      name: r.name,
      unit: r.unit,
      unitCalories: r.unitCalories,
      nutrients: r.unitNutrients,
      quantity: displayQuantity(r.unit, r.quantity),
    } : item.fill)
    setEditing(item.editing)
    setSaveAsCustom(item.saveAsCustom)
    setBarcode(item.barcode)
    setQueueIndex(index)
    setFormKey((k) => k + 1)
    bodyRef.current?.scrollTo({ top: 0 })
  }, [])

  /** The queue with the current food's form state kept, so a return to it shows the same. */
  const keepCurrent = useCallback((items: QueueItem[], result?: FoodFormResult): QueueItem[] =>
    items.map((item, i) => (i === queueIndex
      ? { ...item, result: result ?? item.result, editing, saveAsCustom, barcode }
      : item)),
  [queueIndex, editing, saveAsCustom, barcode])

  const startQueue = useCallback(async () => {
    const items = selected.flatMap((name) => recents.filter((r) => r.name === name))
    if (items.length === 0) return
    if (items.length === 1) {
      // One food is a normal pick
      stopSelecting()
      await handleRecentTap(items[0])
      return
    }
    setStartingQueue(true)
    try {
      const fills = await Promise.all(items.map(recentFill))
      const next = fills.map((fill) => ({
        fill,
        editing: false,
        // The same as a single pick: the tick stands for the saved food, and shows after Edit
        saveAsCustom: !!fill.customFoodId,
        barcode: '',
      }))
      setQueue(next)
      showQueueItem(next, 0)
    } finally {
      setStartingQueue(false)
    }
  }, [selected, recents, stopSelecting, handleRecentTap, showQueueItem])

  /** Back to the ticked Recents. The selection stays, so the user can add or drop foods. */
  const leaveQueue = useCallback(() => {
    setQueue(null)
    setFormFill(null)
    setEditing(false)
    setSaveAsCustom(false)
    setBarcode('')
    setFormKey((k) => k + 1)
  }, [])

  const handleQueueBack = useCallback(() => {
    if (!queue) return
    if (queueIndex === 0) {
      leaveQueue()
      return
    }
    const items = keepCurrent(queue)
    setQueue(items)
    showQueueItem(items, queueIndex - 1)
  }, [queue, queueIndex, keepCurrent, showQueueItem, leaveQueue])

  const handleQueueRemove = useCallback(() => {
    if (!queue) return
    const removed = queue[queueIndex]
    const items = queue.filter((_, i) => i !== queueIndex)
    setSelected((prev) => prev.filter((name) => name !== removed.fill.name))
    if (items.length === 0) {
      leaveQueue()
      setSelecting(false)
      return
    }
    setQueue(items)
    showQueueItem(items, Math.min(queueIndex, items.length - 1))
  }, [queue, queueIndex, showQueueItem, leaveQueue])

  const handleQueueSubmit = useCallback(async (result: FoodFormResult) => {
    if (!queue || savingQueue.current) return
    const items = keepCurrent(queue, result)
    if (queueIndex < items.length - 1) {
      setQueue(items)
      showQueueItem(items, queueIndex + 1)
      return
    }
    // Nothing is saved before the last food, so Back can still change any of them.
    // One at a time, so the entries keep the tick order.
    savingQueue.current = true
    for (const item of items) {
      if (item.result) await onSelect(item.result)
    }
    onClose()
  }, [queue, queueIndex, keepCurrent, showQueueItem, onSelect, onClose])

  const handleBack = queue ? handleQueueBack : selecting ? stopSelecting : onClose
  const pickingRecents = selecting && !queue
  const isLastInQueue = !!queue && queueIndex === queue.length - 1
  const nextInQueue = queue && !isLastInQueue ? queue[queueIndex + 1] : null
  const otherQueueCalories = queue
    ? queue.reduce((sum, item, i) => (i === queueIndex ? sum : sum + (item.result?.calories ?? 0)), 0)
    : 0

  return (
    <div class={styles.overlay}>
      <div class={styles.container}>
        <div class={styles.header}>
          <button class={styles.closeButton} onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 class={styles.headerTitle}>
            {queue ? `Food ${queueIndex + 1} of ${queue.length}` : 'Select Food'}
          </h1>
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
            <div class={`${styles.section} ${pickingRecents ? styles.dimmed : ''}`}>
              <div class={styles.sectionTitle}>Search</div>
              <div class={styles.searchButtons}>
                <button class={styles.searchButton} disabled={pickingRecents} onClick={() => setSearching(true)}>
                  Food
                </button>
                {(customFoodCount ?? 0) > 0 && (
                  <button class={styles.searchButton} disabled={pickingRecents} onClick={() => setSearchingCustom(true)}>
                    My foods
                  </button>
                )}
                {!barcodeFromScan && (
                  <button class={styles.searchButton} disabled={pickingRecents} onClick={() => setScanning(true)}>
                    Barcode
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recents */}
          {recents.length > 0 && !formFill && (
            <div class={styles.section}>
              <div class={`${styles.sectionTitle} ${styles.sectionTitleRow}`}>
                {pickingRecents ? `Recent · ${selected.length} selected` : 'Recent'}
                {pickingRecents && (
                  <button class={styles.sectionAction} onClick={stopSelecting}>Cancel</button>
                )}
              </div>
              {/* A long-press is hard to find, so the label tells the user it is there */}
              {(pickingRecents || canMultiSelect) && (
                <div class={styles.selectHint}>
                  {pickingRecents
                    ? 'You are adding several foods. You get the form for each food, one after the other.'
                    : 'Long press a row to select multiple items'}
                </div>
              )}
              <div class={`${styles.recentList} ${pickingRecents ? styles.recentListSelecting : ''}`}>
                {recents.map((item) => {
                  const isSelected = pickingRecents && selected.includes(item.name)
                  return (
                    <button
                      key={item.name}
                      class={`${styles.recentItem} ${isSelected ? styles.recentItemSelected : ''}`}
                      onClick={() => handleRecentClick(item)}
                      onPointerDown={(e) => handlePressStart(e, item.name)}
                      onPointerMove={handlePressMove}
                      onPointerUp={cancelPress}
                      onPointerLeave={cancelPress}
                      onPointerCancel={cancelPress}
                      onContextMenu={(e) => { if (canMultiSelect) e.preventDefault() }}
                    >
                      {pickingRecents && <span class={styles.recentCheck} />}
                      <span class={styles.recentName}>{item.name}</span>
                      <span class={styles.recentCal}>{item.unitCalories} kcal</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Search info banner (when filled from search) */}
          {formFill && (
            <div ref={unitRef}>
              {queue && (
                <div class={styles.progress}>
                  {queue.map((item, i) => (
                    <span key={item.fill.name} class={i <= queueIndex ? styles.progressDone : undefined} />
                  ))}
                </div>
              )}
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
                  {queue
                    ? <button class={styles.searchInfoClear} onClick={handleQueueRemove}>Remove</button>
                    : <button class={styles.searchInfoClear} onClick={clearSearch}>Clear</button>}
                </span>
              </div>
              {formFill.isLiquid && (
                <div class={styles.liquidNote}>
                  Nutritional data is per 100g by weight. For liquids, use a kitchen scale for best accuracy.
                </div>
              )}
            </div>
          )}

          {/* The form. While the user ticks Recents, the forms come later, one per food. */}
          {!pickingRecents && (
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
              submitLabel={queue
                ? (nextInQueue ? `Next: ${nextInQueue.result?.name ?? nextInQueue.fill.name}` : entriesLabel(queue.length))
                : submitLabel}
              showSaveAndAddNew={showSaveAndAddNew && !queue}
              onSubmit={queue ? handleQueueSubmit : handleSubmit}
              onSaveAndAddNew={showSaveAndAddNew && !queue ? handleSaveAndAddNew : undefined}
              combinedTotal={queue && isLastInQueue && queue.length > 1
                ? { count: queue.length, otherCalories: otherQueueCalories }
                : undefined}
              scrollAnchorRef={formFill ? undefined : unitRef}
            />
          )}
        </div>

        {pickingRecents && (
          <div class={styles.footer}>
            <button
              class={styles.footerButton}
              disabled={selected.length === 0 || startingQueue}
              onClick={startQueue}
            >
              {foodsLabel(selected.length)}
            </button>
          </div>
        )}

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
