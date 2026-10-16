import { useState, useCallback } from 'preact/hooks'
import { db, type CustomFood } from '../db/index'
import { applyCustomFoodAction } from '../db/customFoods'
import { EditScreen } from './EditScreen'
import { FoodForm, type FoodFormResult } from './FoodForm'
import styles from './SavedFoodEditor.module.css'

interface SavedFoodEditorProps {
  food: CustomFood
  onClose: () => void
}

export function SavedFoodEditor({ food, onClose }: SavedFoodEditorProps) {
  const [barcode, setBarcode] = useState(food.barcode ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const handleSubmit = useCallback(async (result: FoodFormResult) => {
    // The same write as a ticked form, so My foods has one way to change a food
    await applyCustomFoodAction({ ...result, customFoodAction: 'update', existingCustomFoodId: food.id })
    onClose()
  }, [food.id, onClose])

  const handleDelete = useCallback(async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    await db.customFoods.delete(food.id)
    onClose()
  }, [confirmingDelete, food.id, onClose])

  return (
    <EditScreen title="Edit food" onClose={onClose}>
      <FoodForm
        initial={{
          name: food.name,
          unit: food.unit,
          unitCalories: food.caloriesPerUnit,
          nutrients: food.nutrients,
        }}
        savedFood
        barcode={barcode}
        onBarcodeChange={setBarcode}
        submitLabel="Save"
        onSubmit={handleSubmit}
      />
      <button
        class={`${styles.deleteButton} ${confirmingDelete ? styles.deleteConfirm : ''}`}
        onClick={handleDelete}
      >
        {confirmingDelete ? 'Delete?' : 'Delete'}
      </button>
    </EditScreen>
  )
}
