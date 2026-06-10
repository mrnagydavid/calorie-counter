import { route } from 'preact-router'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { db } from '../db/index'
import { lookupBarcode, type CalorieVariant, type OFFProduct, type LookupError } from '../services/openfoodfacts'
import { BarcodeDetector, ensureWasmConfigured, SCAN_FORMATS } from '../services/barcodeDetector'
import { FoodForm, type FoodFormResult } from './FoodForm'
import styles from './BarcodeScanner.module.css'
import { NumericInput } from './NumericInput'

const FOOD_EMOJIS = ['🍎', '🥚', '🍕', '🥑', '🍌', '🧀', '🥕', '🍩']

// Throttle the detect loop to ~9 attempts/sec. The wasm decode is expensive, so we pace
// with a recursive setTimeout (the next attempt is scheduled only after the current finishes).
const DETECT_INTERVAL_MS = 110

const VALID_BARCODE_LENGTHS = new Set([8, 12, 13, 14])
function isValidBarcode(s: string): boolean {
  const trimmed = s.trim()
  return /^\d+$/.test(trimmed) && VALID_BARCODE_LENGTHS.has(trimmed.length)
}

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
  | { step: 'found'; product: OFFProduct; barcode: string; customFoodId?: string }
  | { step: 'editing'; product: OFFProduct; barcode: string; customFoodId: string }
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

