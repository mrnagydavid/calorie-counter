import Dexie, { type EntityTable } from 'dexie'

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface Settings {
  id: 'user-settings'
  baselineCalories: number
  dayOverrides: Partial<Record<DayOfWeek, number>>
  createdAt: string
  updatedAt: string
}

export interface IntakeEntry {
  id: string
  date: string
  name: string
  calories: number
  quantity: number
  unitCalories: number
  source: 'barcode' | 'manual'
  barcode?: string
  createdAt: string
}

export interface BurnEntry {
  id: string
  date: string
  name: string
  calories: number
  createdAt: string
}

export interface CustomFood {
  id: string
  name: string
  caloriesPerUnit: number
  unit: string
  barcode?: string
  lastUsed: string
}

export const db = new Dexie('CalorieCounterDB') as Dexie & {
  settings: EntityTable<Settings, 'id'>
  intakeEntries: EntityTable<IntakeEntry, 'id'>
  burnEntries: EntityTable<BurnEntry, 'id'>
  customFoods: EntityTable<CustomFood, 'id'>
}

db.version(1).stores({
  settings: 'id',
  intakeEntries: 'id, date, createdAt',
  burnEntries: 'id, date, createdAt',
  customFoods: 'id, name, barcode, lastUsed',
})
