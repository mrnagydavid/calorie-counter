import { route } from 'preact-router'
import { lazy, Suspense } from 'preact/compat'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { db } from '../db/index'
import { lookupBarcode, type CalorieVariant, type OFFProduct, type LookupError } from '../services/openfoodfacts'
import { isValidBarcode, supportsNativeBarcodeDetector } from '../services/barcodeDetector'
import { NativeBarcodeScanner } from './NativeBarcodeScanner'
import styles from './BarcodeScanner.module.css'
import { NumericInput } from './NumericInput'

// html5-qrcode (~300 KB, ZXing-js) is only the iOS/no-native fallback, so code-split it: the
// common native path never downloads it, and Workbox precaches the chunk for offline iOS use.
const Html5QrcodeScanner = lazy(() =>
  import('./Html5QrcodeScanner').then((m) => ({ default: m.Html5QrcodeScanner })),
)

const FOOD_EMOJIS = ['🍎', '🥚', '🍕', '🥑', '🍌', '🧀', '🥕', '🍩']

function FoodSpinner() {
  const [idx, setIdx] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onIteration = () => setIdx((i) => (i + 1) % FOOD_EMOJIS.length)
    el.addEventListener('animationiteration', onIteration)
    return () => el.removeEventListener('animationiteration', onIteration)
  }, [])

  return <span ref={ref} class={styles.foodSpinner}>{FOOD_EMOJIS[idx]}</span>
}

export interface ScannedEntry {
  name: string
  calories: number
  unitCalories: number
  quantity: number
  unit: string
  barcode: string
  portions?: { desc: string; g: number }[]
}

interface BarcodeScannerProps {
  date: string
  onClose: () => void
  /** If provided, calls this instead of saving to DB */
  onAddEntry?: (entry: ScannedEntry) => void
  /**
   * Picker mode only: the lookup gave nothing and the user will enter the food by hand.
   * `presetSaveAsCustom` is true only after a real miss, so a timeout can't silently
   * shadow a product that Open Food Facts does have.
   */
  onAddManually?: (barcode: string, presetSaveAsCustom: boolean) => void
}

type State =
  | { step: 'scanning'; loading: boolean }
  | { step: 'found'; product: OFFProduct; barcode: string }
  | { step: 'not-found'; barcode: string }
  | { step: 'lookup-error'; barcode: string; error: LookupError }
  | { step: 'error'; message: string }

const unitLabels: Record<string, string> = {
  serving: 'per serving',
  '100g': 'per 100g',
  '100ml': 'per 100ml',
  total: 'total',
  piece: 'per piece',
}

function variantLabel(v: CalorieVariant): string {
  const base = `${unitLabels[v.unit]} — ${v.kcal} kcal`
  if (v.unit === 'serving' && v.servingSize) return `${base} (${v.servingSize})`
  return base
}

