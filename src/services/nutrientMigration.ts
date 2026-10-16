import { db, type CustomFood, type Nutrients } from '../db/index'
import { updateSettings } from '../db/settings'
import { hasNutrients, kcalAgrees } from '../utils/nutrients'
import { lookupBarcode, type CalorieVariant } from './openfoodfacts'
import { findUsdaFoodByName, loadFoods } from './usdaFoods'

/** The data version that has nutrients on saved foods. */
export const DATA_VERSION = 2

// Open Food Facts allows 100 product reads a minute. One a second stays far below it.
const REQUEST_GAP_MS = 1000

export interface MigrationStatus {
  step: 'local' | 'barcodes'
  localMatched: number
  barcodeTotal: number
  barcodeDone: number
}

export interface MigrationResult {
  total: number // saved foods
  withData: number // saved foods with at least one nutrient
  offline: boolean
}

/** Write nutrients to a saved food, unless something else wrote them first. */
async function setNutrients(id: string, nutrients: Nutrients): Promise<void> {
  await db.customFoods.where('id').equals(id).modify((food) => {
    if (food.nutrients === undefined) food.nutrients = nutrients
  })
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}

/** Which OFF variant fits the unit of a saved food. Null: no variant fits. */
function pickVariant(food: CustomFood, variants: CalorieVariant[]): CalorieVariant | undefined {
  if (food.unit === '100g' || food.unit === '100ml') {
    return variants.find((v) => v.unit === '100g' || v.unit === '100ml')
  }
  if (food.unit === 'serving') return variants.find((v) => v.unit === 'serving')
  return undefined
}

/**
 * Step A. Saved foods with no barcode: copy the USDA nutrients of a food with the same name.
 * Returns how many got nutrients. `failed` means the USDA data could not be used and nothing
 * was checked: the file did not load, or it is an old copy with no nutrients on any food.
 */
async function matchLocally(): Promise<{ matched: number; failed: boolean }> {
  const foods = await db.customFoods.filter((f) => f.nutrients === undefined && !f.barcode).toArray()
  if (foods.length === 0) return { matched: 0, failed: false }
  try {
    const usdaFoods = await loadFoods()
    // An old copy of the file (for example from the HTTP cache) has no `n`. Using it
    // would write `{}` on every food, and nothing would check them again.
    if (!usdaFoods.some((f) => hasNutrients(f.n))) return { matched: 0, failed: true }
  } catch {
    return { matched: 0, failed: true }
  }

  let matched = 0
  for (const food of foods) {
    let nutrients: Nutrients = {}
    if (food.unit === '100g' || food.unit === '100ml') {
      const usda = await findUsdaFoodByName(food.name)
      if (hasNutrients(usda?.n)) {
        nutrients = usda.n
        matched++
      }
    }
    await setNutrients(food.id, nutrients)
  }
  return { matched, failed: false }
}

/**
 * Step B. Saved foods with a barcode: look the barcode up and copy the nutrients of the variant
 * that fits the unit. A network error or a timeout leaves the food unchecked, for a later start.
 */
export async function checkBarcodes(
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<void> {
  const foods = await db.customFoods.filter((f) => f.nutrients === undefined && !!f.barcode).toArray()
  onProgress?.(0, foods.length)

  let lastRequest = 0
  for (let i = 0; i < foods.length; i++) {
    if (signal?.aborted) return
    const food = foods[i]

    if (food.unit !== '100g' && food.unit !== '100ml' && food.unit !== 'serving') {
      await setNutrients(food.id, {})
    } else {
      await sleep(Math.max(0, lastRequest + REQUEST_GAP_MS - Date.now()), signal)
      if (signal?.aborted) return

      const result = await lookupBarcode(food.barcode!, signal)
      if (signal?.aborted) return
      // A cache hit sends no request. A stale row means the request failed.
      if (!result.ok || result.source === 'network' || result.stale) lastRequest = Date.now()

      let nutrients: Nutrients | undefined
      if (result.ok && !result.stale) {
        const variant = pickVariant(food, result.product.variants)
        const agrees = variant && kcalAgrees(variant.kcal, food.caloriesPerUnit)
        nutrients = agrees && hasNutrients(variant.nutrients) ? variant.nutrients : {}
      } else if (!result.ok && result.error === 'not-found') {
        nutrients = {}
      }
      if (nutrients) await setNutrients(food.id, nutrients)
    }
    onProgress?.(i + 1, foods.length)
  }
}

/** The update screen's work. Sets the data version when it ran to the end. */
export async function runMigration(
  onStatus: (status: MigrationStatus) => void,
  signal: AbortSignal,
): Promise<MigrationResult> {
  const status: MigrationStatus = { step: 'local', localMatched: 0, barcodeTotal: 0, barcodeDone: 0 }
  onStatus({ ...status })

  const local = await matchLocally()
  status.localMatched = local.matched

  const offline = !navigator.onLine
  if (!offline && !signal.aborted) {
    status.step = 'barcodes'
    onStatus({ ...status })
    await checkBarcodes({
      signal,
      onProgress: (done, total) => {
        status.barcodeDone = done
        status.barcodeTotal = total
        onStatus({ ...status })
      },
    })
  }

  // Foods that could not be checked (no USDA data, offline, network error) stay `undefined`.
  // The background retry at the next start covers them, so the screen does not need to run again.
  if (!signal.aborted) await updateSettings({ dataVersion: DATA_VERSION })

  const foods = await db.customFoods.toArray()
  return {
    total: foods.length,
    withData: foods.filter((f) => hasNutrients(f.nutrients)).length,
    offline,
  }
}

/** "Finish later": the remaining saved foods are retried at the next start. */
export async function finishLater(): Promise<void> {
  await updateSettings({ dataVersion: DATA_VERSION })
}

/**
 * The retry at a later start, with no screen. Step A only loads the USDA file when a saved
 * food with no barcode is unchecked. Step B needs the network.
 */
async function retryUnchecked(): Promise<void> {
  await matchLocally()
  if (navigator.onLine) await checkBarcodes()
}

/**
 * Decide at app start whether the update screen shows. A missing settings row is a new
 * install, which has nothing to migrate. After the update, a background retry takes care
 * of the saved foods that could not be checked.
 */
export async function checkDataGate(): Promise<'update' | 'ready'> {
  try {
    const settings = await db.settings.get('user-settings')
    if (!settings) return 'ready'

    if ((settings.dataVersion ?? 1) >= DATA_VERSION) {
      retryUnchecked().catch(() => {})
      return 'ready'
    }

    const unchecked = await db.customFoods.filter((f) => f.nutrients === undefined).count()
    if (unchecked === 0) {
      await updateSettings({ dataVersion: DATA_VERSION })
      return 'ready'
    }
    return 'update'
  } catch {
    // The database is not readable. Do not lock the user out of the app.
    return 'ready'
  }
}
