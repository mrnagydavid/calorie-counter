import { db, type Nutrients } from '../db/index'
import { hasNutrients, roundNutrients } from '../utils/nutrients'

// Current barcodeCache row version. Older rows have no nutrients.
const CACHE_VERSION = 2

export interface CalorieVariant {
  kcal: number
  unit: 'serving' | '100g' | '100ml' | 'total' | 'piece'
  servingSize?: string // e.g. "32g"
  nutrients?: Nutrients // per variant unit
}

export interface OFFProduct {
  name: string
  brand?: string
  variants: CalorieVariant[]
}

export type LookupError = 'timeout' | 'network' | 'not-found'

export type LookupResult =
  // `stale`: the fetch failed, so this is an old cache row with no nutrients
  | { ok: true; product: OFFProduct; source: 'cache' | 'network'; stale?: true }
  | { ok: false; error: LookupError }

type OFFNutriments = Record<string, number | string | undefined>

interface OFFResponse {
  status: number
  product?: {
    product_name?: string
    brands?: string
    nutriments?: OFFNutriments
    serving_size?: string
    quantity?: string
  }
}

function isLiquid(quantity?: string): boolean {
  if (!quantity) return false
  return /ml|cl|dl|l\b/i.test(quantity)
}

// Nutrients field -> OFF key. OFF gives all of them in grams.
const OFF_KEYS: Record<keyof Nutrients, string> = {
  fat: 'fat',
  saturatedFat: 'saturated-fat',
  carbs: 'carbohydrates',
  sugars: 'sugars',
  fiber: 'fiber',
  protein: 'proteins',
  salt: 'salt',
}

function readNumber(nutriments: OFFNutriments, key: string): number | undefined {
  const value = nutriments[key]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Read one nutrient for a suffix ('100g' or 'serving'). Salt falls back to sodium. */
function readNutrient(
  nutriments: OFFNutriments,
  field: keyof Nutrients,
  suffix: '100g' | 'serving',
): number | undefined {
  const value = readNumber(nutriments, `${OFF_KEYS[field]}_${suffix}`)
  if (value !== undefined || field !== 'salt') return value
  const sodium = readNumber(nutriments, `sodium_${suffix}`)
  return sodium === undefined ? undefined : sodium * 2.5
}

/** Grams in a serving size such as "32g" or "1 portion (30 g)". */
function servingGrams(servingSize?: string): number | undefined {
  const match = servingSize?.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)
  const grams = match ? Number(match[1].replace(',', '.')) : undefined
  return grams && grams > 0 ? grams : undefined
}

function extractNutrients(
  nutriments: OFFNutriments,
  suffix: '100g' | 'serving',
  grams?: number,
): Nutrients | undefined {
  const result: Nutrients = {}
  for (const field of Object.keys(OFF_KEYS) as (keyof Nutrients)[]) {
    let value = readNutrient(nutriments, field, suffix)
    if (value === undefined && suffix === 'serving' && grams) {
      const per100 = readNutrient(nutriments, field, '100g')
      if (per100 !== undefined) value = (per100 * grams) / 100
    }
    if (value !== undefined) result[field] = value
  }
  return hasNutrients(result) ? roundNutrients(result) : undefined
}

function extractVariants(
  nutriments: OFFNutriments,
  quantity?: string,
  servingSize?: string,
): CalorieVariant[] {
  const variants: CalorieVariant[] = []
  const baseUnit = isLiquid(quantity) ? '100ml' : '100g'

  // Per 100g/100ml — add first so it's the default selection
  const kcal100 = readKcal(nutriments, '100g')
  if (kcal100 !== undefined) {
    variants.push({ kcal: kcal100, unit: baseUnit, nutrients: extractNutrients(nutriments, '100g') })
  }

  // Per serving
  const kcalServing = readKcal(nutriments, 'serving')
  if (kcalServing !== undefined) {
    const nutrients = extractNutrients(nutriments, 'serving', servingGrams(servingSize))
    variants.push({ kcal: kcalServing, unit: 'serving', servingSize, nutrients })
  }

  return variants
}

/**
 * kcal, from kJ when the kcal field is missing. A 0 counts only when no field gives more:
 * salt and water are 0 kcal, and are still found.
 */
function readKcal(nutriments: OFFNutriments, suffix: '100g' | 'serving'): number | undefined {
  const kcal = readNumber(nutriments, `energy-kcal_${suffix}`)
  const kj = readNumber(nutriments, `energy-kj_${suffix}`)
  if (kcal) return Math.round(kcal)
  if (kj) return Math.round(kj / 4.184)
  return kcal ?? kj
}

const TIMEOUT_MS = 8000

async function fetchFromOFF(barcode: string, signal?: AbortSignal): Promise<LookupResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // If an external signal aborts, also abort our controller
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CalorieCounter/1.0' },
      signal: controller.signal,
    })
    if (res.status === 404) return { ok: false, error: 'not-found' }
    if (!res.ok) return { ok: false, error: 'network' }
    const data: OFFResponse = await res.json()
    if (data.status !== 1 || !data.product?.nutriments) {
      return { ok: false, error: 'not-found' }
    }

    const variants = extractVariants(
      data.product.nutriments,
      data.product.quantity,
      data.product.serving_size,
    )
    if (variants.length === 0) return { ok: false, error: 'not-found' }

    return {
      ok: true,
      product: {
        name: data.product.product_name || 'Unknown product',
        brand: data.product.brands || undefined,
        variants,
      },
      source: 'network',
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Distinguish external abort (unmount) from timeout
      if (signal?.aborted) return { ok: false, error: 'network' }
      return { ok: false, error: 'timeout' }
    }
    return { ok: false, error: 'network' }
  } finally {
    clearTimeout(timer)
  }
}

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<LookupResult> {
  // 1. Check cache. A row below the current version has no nutrients: fetch it again.
  const cached = await db.barcodeCache.get(barcode)
  const cachedResult: LookupResult | undefined = cached && {
    ok: true,
    product: { name: cached.name, brand: cached.brand, variants: cached.variants },
    source: 'cache',
  }
  if (cachedResult && (cached?.version ?? 1) >= CACHE_VERSION) return cachedResult

  // 2. Fetch from network
  const result = await fetchFromOFF(barcode, signal)

  // On a network error or timeout, a stale row is better than nothing
  if (!result.ok && cachedResult && result.error !== 'not-found') {
    return { ...cachedResult, stale: true }
  }

  // 3. Cache successful results
  if (result.ok) {
    await db.barcodeCache.put({
      barcode,
      name: result.product.name,
      brand: result.product.brand,
      variants: result.product.variants,
      cachedAt: new Date().toISOString(),
      version: CACHE_VERSION,
    })
  }

  return result
}
