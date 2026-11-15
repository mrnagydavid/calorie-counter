import { useState } from 'preact/hooks'
import type { GoalKey } from '../db/index'
import { foodSources, shareText } from '../utils/foodSources'
import { amountDays, daysBefore, type DayData } from '../utils/goalProgress'
import { GOALS } from '../utils/goals'
import { COUNT_RULE } from './goalTexts'
import { amountText } from './NutritionRows'
import styles from './TopSources.module.css'

// More foods than this fold into one "N other foods" row. One more would only replace that row.
const SHOWN = 5

interface TopSourcesProps {
  goalKey: GoalKey
  days: Map<string, DayData>
  today: string
  saltUnit?: 'salt' | 'sodium'
}

const PERIODS = [7, 28] as const
type PeriodDays = (typeof PERIODS)[number]

/**
 * The foods that gave the most of a nutrient, in the last 7 or the last 28 days. A switch picks
 * the period, so one list shows at a time.
 */
export function TopSources({ goalKey, days, today, saltUnit }: TopSourcesProps) {
  const [period, setPeriod] = useState<PeriodDays>(7)
  const sodium = goalKey === 'salt' && saltUnit === 'sodium'
  const periodDays = daysBefore(today, period).map((d) => days.get(d)).filter((d) => d !== undefined)
  return (
    <div class={styles.block}>
      <h2 class={styles.title}>Top sources</h2>
      <div class={styles.switch} role="group" aria-label="Period">
        {PERIODS.map((n) => (
          <button
            key={n}
            type="button"
            class={`${styles.switchButton} ${n === period ? styles.switchOn : ''}`}
            aria-pressed={n === period}
            onClick={() => setPeriod(n)}
          >
            Last {n} days
          </button>
        ))}
      </div>
      {/* The key starts each period folded */}
      <Period
        key={period}
        label={`Last ${period} days`}
        days={periodDays}
        goalKey={goalKey}
        sodium={sodium}
        name={sodium ? 'sodium' : GOALS[goalKey].title.toLowerCase()}
      />
      <p class={styles.rule}>The amounts are an average per day. {COUNT_RULE}</p>
    </div>
  )
}

interface PeriodProps {
  label: string
  days: DayData[]
  goalKey: GoalKey
  sodium: boolean
  /** The nutrient, in lower case. */
  name: string
}

/**
 * One period's list. The amounts are per day over the same days as the boxes at the top, so
 * they add up to the box's "about … g a day".
 */
function Period({ label, days, goalKey, sodium, name }: PeriodProps) {
  const [all, setAll] = useState(false)
  const counted = amountDays(days, goalKey)
  const foods = foodSources(
    counted.flatMap((d) => d.intakes),
    goalKey,
  )
  const total = foods.reduce((sum, f) => sum + f.amount, 0)
  const perDay = (grams: number) => amountText(grams / counted.length, sodium)
  const folds = foods.length > SHOWN + 1
  const shown = folds && !all ? foods.slice(0, SHOWN) : foods
  const rest = foods.slice(SHOWN)
  const restAmount = rest.reduce((sum, f) => sum + f.amount, 0)

  return (
    <div class={styles.period}>
      <div class={styles.head}>
        <span class={styles.label}>{label}</span>
        {total > 0 && <span class={styles.total}>Total: {perDay(total)} a day</span>}
      </div>
      {counted.length === 0 ? (
        <p class={styles.empty}>No day in this period counts.</p>
      ) : foods.length === 0 ? (
        <p class={styles.empty}>No food had {name} on these days.</p>
      ) : (
        <>
          {shown.map((food, i) => (
            <div key={i} class={styles.food}>
              <span class={styles.nameCell}>
                <span class={styles.name}>{food.name}</span>
                <span class={styles.days}>
                  on {food.days} {food.days === 1 ? 'day' : 'days'}
                </span>
              </span>
              <span class={styles.amount}>{perDay(food.amount)}</span>
              <span class={styles.share}>{shareText(food.amount, total)}</span>
            </div>
          ))}
          {folds && !all && (
            <button type="button" class={`${styles.food} ${styles.more}`} aria-expanded={false} onClick={() => setAll(true)}>
              <span class={styles.link}>{rest.length} other foods</span>
              <span class={styles.amount}>{perDay(restAmount)}</span>
              <span class={styles.share}>{shareText(restAmount, total)}</span>
            </button>
          )}
          {folds && all && (
            <button type="button" class={styles.more} aria-expanded={true} onClick={() => setAll(false)}>
              <span class={styles.link}>Show fewer</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}
