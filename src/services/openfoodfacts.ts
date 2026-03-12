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

export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CalorieCounter/1.0' },
  })
  if (!res.ok) return null
  const data: OFFResponse = await res.json()
  if (data.status !== 1 || !data.product?.nutriments) return null

  const variants = extractVariants(
    data.product.nutriments,
    data.product.quantity,
    data.product.serving_size,
  )
  if (variants.length === 0) return null

  return {
    name: data.product.product_name || 'Unknown product',
    brand: data.product.brands || undefined,
    variants,
  }
}
