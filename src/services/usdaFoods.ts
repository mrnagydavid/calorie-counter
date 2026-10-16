import type { Nutrients } from '../db/index'

export interface FoodItem {
  id: number
  name: string
  cat: string
  kcal: number
  portions?: { desc: string; g: number }[]
  n?: Nutrients // per 100g
}

let _foodsCache: FoodItem[] | null = null
let _byName: Map<string, FoodItem> | null = null

export async function loadFoods(): Promise<FoodItem[]> {
  if (_foodsCache) return _foodsCache
  const res = await fetch('/usda-foods.json')
  _foodsCache = await res.json()
  return _foodsCache!
}

/** Exact, case-sensitive name match. */
export async function findUsdaFoodByName(name: string): Promise<FoodItem | undefined> {
  const foods = await loadFoods()
  if (!_byName) _byName = new Map(foods.map((f) => [f.name, f]))
  return _byName.get(name)
}
