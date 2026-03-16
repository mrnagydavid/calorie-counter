import type { JSX } from 'preact'

type InputProps = JSX.IntrinsicElements['input']

/** Numeric input that auto-selects content on focus. Drop-in replacement for <input type="number">. */
export function NumericInput(props: InputProps) {
  return (
    <input
      type="number"
      {...props}
      onFocus={(e) => {
        (e.target as HTMLInputElement).select()
        if (typeof props.onFocus === 'function') props.onFocus(e)
      }}
    />
  )
}