export function BarcodeScanner({ date, onClose, onAddEntry, onAddManually }: BarcodeScannerProps) {
  const [state, setState] = useState<State>({ step: 'scanning', loading: false })
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [amount, setAmount] = useState('100')
  const [servingQty, setServingQty] = useState(1)
  const [manualBarcode, setManualBarcode] = useState('')
  // null until the async capability probe resolves; true = native BarcodeDetector, false = html5-qrcode.
  const [useNative, setUseNative] = useState<boolean | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Probe once which live scanner to use (native where it can decode retail barcodes, else
  // html5-qrcode on iOS). Result is cached in the service, so this is cheap on re-mount.
  useEffect(() => {
    let cancelled = false
    supportsNativeBarcodeDetector().then((ok) => { if (!cancelled) setUseNative(ok) })
    return () => { cancelled = true }
  }, [])

  const handleScanError = useCallback((message: string) => {
    setState({ step: 'error', message })
  }, [])

  const handleBarcode = useCallback(async (barcode: string) => {
    setState({ step: 'scanning', loading: true })

    // Abort any previous in-flight lookup
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // 1. Check local customFoods
    const customFood = await db.customFoods.where('barcode').equals(barcode).first()
    if (controller.signal.aborted) return
    if (customFood) {
      // When used inside FoodPicker, return immediately with per-unit data
      if (onAddEntry) {
        onAddEntry({
          name: customFood.name,
          calories: customFood.caloriesPerUnit,
          unitCalories: customFood.caloriesPerUnit,
          quantity: 1,
          unit: customFood.unit,
          barcode,
        })
        return
      }
      const isCustomCountBased = customFood.unit === 'serving' || customFood.unit === 'total' || customFood.unit === 'piece'
      setState({
        step: 'found',
        barcode,
        product: {
          name: customFood.name,
          variants: [{
            kcal: customFood.caloriesPerUnit,
            unit: customFood.unit as CalorieVariant['unit'],
          }],
        },
      })
      setSelectedIdx(0)
      if (isCustomCountBased) {
        setServingQty(1)
      } else {
        setAmount('100')
      }
      return
    }

    // 2. Query Open Food Facts (with cache)
    const result = await lookupBarcode(barcode, controller.signal)
    if (controller.signal.aborted) return

    if (result.ok) {
      // When used inside FoodPicker, return immediately with per-100g data
      if (onAddEntry) {
        const product = result.product
        const per100g = product.variants.find((v) => v.unit === '100g' || v.unit === '100ml')
        const variant = per100g || product.variants[0]
        const entryName = [product.name, product.brand].filter(Boolean).join(' — ')

        // Extract serving size as a portion chip
        const portions: { desc: string; g: number }[] = []
        const serving = product.variants.find((v) => v.unit === 'serving')
        if (serving?.servingSize) {
          const gMatch = serving.servingSize.match(/(\d+(?:\.\d+)?)\s*g/)
          if (gMatch) {
            portions.push({ desc: 'serving', g: parseFloat(gMatch[1]) })
          }
        }

        onAddEntry({
          name: entryName,
          calories: variant.kcal,
          unitCalories: variant.kcal,
          quantity: 1,
          unit: variant.unit,
          barcode,
          portions: portions.length > 0 ? portions : undefined,
        })
        return
      }
      setState({ step: 'found', barcode, product: result.product })
      setSelectedIdx(0)
      setAmount('100')
      setServingQty(1)
      return
    }

    setManualBarcode(barcode)

    if (result.error === 'not-found') {
      setState({ step: 'not-found', barcode })
      return
    }

    // Timeout or network error
    setState({ step: 'lookup-error', barcode, error: result.error })
  }, [])

  // The live scanner (rendered only in the scanning step) owns the camera and tears it down on
  // unmount — so leaving the scanning step or closing the overlay stops the camera automatically.

  // Abort any in-flight lookup on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const selectedVariant = state.step === 'found' ? state.product.variants[selectedIdx] : null
  const isCountBased = selectedVariant?.unit === 'serving' || selectedVariant?.unit === 'total' || selectedVariant?.unit === 'piece'
  const total = selectedVariant
    ? isCountBased
      ? Math.round(selectedVariant.kcal * servingQty)
      : Math.round(selectedVariant.kcal * (parseFloat(amount) || 0) / 100)
    : 0

  const saveEntry = useCallback(async () => {
    if (state.step !== 'found' || !selectedVariant) return
    const { product, barcode } = state

    const unitCalories = selectedVariant.kcal
    const quantity = isCountBased ? servingQty : (parseFloat(amount) || 0) / 100
    const entryName = [product.name, product.brand].filter(Boolean).join(' — ')

    if (onAddEntry) {
      onAddEntry({ name: entryName, calories: total, unitCalories, quantity, unit: selectedVariant.unit, barcode })
    } else {
      await db.intakeEntries.add({
        id: crypto.randomUUID(),
        date,
        name: entryName,
        calories: total,
        quantity,
        unitCalories,
        unit: selectedVariant.unit,
        source: 'barcode',
        barcode,
        createdAt: new Date().toISOString(),
      })
    }
  }, [state, selectedVariant, isCountBased, servingQty, amount, total, date, onAddEntry])

  const handleSaveAndScan = useCallback(async () => {
    await saveEntry()
    // Returning to the scanning step re-triggers the camera-start effect (after commit).
    setState({ step: 'scanning', loading: false })
    setSelectedIdx(0)
    setAmount('100')
    setServingQty(1)
  }, [saveEntry])

  const handleSaveAndAddManually = useCallback(async () => {
    await saveEntry()
    onClose()
    route(`/add-intake/${date}`)
  }, [saveEntry, date, onClose])

  const handleSaveAndClose = useCallback(async () => {
    await saveEntry()
    onClose()
  }, [saveEntry, onClose])

  const handleNotFoundAdd = useCallback(() => {
    if (state.step !== 'not-found' && state.step !== 'lookup-error') return
    // The field is the source of truth: the user may have corrected it, or cleared it to add
    // the food with no barcode at all.
    const barcode = manualBarcode.trim()
    // A miss means the product isn't in Open Food Facts, so saving it is the point of the
    // flow — tick the box for the user. A timeout says nothing about the product, so don't.
    // With no barcode there is nothing to save it under, so leave the box alone.
    const presetSaveAsCustom = state.step === 'not-found' && barcode.length > 0
    if (onAddEntry) {
      onAddManually?.(barcode, presetSaveAsCustom)
      onClose()
    } else {
      onClose()
      const params = new URLSearchParams()
      if (barcode) params.set('barcode', barcode)
      if (presetSaveAsCustom) params.set('save', '1')
      const query = params.toString()
      route(`/add-intake/${date}${query ? `?${query}` : ''}`)
    }
  }, [state, manualBarcode, date, onClose, onAddEntry, onAddManually])

  const submitManualBarcode = useCallback((e: Event) => {
    e.preventDefault()
    if (isValidBarcode(manualBarcode)) handleBarcode(manualBarcode.trim())
  }, [manualBarcode, handleBarcode])

  // With no camera there is nothing else to do on the screen, so put the cursor in the field.
  const errorInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (state.step === 'error') errorInputRef.current?.focus()
  }, [state.step])

  const handleScanAgain = useCallback(() => {
    setManualBarcode('')
    setState({ step: 'scanning', loading: false })
  }, [])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <div class={styles.overlay}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={handleClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Scan Barcode</h1>
      </div>

      <div class={styles.body}>
        {state.step === 'scanning' && (
          <>
            {state.loading ? (
              <div class={styles.lookupScreen}>
                <FoodSpinner />
                <span class={styles.lookupText}>Looking up product...</span>
                <span class={styles.lookupNote}>
                  Using Open Food Facts, a free community database. Lookups may take a moment.
                </span>
              </div>
            ) : (
              <>
                {useNative === null ? (
                  <div class={styles.cameraWrapper} />
                ) : useNative ? (
                  <NativeBarcodeScanner onDetected={handleBarcode} onError={handleScanError} />
                ) : (
                  <Suspense fallback={<div class={styles.cameraWrapper} />}>
                    <Html5QrcodeScanner onDetected={handleBarcode} onError={handleScanError} />
                  </Suspense>
                )}
                <div class={styles.hint}>Point camera at a barcode</div>
                <div class={styles.orDivider}>or enter the number</div>
                <form class={styles.manualRow} onSubmit={submitManualBarcode}>
                  <input
                    type="text"
                    inputMode="numeric"
                    class={styles.amountInput}
                    value={manualBarcode}
                    onInput={(e) => setManualBarcode((e.target as HTMLInputElement).value)}
                    placeholder="e.g. 7622210100234"
                    style={{ flex: 1 }}
                  />
                  <button type="submit" class={styles.manualButton} disabled={!isValidBarcode(manualBarcode)}>
                    Look up
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {state.step === 'found' && (
          <>
            <div>
              <div class={styles.productName}>{state.product.name}</div>
              {state.product.brand && (
                <div class={styles.productBrand}>{state.product.brand}</div>
              )}
            </div>

            {state.product.variants.length > 1 ? (
              <div class={styles.variantList}>
                {state.product.variants.map((v, i) => (
                  <label key={i} class={styles.variantOption}>
                    <input
                      type="radio"
                      name="variant"
                      checked={selectedIdx === i}
                      onChange={() => {
                        setSelectedIdx(i)
                        if (v.unit === 'serving' || v.unit === 'total' || v.unit === 'piece') setServingQty(1)
                        else setAmount('100')
                      }}
                    />
                    {variantLabel(v)}
                  </label>
                ))}
              </div>
            ) : selectedVariant && (
              <div class={styles.calorieInfo}>
                <strong>{selectedVariant.kcal} kcal</strong>{' '}
                {unitLabels[selectedVariant.unit]}
                {selectedVariant.servingSize && (
                  <div class={styles.servingNote}>
                    Serving size: {selectedVariant.servingSize}
                  </div>
                )}
              </div>
            )}

            {isCountBased ? (
              selectedVariant?.unit === 'total' ? null : (
              <div>
                <div class={styles.fieldLabel}>Quantity</div>
                <div class={styles.stepper}>
                  <button
                    class={styles.stepperButton}
                    onClick={() => setServingQty(Math.max(0.5, servingQty - 0.5))}
                  >
                    -
                  </button>
                  <span class={styles.stepperValue}>{servingQty}</span>
                  <button
                    class={styles.stepperButton}
                    onClick={() => setServingQty(servingQty + 0.5)}
                  >
                    +
                  </button>
                </div>
                {selectedVariant?.unit === 'serving' && selectedVariant?.servingSize && (
                  <div class={styles.servingNote}>
                    1 serving = {selectedVariant.servingSize}
                  </div>
                )}
              </div>
              )
            ) : (
              <div>
                <div class={styles.fieldLabel}>Amount</div>
                <div class={styles.inputRow}>
                  <NumericInput
                    inputMode="numeric"
                    class={styles.amountInput}
                    value={amount}
                    onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
                    min="0"
                  />
                  <span class={styles.unitLabel}>
                    {selectedVariant?.unit === '100ml' ? 'ml' : 'g'}
                  </span>
                </div>
              </div>
            )}

            <div class={styles.total}>Total: {total} kcal</div>

            <div class={styles.actions}>
              {onAddEntry ? (
                <button class={styles.primaryButton} onClick={handleSaveAndClose}>
                  Add
                </button>
              ) : (
                <>
                  <button class={styles.primaryButton} onClick={handleSaveAndScan}>
                    📷 Save & scan next
                  </button>
                  <button class={styles.primaryButton} onClick={handleSaveAndAddManually}>
                    ➕ Save & add manually
                  </button>
                  <button class={styles.secondaryButton} onClick={handleSaveAndClose}>
                    ✅ Save & close
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {state.step === 'error' && (
          <>
            <div class={styles.notFoundText}>{state.message}</div>
            <form onSubmit={submitManualBarcode}>
              <div class={styles.fieldLabel}>Enter barcode manually</div>
              <div class={styles.inputRow}>
                <input
                  ref={errorInputRef}
                  type="text"
                  inputMode="numeric"
                  class={styles.amountInput}
                  value={manualBarcode}
                  onInput={(e) => setManualBarcode((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 7622210100234"
                  style={{ flex: 1 }}
                />
              </div>
              <button
                type="submit"
                class={`${styles.primaryButton} ${styles.manualSubmit}`}
                disabled={!isValidBarcode(manualBarcode)}
              >
                Look Up
              </button>
            </form>
          </>
        )}

        {state.step === 'not-found' && (
          <>
            <div class={styles.notFoundText}>No product found for this barcode</div>
            <button class={styles.secondaryButton} onClick={handleScanAgain}>
              Scan Again
            </button>
            <div class={styles.orDivider}>or</div>
            <form class={styles.actions} onSubmit={submitManualBarcode}>
              <div class={styles.inputRow}>
                <input
                  type="text"
                  inputMode="numeric"
                  class={styles.amountInput}
                  value={manualBarcode}
                  onInput={(e) => setManualBarcode((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 7622210100234"
                  style={{ flex: 1 }}
                />
              </div>
              {/* Only a retail-length number can be in Open Food Facts, so the search is gated.
                  Saving a food under an in-store or custom code is not. */}
              <button
                type="submit"
                class={styles.secondaryButton}
                disabled={!isValidBarcode(manualBarcode)}
              >
                Search this barcode
              </button>
            </form>
            <div class={styles.actions}>
              <button class={styles.primaryButton} onClick={handleNotFoundAdd}>
                {manualBarcode.trim()
                  ? 'Add food with this barcode'
                  : 'Add food without a barcode'}
              </button>
            </div>
          </>
        )}

        {state.step === 'lookup-error' && (
          <>
            <div class={styles.notFoundText}>
              {state.error === 'timeout'
                ? 'The lookup timed out. Open Food Facts may be slow or unavailable right now.'
                : 'Network error. Check your connection and try again.'}
            </div>
            <div class={styles.actions}>
              <button class={styles.primaryButton} onClick={() => handleBarcode(state.barcode)}>
                Retry
              </button>
              <button class={styles.secondaryButton} onClick={handleNotFoundAdd}>
                Add food for this barcode
              </button>
              <button class={styles.secondaryButton} onClick={handleScanAgain}>
                Scan Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
