// Adds nutrients (`n`) to public/usda-foods.json, matched by USDA fdc_id.
//
// Source: USDA SR Legacy, file food_nutrient.csv. Run:
//   curl -O https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
//   unzip FoodData_Central_sr_legacy_food_csv_2018-04.zip '*/food_nutrient.csv'
//   node scripts/add-usda-nutrients.mjs path/to/food_nutrient.csv
// Do not commit the zip or the CSV.

import { readFileSync, writeFileSync } from 'node:fs'

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/add-usda-nutrients.mjs <food_nutrient.csv>')
  process.exit(1)
}

const FOODS_PATH = new URL('../public/usda-foods.json', import.meta.url)

const IDS = {
  1004: 'fat',
  1258: 'saturatedFat',
  1005: 'carbsByDifference',
  2000: 'sugars',
  1079: 'fiber',
  1003: 'protein',
  1093: 'sodium', // mg
}

/** Parse CSV with quoted fields. Quoted fields can hold commas and newlines. */
function* parseCsv(text) {
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      yield row
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    yield row
  }
}

const round = (value, decimals) => {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

// fdc_id -> { fat, saturatedFat, ... } in source units
const raw = new Map()
let header = null
for (const row of parseCsv(readFileSync(csvPath, 'utf8'))) {
  if (!header) {
    header = {
      fdc: row.indexOf('fdc_id'),
      nutrient: row.indexOf('nutrient_id'),
      amount: row.indexOf('amount'),
    }
    if (Object.values(header).includes(-1)) throw new Error('Missing CSV column')
    continue
  }
  const field = IDS[row[header.nutrient]]
  if (!field) continue
  const amount = Number(row[header.amount])
  if (row[header.amount] === '' || Number.isNaN(amount)) continue
  const id = Number(row[header.fdc])
  if (!raw.has(id)) raw.set(id, {})
  raw.get(id)[field] = amount
}

function toNutrients(r) {
  const n = {}
  if (r.fat !== undefined) n.fat = round(r.fat, 1)
  if (r.saturatedFat !== undefined) n.saturatedFat = round(r.saturatedFat, 1)
  if (r.carbsByDifference !== undefined) {
    // USDA carbs include fiber. EU labels do not.
    const carbs = r.carbsByDifference - (r.fiber ?? 0)
    n.carbs = round(Math.max(0, carbs), 1)
  }
  if (r.sugars !== undefined) n.sugars = round(r.sugars, 1)
  if (r.fiber !== undefined) n.fiber = round(r.fiber, 1)
  if (r.protein !== undefined) n.protein = round(r.protein, 1)
  if (r.sodium !== undefined) n.salt = round((r.sodium * 2.5) / 1000, 2)
  return n
}

const foods = JSON.parse(readFileSync(FOODS_PATH, 'utf8'))
let matched = 0
const out = foods.map((food) => {
  const r = raw.get(food.id)
  if (!r) return food
  const n = toNutrients(r)
  if (Object.keys(n).length === 0) return food
  matched++
  return { ...food, n }
})

writeFileSync(FOODS_PATH, JSON.stringify(out))
console.log(`${out.length} foods, ${matched} with nutrients`)
