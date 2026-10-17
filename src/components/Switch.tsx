import styles from './Switch.module.css'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/** An on/off switch. The button is 44px tall, so it is easy to hit. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      class={styles.switch}
      onClick={() => onChange(!checked)}
    >
      <span class={`${styles.track} ${checked ? styles.on : ''}`}>
        <span class={styles.knob} />
      </span>
    </button>
  )
}
