import { useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { db } from '../db/index'
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
      unit: result.unit,
      source: barcode ? 'barcode' : 'manual',
      barcode,
      createdAt: new Date().toISOString(),
    })

    if (result.existingCustomFoodId) {
      // The user picked a food that is already in My Foods, so the only thing to write is
      // the barcode — its calories and name stay as saved. An existing code is replaced.
      if (barcode) {
        await db.customFoods.update(result.existingCustomFoodId, { barcode })
      }
    } else if (result.saveAsCustom && result.name.trim()) {
      await db.customFoods.put({
        id: crypto.randomUUID(),
        name: result.name.trim(),
        caloriesPerUnit: result.unitCalories,
        unit: result.unit,
        barcode,
        lastUsed: new Date().toISOString(),
      })
    }
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
