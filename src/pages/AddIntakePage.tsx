import { useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { db } from '../db/index'
import { applyCustomFoodAction } from '../db/customFoods'
import { entryNutrients } from '../utils/nutrients'
import { FoodPicker, type FoodPickerResult } from '../components/FoodPicker'

interface AddIntakePageProps {
  date?: string
}

export function AddIntakePage({ date = '' }: AddIntakePageProps) {
  const params = new URLSearchParams(window.location.search)
  // Set by the scanner when a lookup gave nothing: the number to offer, and whether to
  // pre-tick "save as custom food" (only after a real miss, not after a timeout).
  const scannedBarcode = params.get('barcode') || ''
  const presetSaveAsCustom = params.get('save') === '1'

  const handleSelect = useCallback(async (result: FoodPickerResult) => {
    // The form owns the barcode from here on, so clearing the field clears it everywhere.
    const barcode = result.barcode || undefined

    await db.intakeEntries.add({
      id: crypto.randomUUID(),
      date,
      name: result.name,
      calories: result.calories,
      quantity: result.quantity,
      unitCalories: result.unitCalories,
      ...entryNutrients(result.unitNutrients),
      unit: result.unit,
      source: barcode ? 'barcode' : 'manual',
      barcode,
      createdAt: new Date().toISOString(),
    })

    await applyCustomFoodAction(result)
  }, [date])

  const handleClose = useCallback(() => {
    route('/', true)
  }, [])

  return (
    <FoodPicker
      onSelect={handleSelect}
      onClose={handleClose}
      date={date}
      showSaveAsCustom
      initialBarcode={scannedBarcode}
      initialSaveAsCustom={presetSaveAsCustom}
      submitLabel="Add Entry"
      showSaveAndAddNew
    />
  )
}
