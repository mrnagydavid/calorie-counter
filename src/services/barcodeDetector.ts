import { BarcodeDetector, prepareZXingModule, type BarcodeFormat } from 'barcode-detector/ponyfill'

// Self-hosted wasm served at a stable URL by the `zxing-wasm-asset` Vite plugin (see vite.config.ts),
// instead of the default jsDelivr CDN fetch — so scanning works offline (Workbox precaches it).
const wasmUrl = `${import.meta.env.BASE_URL}zxing_reader.wasm`

let prepared = false

/**
 * Point the ZXing-C++ WASM engine at our bundled, service-worker-precached asset.
 * Must run once before the first detect(); calling it again is a no-op.
 */
export function ensureWasmConfigured(): void {
  if (prepared) return
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
  })
  prepared = true
}

/**
 * Retail product barcode formats. The numeric-length check in `isValidBarcode`
 * does the final validation, so this list just narrows what the decoder looks for
 * (fewer false reads, no QR/data-matrix work).
 */
export const SCAN_FORMATS: BarcodeFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf']

export { BarcodeDetector }
