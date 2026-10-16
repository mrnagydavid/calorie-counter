import { useState, useEffect, useCallback } from 'preact/hooks'
import { db, type CustomFood, type IntakeEntry } from '../db/index'
import { applyCustomFoodAction } from '../db/customFoods'
import { hasNutrients } from '../utils/nutrients'
import { EditScreen } from './EditScreen'
import { FoodForm, displayQuantity, type FoodFormResult } from './FoodForm'

interface EntryEditorProps {
  entry: IntakeEntry
  onClose: () => void
}

export function EntryEditor({ entry, onClose }: EntryEditorProps) {
  // The saved food with the same name, the same link Recents use. Undefined while it loads.
  const [linked, setLinked] = useState<CustomFood | null | undefined>(undefined)
  const [saveAsCustom, setSaveAsCustom] = useState(false)
  const [barcode, setBarcode] = useState('')

  useEffect(() => {
    let cancelled = false
    db.customFoods.where('name').equals(entry.name).first().then((food) => {
      if (cancelled) return
      setLinked(food ?? null)
      setSaveAsCustom(!!food)
      // The field belongs to the saved food, so its own code comes first
      setBarcode(food?.barcode ?? entry.barcode ?? '')
    })
    return () => { cancelled = true }
  }, [entry.id])

  const handleSubmit = useCallback(async (result: FoodFormResult) => {
    // The barcode and the source say how the entry was logged, so they stay
    await db.intakeEntries.update(entry.id, {
      name: result.name,
      unit: result.unit,
      unitCalories: result.unitCalories,
      unitNutrients: hasNutrients(result.unitNutrients) ? result.unitNutrients : undefined,
      quantity: result.quantity,
      calories: result.calories,
    })
    await applyCustomFoodAction(result)
    onClose()
  }, [entry.id, onClose])

  return (
    <EditScreen title="Edit entry" onClose={onClose}>
      {linked !== undefined && (
        <FoodForm
          initial={{
            name: entry.name,
            unit: entry.unit,
            unitCalories: entry.unitCalories,
            nutrients: entry.unitNutrients,
            quantity: displayQuantity(entry.unit, entry.quantity),
          }}
          showSaveAsCustom
          barcode={barcode}
          onBarcodeChange={setBarcode}
          saveAsCustom={saveAsCustom}
          onSaveAsCustomChange={setSaveAsCustom}
          existingCustomFoodId={linked?.id}
          submitLabel="Save"
          onSubmit={handleSubmit}
        />
      )}
    </EditScreen>
  )
}
