/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

// `torch` and `focusMode` are non-standard camera controls not yet in lib.dom.d.ts.
// These declaration-merge into the DOM types so we can use them without `as any`.
interface MediaTrackCapabilities {
  torch?: boolean
  focusMode?: string[]
}

interface MediaTrackConstraintSet {
  torch?: boolean
  focusMode?: string
}

// The native BarcodeDetector API (https://wicg.github.io/shape-detection-api/) is not yet in
// lib.dom.d.ts. Minimal ambient declarations so we can feature-detect and use it directly.
interface DetectedBarcode {
  boundingBox: DOMRectReadOnly
  cornerPoints: { x: number; y: number }[]
  format: string
  rawValue: string
}

interface BarcodeDetectorOptions {
  formats: string[]
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  static getSupportedFormats(): Promise<string[]>
  detect(source: CanvasImageSource | Blob | ImageData): Promise<DetectedBarcode[]>
}
