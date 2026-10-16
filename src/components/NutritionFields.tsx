import { useNutritionFormOpen } from '../hooks/useNutritionFormOpen'
import { NUTRIENT_KEYS, parseNutrientInputs, type NutrientInputs, type NutrientKey } from '../utils/nutrients'
import { NumericInput } from './NumericInput'
import styles from './NutritionFields.module.css'

const LABELS: Record<NutrientKey, string> = {
  fat: 'Fat',
  saturatedFat: 'of which saturated',
  carbs: 'Carbohydrate',
  sugars: 'of which sugars',
  fiber: 'Fiber',
  protein: 'Protein',
  salt: 'Salt',
}

const SUB_ROWS: NutrientKey[] = ['saturatedFat', 'sugars']

interface NutritionFieldsProps {
  values: NutrientInputs
  onChange: (key: NutrientKey, value: string) => void
  /** "per 100g", "total", ... */
  unitLabel: string
  /** "Total: fat 30 · ..." Null hides the line. */
  summary: string | null
}

export function NutritionFields({ values, onChange, unitLabel, summary }: NutritionFieldsProps) {
  const [open, toggle] = useNutritionFormOpen()

  // Count what the inputs give, not what they hold: "abc" is not a value.
  const parsed = parseNutrientInputs(values)
  const known = NUTRIENT_KEYS.filter((key) => parsed[key] !== undefined).length

  return (
    <div class={styles.section}>
      <button class={styles.header} onClick={toggle} aria-expanded={open}>
        <span>
          Nutrition (optional)
          {known > 0 && ` · ${known} of ${NUTRIENT_KEYS.length}`}
        </span>
        <span class={styles.chevron}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <>
          <div class={styles.unitLabel}>{unitLabel}</div>
          {NUTRIENT_KEYS.map((key) => (
            <label key={key} class={styles.row}>
              <span class={SUB_ROWS.includes(key) ? styles.subLabel : styles.label}>{LABELS[key]}</span>
              <span class={styles.inputGroup}>
                <NumericInput
                  type="text"
                  inputMode="decimal"
                  class={styles.input}
                  value={values[key]}
                  onInput={(e) => onChange(key, (e.target as HTMLInputElement).value)}
                />
                <span class={styles.unit}>g</span>
              </span>
            </label>
          ))}
          {summary && <div class={styles.summary}>{summary}</div>}
        </>
      )}
    </div>
  )
}
