import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { Html5Qrcode } from 'html5-qrcode'
import { db } from '../db/index'
import { lookupBarcode, type OFFProduct, type CalorieVariant } from '../services/openfoodfacts'
import { route } from 'preact-router'
import styles from './BarcodeScanner.module.css'

interface BarcodeScannerProps {
  date: string
  onClose: () => void
}

type State =
  | { step: 'scanning'; loading: boolean }
  | { step: 'found'; product: OFFProduct; barcode: string }
  | { step: 'not-found'; barcode: string }
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

export function BarcodeScanner({ date, onClose }: BarcodeScannerProps) {
  const [state, setState] = useState<State>({ step: 'scanning', loading: false })
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [amount, setAmount] = useState('100')
  const [servingQty, setServingQty] = useState(1)
  const [manualBarcode, setManualBarcode] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)
  const runningRef = useRef(false)

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

    // 1. Check local customFoods
    const customFood = await db.customFoods.where('barcode').equals(barcode).first()
    if (customFood) {
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

    // 2. Query Open Food Facts
    const product = await lookupBarcode(barcode)
    if (product) {
      setState({ step: 'found', barcode, product })
      setSelectedIdx(0)
      setAmount('100')
      setServingQty(1)
      return
    }

    // 3. Not found
    setState({ step: 'not-found', barcode })
  }, [])

  useEffect(() => {
    startCamera()
    return stopCamera
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

    await db.intakeEntries.add({
      id: crypto.randomUUID(),
      date,
      name: [product.name, product.brand].filter(Boolean).join(' — '),
      calories: total,
      quantity,
      unitCalories,
      unit: selectedVariant.unit,
      source: 'barcode',
      barcode,
      createdAt: new Date().toISOString(),
    })

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
    if (state.step !== 'not-found') return
    stopCamera()
    onClose()
    route(`/add-intake/${date}?barcode=${state.barcode}`)
  }, [state, date, onClose, stopCamera])

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
            <div class={styles.cameraWrapper}>
              <div ref={containerRef} />
              {state.loading && (
                <div class={styles.loadingOverlay}>Looking up product...</div>
              )}
            </div>
            {!state.loading && <div class={styles.hint}>Point camera at a barcode</div>}
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
                  <input
                    type="number"
                    inputMode="numeric"
                    class={styles.amountInput}
                    value={amount}
                    onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
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
                Add & Close
              </button>
              <button class={styles.secondaryButton} onClick={() => addEntry(true)}>
                Add & Scan Next
              </button>
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
      </div>
    </div>
  )
}
