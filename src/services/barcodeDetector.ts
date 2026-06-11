// Barcode detection capability + shared helpers.
//
// We use the platform-native `BarcodeDetector` where it can decode retail barcodes
// (Android Chrome, recent Chromium, Safari on iOS 17+ does NOT ship it) and fall back
// to the html5-qrcode library otherwise. The native engine is hardware-accelerated and
// noticeably better at recognition; html5-qrcode (ZXing-js) is the iOS fallback.

/**
 * Retail product barcode formats. The numeric-length check in `isValidBarcode`
 * does the final validation, so this list just narrows what the decoder looks for
 * (fewer false reads, no QR/data-matrix work).
 */
export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf']

const VALID_BARCODE_LENGTHS = new Set([8, 12, 13, 14])

/** A decoded value is a plausible product barcode only if it's all-digits of a retail length. */
export function isValidBarcode(s: string): boolean {
  const trimmed = s.trim()
  return /^\d+$/.test(trimmed) && VALID_BARCODE_LENGTHS.has(trimmed.length)
}

let cached: Promise<boolean> | null = null

/**
 * Resolves true only when the native BarcodeDetector exists AND can decode at least one
 * retail format. (Some Chromium builds expose the API but support no formats — those should
 * fall back to html5-qrcode too, not run a dead camera.) Cached after the first call.
 */
export function supportsNativeBarcodeDetector(): Promise<boolean> {
  cached ??= (async () => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return false
    try {
      const formats = await BarcodeDetector.getSupportedFormats()
      return SCAN_FORMATS.some((f) => formats.includes(f))
    } catch {
      return false
    }
  })()
  return cached
}
