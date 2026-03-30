import type { JSX } from 'preact'

type InputProps = JSX.IntrinsicElements['input']

/** Numeric input that auto-selects content on focus and blurs on Enter. Drop-in replacement for <input type="number">. */
export function NumericInput(props: InputProps) {
  return (
    <input
      type="number"
      {...props}
      onFocus={(e) => {
        ;(e.target as HTMLInputElement).select()
        if (typeof props.onFocus === 'function') props.onFocus(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        }
        if (typeof props.onKeyDown === 'function') props.onKeyDown(e)
      }}
    />
  )
}
