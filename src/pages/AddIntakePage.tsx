import { useState, useMemo, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { FoodSearch, type FoodSearchResult } from '../components/FoodSearch'
import styles from './AddIntakePage.module.css'

interface AddIntakePageProps {
  date?: string
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

export function AddIntakePage({ date = '' }: AddIntakePageProps) {
  const barcode = new URLSearchParams(window.location.search).get('barcode') || ''
  const hasBarcode = barcode.length > 0

  const [unit, setUnit] = useState('100g')
  const [customUnit, setCustomUnit] = useState('')
  const [unitCalories, setUnitCalories] = useState('')
  const [quantity, setQuantity] = useState('100')
  const [name, setName] = useState('')
  const [saveAsCustom, setSaveAsCustom] = useState(hasBarcode)
  const [searching, setSearching] = useState(false)
  const [portions, setPortions] = useState<{ desc: string; g: number }[] | null>(null)
  const [fromSearch, setFromSearch] = useState(false)
  const [isLiquid, setIsLiquid] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
      if (result.length >= 10) break
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

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    const entryName = name.trim() || `${total} kcal`

    await db.intakeEntries.add({
      id: crypto.randomUUID(),
      date,
      name: entryName,
      calories: total,
      quantity: computeDbQuantity(resolvedUnit, qty),
      unitCalories: cal,
      unit: resolvedUnit,
      source: hasBarcode ? 'barcode' : 'manual',
      barcode: hasBarcode ? barcode : undefined,
      createdAt: new Date().toISOString(),
    })

    if (saveAsCustom && name.trim()) {
      await db.customFoods.put({
        id: crypto.randomUUID(),
        name: name.trim(),
        caloriesPerUnit: cal,
        unit: resolvedUnit,
        barcode: hasBarcode ? barcode : undefined,
        lastUsed: new Date().toISOString(),
      })
    }

    route('/', true)
  }, [canSubmit, date, name, total, qty, cal, resolvedUnit, saveAsCustom, hasBarcode, barcode])

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route('/', true)}>
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

      {/* Search button (hidden when already filled from search) */}
      {!fromSearch && (
        <button class={styles.searchButton} onClick={() => setSearching(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Search food database
        </button>
      )}

      {/* 1. Unit selector (hidden when filled from search) */}
      {fromSearch ? (
        <div>
          <div class={styles.searchInfo}>
            <span class={styles.searchInfoText} onClick={() => setSearching(true)}>{name} · {unitCalories} kcal/100g</span>
            <button class={styles.searchInfoClear} onClick={() => {
              setPortions(null)
              setFromSearch(false)
              setIsLiquid(false)
              setSearchQuery('')
              setName('')
              setUnitCalories('')
              setQuantity('100')
              setUnit('100g')
            }}>Clear</button>
          </div>
          {isLiquid && (
            <div class={styles.liquidNote}>
              ⚠️ Nutritional data is per 100g by weight. For liquids, use a kitchen scale for best accuracy — volume and weight may differ.
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
                  name="unit"
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
                name="unit"
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

      {/* 2. Calories per unit (hidden when filled from search) */}
      {!fromSearch && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>
            {isTotal ? 'Total calories' : `Calories per ${resolvedUnit}`}
          </div>
          <div class={styles.inputRow}>
            <input
              type="number"
              inputMode="numeric"
              class={styles.calorieInput}
              value={unitCalories}
              onInput={(e) => setUnitCalories((e.target as HTMLInputElement).value)}
              onFocus={(e) => (e.target as HTMLInputElement).select()}
              placeholder="0"
              min="0"
            />
            <span class={styles.unit}>kcal</span>
          </div>
        </div>
      )}

      {/* Portion quick-picks (shown when a USDA food with portions is selected and unit is 100g/100ml) */}
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
                {p.desc} <span class={styles.portionChipG}>{p.g}g</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Quantity (hidden for "total") */}
      {showQuantity && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>Quantity ({quantityLabel(resolvedUnit)})</div>
          <div class={styles.inputRow}>
            <input
              type="number"
              class={styles.calorieInput}
              value={quantity}
              onInput={(e) => setQuantity((e.target as HTMLInputElement).value)}
              onFocus={(e) => (e.target as HTMLInputElement).select()}
              min="0"
            />
            <span class={styles.unit}>{quantityLabel(resolvedUnit)}</span>
          </div>
        </div>
      )}

      <div class={styles.total}>Total: {total} kcal</div>

      {/* 4. Save as custom food */}
      <div class={styles.checkboxRow}>
        <input
          type="checkbox"
          id="saveCustom"
          checked={saveAsCustom}
          onChange={(e) => setSaveAsCustom((e.target as HTMLInputElement).checked)}
        />
        <label for="saveCustom">Save as custom food</label>
      </div>

      {/* 5. Name */}
      <div class={styles.section}>
        <div class={styles.fieldLabel}>
          Name {saveAsCustom ? <span class={styles.required}>*</span> : '(optional)'}
        </div>
        <input
          type="text"
          class={styles.textInput}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="e.g. Chicken salad"
        />
      </div>

      <button class={styles.submitButton} disabled={!canSubmit} onClick={handleSubmit}>
        Add Entry
      </button>

      {searching && (
        <FoodSearch onSelect={handleSearchResult} onClose={() => setSearching(false)} initialQuery={searchQuery} />
      )}
    </div>
  )
}
