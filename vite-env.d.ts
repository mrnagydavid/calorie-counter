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
