import { Html5Qrcode } from 'html5-qrcode'
import { route } from 'preact-router'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { db } from '../db/index'
import { lookupBarcode, type CalorieVariant, type OFFProduct, type LookupError } from '../services/openfoodfacts'
import styles from './BarcodeScanner.module.css'
import { NumericInput } from './NumericInput'

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
}

function variantLabel(v: CalorieVariant): string {
  const base = `${unitLabels[v.unit]} — ${v.kcal} kcal`
  if (v.unit === 'serving' && v.servingSize) return `${base} (${v.servingSize})`
  return base
}

export function BarcodeScanner({ date, onClose, onAddEntry }: BarcodeScannerProps) {
  const [state, setState] = useState<State>({ step: 'scanning', loading: false })
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [amount, setAmount] = useState('100')
  const [servingQty, setServingQty] = useState(1)
  const [manualBarcode, setManualBarcode] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const stopCamera = useCallback(() => {
    const scanner = scannerRef.current
    if (scanner) {
      if (runningRef.current) {
        scanner.stop().catch(() => {}).finally(() => {
          try { scanner.clear() } catch { /* ignore */ }
        })
      } else {
        try { scanner.clear() } catch { /* ignore */ }
      }
      scannerRef.current = null
      runningRef.current = false
    }
  }, [])

  const startCamera = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    stopCamera()
    container.innerHTML = ''
    scannedRef.current = false

    const readerId = `reader-${Date.now()}`
    const el = document.createElement('div')
    el.id = readerId
    container.appendChild(el)

    const scanner = new Html5Qrcode(readerId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        if (scannedRef.current) return
        scannedRef.current = true
        runningRef.current = false
        scanner.stop().catch(() => {})
        handleBarcode(decodedText)
      },
      () => {},
    ).then(() => {
      runningRef.current = true
    }).catch((err) => {
      console.error('Camera start failed:', err)
      runningRef.current = false
      setState({ step: 'error', message: 'Camera not available. Please use manual entry.' })
    })
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
      setAmount('100')
      setServingQty(1)
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

    if (result.error === 'not-found') {
      setState({ step: 'not-found', barcode })
      return
    }

    // Timeout or network error
    setState({ step: 'lookup-error', barcode, error: result.error })
  }, [])

  useEffect(() => {
    if (state.step === 'scanning' && !state.loading) {
      startCamera()
      return stopCamera
    }
  }, [state.step, state.step === 'scanning' && state.loading])

  // Cleanup on unmount: abort in-flight fetch + stop camera
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      stopCamera()
    }
  }, [])

  const selectedVariant = state.step === 'found' ? state.product.variants[selectedIdx] : null
  const isServing = selectedVariant?.unit === 'serving'
  const total = selectedVariant
    ? isServing
      ? Math.round(selectedVariant.kcal * servingQty)
      : Math.round(selectedVariant.kcal * (parseFloat(amount) || 0) / 100)
    : 0

  const addEntry = useCallback(async (thenScanAgain: boolean) => {
    if (state.step !== 'found' || !selectedVariant) return
    const { product, barcode } = state

    const unitCalories = selectedVariant.kcal
    const quantity = isServing ? servingQty : (parseFloat(amount) || 0) / 100
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

    if (thenScanAgain) {
      setState({ step: 'scanning', loading: false })
      setSelectedIdx(0)
      setAmount('100')
      setServingQty(1)
      startCamera()
    } else {
      onClose()
    }
  }, [state, selectedVariant, isServing, servingQty, amount, total, date, onClose, startCamera])

  const handleNotFoundAdd = useCallback(() => {
    if (state.step !== 'not-found' && state.step !== 'lookup-error') return
    stopCamera()
    // When used inside FoodPicker (onAddEntry provided), just close — the user
    // returns to FoodPicker and enters data manually there.
    if (onAddEntry) {
      onClose()
    } else {
      onClose()
      route(`/add-intake/${date}?barcode=${state.barcode}`)
    }
  }, [state, date, onClose, onAddEntry, stopCamera])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [onClose, stopCamera])

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
                <div class={styles.cameraWrapper}>
                  <div ref={containerRef} />
                </div>
                <div class={styles.hint}>Point camera at a barcode</div>
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
                        if (v.unit === 'serving') setServingQty(1)
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

            {isServing ? (
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
                {selectedVariant?.servingSize && (
                  <div class={styles.servingNote}>
                    1 serving = {selectedVariant.servingSize}
                  </div>
                )}
              </div>
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
              <button class={styles.primaryButton} onClick={() => addEntry(false)}>
                {onAddEntry ? 'Add' : 'Add & Close'}
              </button>
              {!onAddEntry && (
                <button class={styles.secondaryButton} onClick={() => addEntry(true)}>
                  Add & Scan Next
                </button>
              )}
            </div>
          </>
        )}

        {state.step === 'error' && (
          <>
            <div class={styles.notFoundText}>{state.message}</div>
            <div>
              <div class={styles.fieldLabel}>Enter barcode manually</div>
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
            </div>
            <button
              class={styles.primaryButton}
              disabled={!manualBarcode.trim()}
              onClick={() => handleBarcode(manualBarcode.trim())}
            >
              Look Up
            </button>
          </>
        )}

        {state.step === 'not-found' && (
          <>
            <div class={styles.notFoundText}>
              No product found for barcode{' '}
              <span class={styles.notFoundBarcode}>{state.barcode}</span>
            </div>
            <div class={styles.actions}>
              <button class={styles.primaryButton} onClick={handleNotFoundAdd}>
                Add Manually
              </button>
              <button class={styles.secondaryButton} onClick={() => {
                setState({ step: 'scanning', loading: false })
                startCamera()
              }}>
                Scan Again
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
                Add Manually
              </button>
              <button class={styles.secondaryButton} onClick={() => {
                setState({ step: 'scanning', loading: false })
              }}>
                Scan Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
