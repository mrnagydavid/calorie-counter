import { useState, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { db } from '../db/index'
import { todayString } from '../db/dates'
import { FoodPicker, type FoodPickerResult } from '../components/FoodPicker'
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
  const [picking, setPicking] = useState(false)

  // Derived
  const totalKcal = ingredients.reduce((sum, i) => sum + i.totalKcal, 0)
  const totalIngredientGrams = ingredients.reduce((sum, i) => sum + i.grams, 0)
  const preparedWeight = parseFloat(totalWeight) || 0
  const kcalPer100g = preparedWeight > 0 ? Math.round(totalKcal / preparedWeight * 100) : null
  const displayName = recipeName.trim() ? `${recipeName.trim()} (${date})` : ''
  const canSave = recipeName.trim().length > 0 && ingredients.length > 0 && preparedWeight > 0

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter((i) => i.id !== id))
    setExpandedId(null)
  }

  const handleFoodPicked = useCallback((result: FoodPickerResult) => {
    let ingredientKcalPer100g: number
    let grams: number

    if (result.unit === '100g' || result.unit === '100ml') {
      ingredientKcalPer100g = result.unitCalories
      grams = Math.round(result.quantity * 100)
    } else {
      // For non-weight units, use total calories and reverse-calculate grams
      ingredientKcalPer100g = result.unitCalories
      grams = result.unitCalories > 0
        ? Math.round(result.calories / result.unitCalories * 100)
        : 0
    }

    setIngredients((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: result.name,
      kcalPer100g: ingredientKcalPer100g,
      grams,
      totalKcal: result.calories,
    }])
    setPicking(false)
  }, [])

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
        <button class={styles.addItemButton} onClick={() => setPicking(true)}>
          + Add ingredient
        </button>
      </div>

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

      {picking && (
        <FoodPicker
          date={date}
          onSelect={handleFoodPicked}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
