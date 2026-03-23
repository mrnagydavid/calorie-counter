import { useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { db } from '../db/index'
import { FoodPicker, type FoodPickerResult } from '../components/FoodPicker'

interface AddIntakePageProps {
  date?: string
}

export function AddIntakePage({ date = '' }: AddIntakePageProps) {
  const barcode = new URLSearchParams(window.location.search).get('barcode') || ''
  const hasBarcode = barcode.length > 0

  const handleSelect = useCallback(async (result: FoodPickerResult) => {
    await db.intakeEntries.add({
      id: crypto.randomUUID(),
      date,
      name: result.name,
      calories: result.calories,
      quantity: result.quantity,
      unitCalories: result.unitCalories,
      unit: result.unit,
      source: hasBarcode ? 'barcode' : 'manual',
      barcode: hasBarcode ? barcode : undefined,
      createdAt: new Date().toISOString(),
    })

    if (result.saveAsCustom && result.name.trim()) {
      await db.customFoods.put({
        id: crypto.randomUUID(),
        name: result.name.trim(),
        caloriesPerUnit: result.unitCalories,
        unit: result.unit,
        barcode: hasBarcode ? barcode : undefined,
        lastUsed: new Date().toISOString(),
      })
    }
  }, [date, hasBarcode, barcode])

  const handleClose = useCallback(() => {
    route('/', true)
  }, [])

  return (
    <FoodPicker
      onSelect={handleSelect}
      onClose={handleClose}
      date={date}
      showSaveAsCustom
      submitLabel="Add Entry"
      showSaveAndAddNew
    />
  )
}
