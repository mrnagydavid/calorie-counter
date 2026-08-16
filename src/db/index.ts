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
  exportReminderEnabled: boolean
  exportReminderDismissedUntil?: string // YYYY-MM format
  // Personal details, stored as any profile field would be. They have no
  // Profile input yet — the bike calculator collects and remembers them.
  maxHr?: number // maximum heart rate, for reading effort as a share of max
  lastWeightKg?: number // fallback for calculators when no weigh-in exists
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
  unit: string // '100g', '100ml', 'serving', 'piece', etc.
  source: 'barcode' | 'manual'
  barcode?: string
  createdAt: string
}

export type ActivityKind = 'walk' | 'run' | 'bike'

/** Inputs a calculated burn was derived from, so it can be replayed and edited. */
export interface BurnActivity {
  kind: ActivityKind
  weightKg: number // what it was computed with, for the record
  distanceKm?: number // walk, run
  durationMin?: number // bike; walk and run when a pace was given
  ascentM?: number // walk, run — climb, when the route had one
  avgHr?: number // bike
}

export interface BurnEntry {
  id: string
  date: string
  name: string
  calories: number // always the net figure
  createdAt: string
  activity?: BurnActivity // absent on manual entries
}

export interface CustomFood {
  id: string
  name: string
  caloriesPerUnit: number
  unit: string
  barcode?: string
  lastUsed: string
}

export interface DailyTarget {
  date: string // YYYY-MM-DD, primary key
  target: number // base calorie target for the day (before burns)
}

export interface WeightEntry {
  id: string
  date: string // YYYY-MM-DD
  weight: number // in kg
  createdAt: string // ISO timestamp
}

export interface BarcodeCacheEntry {
  barcode: string
  name: string
  brand?: string
  variants: Array<{
    kcal: number
    unit: 'serving' | '100g' | '100ml' | 'total' | 'piece'
    servingSize?: string
  }>
  cachedAt: string
}

export const db = new Dexie('CalorieCounterDB') as Dexie & {
  settings: EntityTable<Settings, 'id'>
  intakeEntries: EntityTable<IntakeEntry, 'id'>
  burnEntries: EntityTable<BurnEntry, 'id'>
  customFoods: EntityTable<CustomFood, 'id'>
  dailyTargets: EntityTable<DailyTarget, 'date'>
  barcodeCache: EntityTable<BarcodeCacheEntry, 'barcode'>
  weightEntries: EntityTable<WeightEntry, 'id'>
}

db.version(1).stores({
  settings: 'id',
  intakeEntries: 'id, date, createdAt',
  burnEntries: 'id, date, createdAt',
  customFoods: 'id, name, barcode, lastUsed',
})

db.version(2).stores({
  barcodeCache: 'barcode',
})

db.version(3).stores({
  dailyTargets: 'date',
})

db.version(4).stores({
  weightEntries: 'id, date, createdAt',
})
