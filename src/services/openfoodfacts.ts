import { db } from '../db/index'

export interface CalorieVariant {
  kcal: number
  unit: 'serving' | '100g' | '100ml'
  servingSize?: string // e.g. "32g"
}

export interface OFFProduct {
  name: string
  brand?: string
  variants: CalorieVariant[]
}

export type LookupError = 'timeout' | 'network' | 'not-found'

export type LookupResult =
  | { ok: true; product: OFFProduct; source: 'cache' | 'network' }
  | { ok: false; error: LookupError }

interface OFFNutriments {
  'energy-kcal_serving'?: number
  'energy-kcal_100g'?: number
  'energy-kj_serving'?: number
  'energy-kj_100g'?: number
}

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

function extractVariants(
  nutriments: OFFNutriments,
  quantity?: string,
  servingSize?: string,
): CalorieVariant[] {
  const variants: CalorieVariant[] = []
  const baseUnit = isLiquid(quantity) ? '100ml' : '100g'

  // Per 100g/100ml — add first so it's the default selection
  const kcal100 = nutriments['energy-kcal_100g']
  const kj100 = nutriments['energy-kj_100g']
  if (kcal100 && kcal100 > 0) {
    variants.push({ kcal: Math.round(kcal100), unit: baseUnit })
  } else if (kj100 && kj100 > 0) {
    variants.push({ kcal: Math.round(kj100 / 4.184), unit: baseUnit })
  }

  // Per serving
  const kcalServing = nutriments['energy-kcal_serving']
  const kjServing = nutriments['energy-kj_serving']
  if (kcalServing && kcalServing > 0) {
    variants.push({ kcal: Math.round(kcalServing), unit: 'serving', servingSize })
  } else if (kjServing && kjServing > 0) {
    variants.push({ kcal: Math.round(kjServing / 4.184), unit: 'serving', servingSize })
  }

  return variants
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
  // 1. Check cache
  const cached = await db.barcodeCache.get(barcode)
  if (cached) {
    return {
      ok: true,
      product: { name: cached.name, brand: cached.brand, variants: cached.variants },
      source: 'cache',
    }
  }

  // 2. Fetch from network
  const result = await fetchFromOFF(barcode, signal)

  // 3. Cache successful results
  if (result.ok) {
    await db.barcodeCache.put({
      barcode,
      name: result.product.name,
      brand: result.product.brand,
      variants: result.product.variants,
      cachedAt: new Date().toISOString(),
    })
  }

  return result
}
