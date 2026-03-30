import { useState } from 'preact/hooks'
import styles from './FeatureIntro.module.css'

interface FeatureIntroProps {
  featureKey: string
  version: number
  children: preact.ComponentChildren
}

function storageKey(featureKey: string) {
  return `intro-${featureKey}`
}

function isDismissed(featureKey: string, version: number): boolean {
  const stored = localStorage.getItem(storageKey(featureKey))
  return stored !== null && parseInt(stored, 10) >= version
}

export function FeatureIntro({ featureKey, version, children }: FeatureIntroProps) {
  const [dismissed, setDismissed] = useState(() => isDismissed(featureKey, version))

  if (dismissed) return null

  const dismiss = () => {
    localStorage.setItem(storageKey(featureKey), String(version))
    setDismissed(true)
  }

  return (
    <div class={styles.intro}>
      <div class={styles.text}>{children}</div>
      <button class={styles.dismiss} onClick={dismiss}>Got it</button>
    </div>
  )
}
