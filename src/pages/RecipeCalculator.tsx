import { useState, useCallback, useEffect, useRef } from 'preact/hooks'
import { route } from 'preact-router'
import { db, type Nutrients } from '../db/index'
import { applyCustomFoodAction } from '../db/customFoods'
import { FoodPicker, type FoodPickerResult } from '../components/FoodPicker'
import { FeatureIntro } from '../components/FeatureIntro'
import { DraftRestoreBanner } from '../components/DraftRestoreBanner'
import { NumericInput } from '../components/NumericInput'
import { useDraftCache } from '../hooks/useDraftCache'
import { useToday } from '../hooks/useToday'
import { useNutritionFormOpen } from '../hooks/useNutritionFormOpen'
import { hasNutrients, knownTotals, roundNutrients, scaleNutrients, sumNutrients } from '../utils/nutrients'
import { NutritionRows } from '../components/NutritionRows'
import styles from './RecipeCalculator.module.css'

interface RecipeCalculatorDraft {
  recipeName: string
  ingredients: RecipeIngredient[]
  totalWeight: string
}

interface RecipeIngredient {
  id: string
  name: string
  kcalPer100g: number
  grams: number
  totalKcal: number
  /** Total for this amount, not per unit. Absent when no value is known. */
  totalNutrients?: Nutrients
}

export function RecipeCalculator() {
  // Re-read over midnight, so a calculator left open does not save the recipe under yesterday
  const date = useToday()

  const [recipeName, setRecipeName] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [totalWeight, setTotalWeight] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  // Shared with the Nutrition section of the intake form
  const [nutritionOpen, toggleNutrition] = useNutritionFormOpen()

  // Draft cache
  const draft = useDraftCache<RecipeCalculatorDraft>(
    'recipe-calculator',
    (d) => d.ingredients.length === 0 && d.recipeName.trim() === '',
  )

  const recipeNameRef = useRef(recipeName)
  recipeNameRef.current = recipeName
  const totalWeightRef = useRef(totalWeight)
  totalWeightRef.current = totalWeight

  // Save on ingredient add/remove (discrete events)
  useEffect(() => {
    draft.save({ recipeName: recipeNameRef.current, ingredients, totalWeight: totalWeightRef.current })
  }, [ingredients])

  // Save on input blur
  const saveDraft = useCallback(() => {
    draft.save({ recipeName, ingredients, totalWeight })
  }, [recipeName, ingredients, totalWeight, draft])

  // Derived
  const totalKcal = ingredients.reduce((sum, i) => sum + i.totalKcal, 0)
  const totalIngredientGrams = ingredients.reduce((sum, i) => sum + i.grams, 0)
  const preparedWeight = parseFloat(totalWeight) || 0
  const kcalPer100g = preparedWeight > 0 ? Math.round(totalKcal / preparedWeight * 100) : null
  // Per 100g of the prepared food, the same way as kcal. Ingredients without a value add nothing.
  const per100g = preparedWeight > 0
    ? knownTotals(
      sumNutrients(ingredients.map((i) => ({ quantity: 1, unitNutrients: i.totalNutrients }))),
      100 / preparedWeight,
    )
    : null
  const displayName = recipeName.trim() ? `${recipeName.trim()} (${date})` : ''
  const canSave = recipeName.trim().length > 0 && ingredients.length > 0 && preparedWeight > 0

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter((i) => i.id !== id))
    setExpandedId(null)
  }

  const handleFoodPicked = useCallback(async (result: FoodPickerResult) => {
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
      totalNutrients: result.unitNutrients && scaleNutrients(result.unitNutrients, result.quantity),
    }])
    setPicking(false)
    // The same tick as Add intake, so a food typed in for a recipe can be kept in My foods
    await applyCustomFoodAction(result)
  }, [])

  const handleSave = async () => {
    if (!canSave || kcalPer100g === null || per100g === null) return

    await db.customFoods.add({
      id: crypto.randomUUID(),
      name: displayName,
      caloriesPerUnit: kcalPer100g,
      unit: '100g',
      nutrients: roundNutrients(per100g.nutrients),
      lastUsed: new Date().toISOString(),
    })

    draft.clear()
    route('/')
  }

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => { draft.clear(); route('/') }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Recipe Calculator</h1>
      </div>

      <FeatureIntro featureKey="recipe-calculator" version={1}>
        Calculate the calorie density of home-cooked recipes. Add ingredients,
        enter the final weight, and it calculates the calories per 100g. Save
        the result as a custom food you can log anytime.
      </FeatureIntro>

      {draft.pending && (
        <DraftRestoreBanner
          onRestore={() => {
            const data = draft.restore()
            setRecipeName(data.recipeName)
            setIngredients(data.ingredients)
            setTotalWeight(data.totalWeight)
          }}
          onDiscard={() => draft.discard()}
        />
      )}

      {/* Recipe name */}
      <div class={styles.section}>
        <div class={styles.sectionTitle}>Recipe name</div>
        <input
          type="text"
          class={styles.nameInput}
          value={recipeName}
          onInput={(e) => setRecipeName((e.target as HTMLInputElement).value)}
          onBlur={saveDraft}
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

      {/* Prepared food weight */}
      {ingredients.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Prepared food weight</div>
          <div class={styles.resultRow}>
            <NumericInput
              class={styles.weightInput}
              value={totalWeight}
              onInput={(e) => setTotalWeight((e.target as HTMLInputElement).value)}
              onBlur={saveDraft}
              placeholder="0"
              min="0"
            />
            <span class={styles.unitLabel}>g</span>
          </div>
        </div>
      )}

      {/* Nutrition per 100g, once the weight is known */}
      {ingredients.length > 0 && per100g && (
        <div class={styles.section}>
          <button class={styles.nutritionHeader} onClick={toggleNutrition} aria-expanded={nutritionOpen}>
            <span class={styles.sectionTitle}>Nutrition</span>
            <span class={styles.chevron}>{nutritionOpen ? '▾' : '▸'}</span>
          </button>
          {nutritionOpen && (hasNutrients(per100g.nutrients) ? (
            <div class={styles.nutrition}>
              <div class={styles.nutritionUnit}>per 100g</div>
              <NutritionRows {...per100g} />
            </div>
          ) : (
            <div class={styles.nutritionEmpty}>No nutrition data</div>
          ))}
        </div>
      )}

      {/* Result */}
      {ingredients.length > 0 && (
        <div class={styles.result}>
          {kcalPer100g !== null
            ? `Result: ${kcalPer100g} kcal/100g`
            : 'Enter weight to calculate'}
        </div>
      )}

      {/* Actions */}
      <div class={styles.actions}>
        <button class={styles.dismissButton} onClick={() => { draft.clear(); route('/') }}>
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
          showSaveAsCustom
        />
      )}
    </div>
  )
}
