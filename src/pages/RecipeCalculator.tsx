import { useState, useMemo, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import { todayString } from '../db/dates'
import { FoodSearch, type FoodSearchResult } from '../components/FoodSearch'
import { CustomFoodSearch, type CustomFoodResult } from '../components/CustomFoodSearch'
import { BarcodeScanner, type ScannedEntry } from '../components/BarcodeScanner'
import { NumericInput } from '../components/NumericInput'
import styles from './RecipeCalculator.module.css'

interface RecipeIngredient {
  id: string
  name: string
  kcalPer100g: number
  grams: number
  totalKcal: number
}

export function RecipeCalculator() {
  const date = todayString()

  const [recipeName, setRecipeName] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [totalWeight, setTotalWeight] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Inline add form
  const [addKcal, setAddKcal] = useState('')
  const [addGrams, setAddGrams] = useState('')
  const [addName, setAddName] = useState('')

  // Overlays
  const [scanning, setScanning] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchingCustom, setSearchingCustom] = useState(false)

  const customFoodCount = useLiveQuery(() => db.customFoods.filter((f) => !f.barcode).count())

  // Recents
  const allIntakes = useLiveQuery(() =>
    db.intakeEntries.orderBy('createdAt').reverse().toArray(),
  )

  const recents = useMemo(() => {
    if (!allIntakes) return []
    const seen = new Set<string>()
    const result: { name: string; kcalPer100g: number }[] = []
    for (const entry of allIntakes) {
      if (!entry.name || seen.has(entry.name)) continue
      seen.add(entry.name)
      // Only use entries with 100g/100ml unit for reliable kcal/100g
      const kcal = (entry.unit === '100g' || entry.unit === '100ml')
        ? entry.unitCalories
        : entry.unitCalories
      result.push({ name: entry.name, kcalPer100g: kcal })
      if (result.length >= 6) break
    }
    return result
  }, [allIntakes])

  // Derived
  const totalKcal = ingredients.reduce((sum, i) => sum + i.totalKcal, 0)
  const totalIngredientGrams = ingredients.reduce((sum, i) => sum + i.grams, 0)
  const preparedWeight = parseFloat(totalWeight) || 0
  const kcalPer100g = preparedWeight > 0 ? Math.round(totalKcal / preparedWeight * 100) : null
  const displayName = recipeName.trim() ? `${recipeName.trim()} (${date})` : ''
  const canSave = recipeName.trim().length > 0 && ingredients.length > 0 && preparedWeight > 0

  const addIngredient = () => {
    const kcal = parseFloat(addKcal)
    const grams = parseFloat(addGrams)
    if (!kcal || kcal <= 0 || !grams || grams <= 0) return
    setIngredients([...ingredients, {
      id: crypto.randomUUID(),
      name: addName.trim() || `${kcal} kcal/100g`,
      kcalPer100g: kcal,
      grams,
      totalKcal: Math.round(kcal * grams / 100),
    }])
    setAddKcal('')
    setAddGrams('')
    setAddName('')
  }

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter((i) => i.id !== id))
    setExpandedId(null)
  }

  const handleSearchResult = useCallback((result: FoodSearchResult) => {
    setAddKcal(String(result.kcal))
    setAddName(result.name)
    setAddGrams('')
    setSearching(false)
  }, [])

  const handleCustomFoodResult = useCallback((result: CustomFoodResult) => {
    setAddKcal(String(result.caloriesPerUnit))
    setAddName(result.name)
    setAddGrams('')
    setSearchingCustom(false)
  }, [])

  const handleScannedEntry = useCallback((entry: ScannedEntry) => {
    const kcal = (entry.unit === '100g' || entry.unit === '100ml')
      ? entry.unitCalories
      : entry.unitCalories
    setAddKcal(String(kcal))
    setAddName(entry.name)
    setAddGrams('')
    setScanning(false)
  }, [])

  const handleRecentTap = (recent: { name: string; kcalPer100g: number }) => {
    setAddKcal(String(recent.kcalPer100g))
    setAddName(recent.name)
    setAddGrams('')
  }

  const handleSave = async () => {
    if (!canSave || kcalPer100g === null) return

    await db.customFoods.add({
      id: crypto.randomUUID(),
      name: displayName,
      caloriesPerUnit: kcalPer100g,
      unit: '100g',
      lastUsed: new Date().toISOString(),
    })

    route('/')
  }

  const addDisabled = !addKcal || parseFloat(addKcal) <= 0 || !addGrams || parseFloat(addGrams) <= 0

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Recipe Calculator</h1>
      </div>

      {/* Recipe name */}
      <div class={styles.section}>
        <div class={styles.sectionTitle}>Recipe name</div>
        <input
          type="text"
          class={styles.nameInput}
          value={recipeName}
          onInput={(e) => setRecipeName((e.target as HTMLInputElement).value)}
          placeholder="e.g. Lasagne"
        />
        <div class={styles.nameHint}>
          {recipeName.trim()
            ? `Will be saved as: ${displayName}`
            : 'Date will be appended to the name'}
        </div>
      </div>

      {/* Ingredients list */}
      {ingredients.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Ingredients</div>
          <div class={styles.itemList}>
            {ingredients.map((item) => (
              <div key={item.id}>
                <div
                  class={styles.item}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <span class={styles.itemName}>{item.name}</span>
                  <span class={styles.itemGrams}>{item.grams}g</span>
                  <span class={styles.itemCal}>{item.totalKcal} kcal</span>
                </div>
                {expandedId === item.id && (
                  <div class={styles.itemActions}>
                    <button class={styles.deleteButton} onClick={() => removeIngredient(item.id)}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div class={styles.ingredientTotal}>
            Total: {totalKcal} kcal from {totalIngredientGrams}g of ingredients
          </div>
        </div>
      )}

      {/* Add ingredient */}
      <div class={styles.section}>
        <div class={styles.sectionTitle}>Add ingredient</div>
        <div class={styles.addRow}>
          <NumericInput
            class={styles.addInput}
            value={addKcal}
            onInput={(e) => setAddKcal((e.target as HTMLInputElement).value)}
            placeholder="kcal/100g"
          />
          <NumericInput
            class={styles.addInput}
            value={addGrams}
            onInput={(e) => setAddGrams((e.target as HTMLInputElement).value)}
            placeholder="grams"
          />
          <button
            class={styles.addButton}
            disabled={addDisabled}
            onClick={addIngredient}
          >
            +
          </button>
        </div>
        <input
          type="text"
          class={styles.addNameInput}
          value={addName}
          onInput={(e) => setAddName((e.target as HTMLInputElement).value)}
          placeholder="Name (optional)"
        />
        <div class={styles.lookupButtons}>
          <button class={styles.lookupButton} onClick={() => setSearching(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Search Food DB
          </button>
          <button class={styles.lookupButton} onClick={() => setScanning(true)}>
            Scan Barcode
          </button>
        </div>
        {(customFoodCount ?? 0) > 0 && (
          <button class={styles.lookupButton} onClick={() => setSearchingCustom(true)}>
            Search my prepared meals
          </button>
        )}
      </div>

      {/* Recents */}
      {recents.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Recent</div>
          <div class={styles.recentList}>
            {recents.map((r) => (
              <button key={r.name} class={styles.recentItem} onClick={() => handleRecentTap(r)}>
                <span class={styles.recentName}>{r.name}</span>
                <span class={styles.recentCal}>{r.kcalPer100g} kcal/100g</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prepared food weight + result */}
      {ingredients.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Prepared food weight</div>
          <div class={styles.resultRow}>
            <NumericInput
              class={styles.weightInput}
              value={totalWeight}
              onInput={(e) => setTotalWeight((e.target as HTMLInputElement).value)}
              placeholder="0"
              min="0"
            />
            <span class={styles.unitLabel}>g</span>
          </div>
          <div class={styles.weightHint}>
            Ingredients total: {totalIngredientGrams}g
          </div>
          <div class={styles.result}>
            {kcalPer100g !== null
              ? `Result: ${kcalPer100g} kcal/100g`
              : 'Enter weight to calculate'}
          </div>
        </div>
      )}

      {/* Actions */}
      <div class={styles.actions}>
        <button class={styles.dismissButton} onClick={() => route('/')}>
          Dismiss
        </button>
        <button
          class={styles.saveButton}
          disabled={!canSave}
          onClick={handleSave}
        >
          Save Recipe
        </button>
      </div>

      {searching && (
        <FoodSearch onSelect={handleSearchResult} onClose={() => setSearching(false)} />
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
  )
}