export function BarcodeScanner({ date, onClose, onAddEntry }: BarcodeScannerProps) {
  const [state, setState] = useState<State>({ step: 'scanning', loading: false })
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [amount, setAmount] = useState('100')
  const [servingQty, setServingQty] = useState(1)
  const [manualBarcode, setManualBarcode] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannedRef = useRef(false)
  const runningRef = useRef(false)
  const epochRef = useRef(0)
  const detectingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  // Refs for forward/self references the detect loop needs, so the loop's useCallback can list
  // honest deps without a TDZ on later-defined callbacks (keeps exhaustive-deps happy + stable).
  const detectLoopRef = useRef<(epoch: number) => void>(() => {})
  const handleBarcodeRef = useRef<(barcode: string) => void>(() => {})

  // Idempotent teardown: invalidate any in-flight async work (epoch bump), cancel the loop,
  // turn the torch off, release every camera track, and detach the stream from the <video>.
  // Releasing tracks + nulling srcObject is what reliably clears the OS camera indicator.
  const stopCamera = useCallback(() => {
    epochRef.current++
    runningRef.current = false
    detectingRef.current = false
    if (loopTimerRef.current !== null) {
      clearTimeout(loopTimerRef.current)
      loopTimerRef.current = null
    }
    const track = trackRef.current
    if (track) {
      try { track.applyConstraints({ advanced: [{ torch: false }] }) } catch { /* ignore */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    streamRef.current = null
    trackRef.current = null
    setTorchOn(false)
    setTorchSupported(false)
  }, [])

  // Self-rescheduling detection loop. `epoch` is captured per start; if a teardown or restart
  // happens, the epoch no longer matches and the loop (or a late-resolving detect()) bails.
  // Self/forward references (itself, handleBarcode) go through refs so the dep list stays honest.
  const detectLoop = useCallback(async (epoch: number) => {
    if (epoch !== epochRef.current || !runningRef.current) return

    const video = videoRef.current
    const detector = detectorRef.current
    if (video && detector && !detectingRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
      detectingRef.current = true
      try {
        const results = await detector.detect(video)
        // Guard: this detect() may have resolved after teardown — do nothing if so.
        if (epoch !== epochRef.current || !runningRef.current) return
        const hit = results.find((r) => isValidBarcode(r.rawValue))
        if (hit) {
          if (scannedRef.current) return
          scannedRef.current = true
          stopCamera()
          handleBarcodeRef.current(hit.rawValue.trim())
          return
        }
      } catch {
        // Transient decode error (e.g. frame not ready) — keep scanning.
      } finally {
        detectingRef.current = false
      }
    }

    // Re-check before rescheduling: a detect() that rejected after teardown reaches here, and
    // we must not leave a stray timer behind once the camera has stopped.
    if (epoch !== epochRef.current || !runningRef.current) return
    loopTimerRef.current = setTimeout(() => { detectLoopRef.current(epoch) }, DETECT_INTERVAL_MS)
  }, [stopCamera])
  detectLoopRef.current = detectLoop

  const startCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    stopCamera()
    scannedRef.current = false
    const myEpoch = ++epochRef.current
    ensureWasmConfigured()

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // `ideal` (not `exact`) so a front-only/low-res device still gets a camera
        // instead of an OverconstrainedError. Higher resolution sharpens small barcodes.
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
    } catch (err) {
      if (myEpoch !== epochRef.current) return
      console.error('Camera start failed:', err)
      setState({ step: 'error', message: 'Camera not available. Please use manual entry.' })
      return
    }

    // Torn down (closed/unmounted) while awaiting permission — release the orphaned stream.
    if (myEpoch !== epochRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    streamRef.current = stream
    const track = stream.getVideoTracks()[0]
    trackRef.current = track

    video.srcObject = stream
    video.muted = true
    try {
      await video.play()
    } catch {
      // Autoplay can reject if interrupted by teardown — harmless.
    }
    if (myEpoch !== epochRef.current) { stopCamera(); return }

    // Best-effort camera tuning — never throw (focusMode is typically unsupported on iOS).
    try {
      const caps = track.getCapabilities?.() ?? {}
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }) } catch { /* ignore */ }
      }
      setTorchSupported(caps.torch === true)
    } catch {
      setTorchSupported(false)
    }
    if (myEpoch !== epochRef.current) { stopCamera(); return }

    // Construct once and reuse across restarts (holds no camera resource).
    if (!detectorRef.current) {
      detectorRef.current = new BarcodeDetector({ formats: SCAN_FORMATS })
    }

    runningRef.current = true
    detectingRef.current = false
    loopTimerRef.current = setTimeout(() => { detectLoopRef.current(myEpoch) }, DETECT_INTERVAL_MS)
  }, [stopCamera])

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      // Some devices advertise torch but reject applyConstraints — don't show a broken control.
      setTorchSupported(false)
      setTorchOn(false)
    }
  }, [torchOn])

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
        customFoodId: customFood.id,
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

    if (result.error === 'not-found') {
      setState({ step: 'not-found', barcode })
      return
    }

    // Timeout or network error
    setState({ step: 'lookup-error', barcode, error: result.error })
  }, [])
  handleBarcodeRef.current = handleBarcode

  // Start the camera whenever we (re)enter the live scanning step; stop it on any transition
  // away (loading/found/not-found/error) and on unmount. Effects run after commit, so the
  // <video> element is mounted by the time startCamera reads videoRef.
  const isScanningLive = state.step === 'scanning' && !state.loading
  useEffect(() => {
    if (isScanningLive) {
      void startCamera()
    }
    return stopCamera
  }, [isScanningLive, startCamera, stopCamera])

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

  const handleEditCustomFood = useCallback(() => {
    if (state.step !== 'found' || !state.customFoodId) return
    setState({
      step: 'editing',
      product: state.product,
      barcode: state.barcode,
      customFoodId: state.customFoodId,
    })
  }, [state])

  const handleEditSave = useCallback(async (result: FoodFormResult) => {
    if (state.step !== 'editing') return
    const { barcode, customFoodId } = state

    // Update the custom food in DB
    await db.customFoods.update(customFoodId, {
      name: result.name,
      caloriesPerUnit: result.unitCalories,
      unit: result.unit,
      lastUsed: new Date().toISOString(),
    })

    // Return to found screen with updated data
    const isUpdatedCountBased = result.unit === 'serving' || result.unit === 'total' || result.unit === 'piece'
    setState({
      step: 'found',
      barcode,
      product: {
        name: result.name,
        variants: [{
          kcal: result.unitCalories,
          unit: result.unit as CalorieVariant['unit'],
        }],
      },
      customFoodId,
    })
    setSelectedIdx(0)
    if (isUpdatedCountBased) {
      setServingQty(1)
    } else {
      setAmount('100')
    }
  }, [state])

  const handleEditCancel = useCallback(() => {
    if (state.step !== 'editing') return
    // Return to found screen with original data
    setState({
      step: 'found',
      barcode: state.barcode,
      product: state.product,
      customFoodId: state.customFoodId,
    })
  }, [state])

  return (
    <div class={styles.overlay}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={state.step === 'editing' ? handleEditCancel : handleClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>
          {state.step === 'editing' ? 'Edit Food' : 'Scan Barcode'}
        </h1>
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
                  <video ref={videoRef} muted autoplay playsinline />
                  {torchSupported && (
                    <button
                      type="button"
                      class={`${styles.torchButton} ${torchOn ? styles.torchOn : ''}`}
                      aria-label="Toggle flashlight"
                      aria-pressed={torchOn}
                      onClick={toggleTorch}
                    >
                      🔦
                    </button>
                  )}
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

            {state.customFoodId && (
              <button class={styles.editLink} onClick={handleEditCustomFood}>
                ✏️ Edit food definition
              </button>
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

        {state.step === 'editing' && (
          <FoodForm
            initial={{
              name: state.product.name,
              unit: state.product.variants[0].unit,
              unitCalories: state.product.variants[0].kcal,
            }}
            showNameField
            nameRequired
            submitLabel="Save"
            onSubmit={handleEditSave}
          />
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
              disabled={!isValidBarcode(manualBarcode)}
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
              }}>
                Scan Again
              </button>
            </div>
            <div class={styles.orDivider}>or enter barcode manually</div>
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
            <button
              class={styles.primaryButton}
              disabled={!isValidBarcode(manualBarcode)}
              onClick={() => handleBarcode(manualBarcode.trim())}
            >
              Search this barcode
            </button>
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
