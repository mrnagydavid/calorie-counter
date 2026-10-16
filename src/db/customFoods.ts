import { db, type Nutrients } from './index'

/**
 * What a form Save does to My foods. It follows the "Save as custom food" tick: on adds or
 * replaces the food, off deletes the linked one. Entries are copies, so a delete keeps them.
 */
export type CustomFoodAction = 'none' | 'add' | 'update' | 'delete'

interface SubmittedFood {
  name: string
  unit: string
  unitCalories: number
  unitNutrients?: Nutrients
  barcode: string
  customFoodAction: CustomFoodAction
  /** The linked saved food: the one picked, else the one with the same name. */
  existingCustomFoodId?: string
}

export async function applyCustomFoodAction(food: SubmittedFood): Promise<void> {
  const id = food.existingCustomFoodId
  const name = food.name.trim()
  const barcode = food.barcode || undefined

  switch (food.customFoodAction) {
    case 'add':
      if (!name) return
      await db.customFoods.put({
        id: crypto.randomUUID(),
        name,
        caloriesPerUnit: food.unitCalories,
        unit: food.unit,
        nutrients: food.unitNutrients ?? {}, // set, so the migration skips it
        barcode,
        lastUsed: new Date().toISOString(),
      })
      return
    case 'update':
      if (!id || !name) return
      await db.customFoods.update(id, {
        name,
        caloriesPerUnit: food.unitCalories,
        unit: food.unit,
        nutrients: food.unitNutrients ?? {},
        barcode, // undefined removes it
      })
      return
    case 'delete':
      if (id) await db.customFoods.delete(id)
      return
    case 'none':
      // A picked saved food in the short form: the only thing to write is a scanned barcode.
      // Its calories and name stay as saved. An existing code is replaced.
      if (id && barcode) await db.customFoods.update(id, { barcode })
  }
}
