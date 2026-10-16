import { useState, useEffect, useRef } from 'preact/hooks'
import styles from './FoodSpinner.module.css'

const FOOD_EMOJIS = ['🍎', '🥚', '🍕', '🥑', '🍌', '🧀', '🥕', '🍩']

export function FoodSpinner() {
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
