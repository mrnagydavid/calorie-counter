import { useMemo, useState } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import type { GoalKey, NutrientGoal } from '../db/index'
import { db } from '../db/index'
import { shiftDate } from '../db/dates'
import { useGoalDays } from '../hooks/useGoalDays'
import { useLatestWeight } from '../hooks/useLatestWeight'
import { useToday } from '../hooks/useToday'
import {
  averageInUnit,
  dailyResult,
  daysBefore,
  formatInUnit,
  habitResult,
  inUnit,
  missSide,
  weeksBefore,
  type DayData,
  type DayMark,
} from '../utils/goalProgress'
import { activeGoals, describeGoal, GOAL_KEYS, GOALS } from '../utils/goals'
import { GoalDetail } from './GoalDetail'
import { capitalize, CAVEAT, CLOSE_RULE, COUNT_RULE, STATUS_TEXT } from './goalTexts'
import styles from './NutritionOverview.module.css'

const WEEKS = 26

/** The Overview's Nutrition tab: a card for each goal that is on. */
export function NutritionOverview() {
  const today = useToday()
  const settings = useLiveQuery(() => db.settings.get('user-settings'))
  const weight = useLatestWeight(settings?.lastWeightKg)
  const weeks = useMemo(() => weeksBefore(today, WEEKS), [today])
  const days = useGoalDays(weeks[0][0], shiftDate(today, -1))
  const [detail, setDetail] = useState<GoalKey | null>(null)

  if (!settings || !days) return null

  const goals = activeGoals(settings.nutrientGoals)
  if (!goals) return <p class={styles.empty}>No nutrition goals yet. You can set them in Settings.</p>

  const pick = (dates: string[]) => dates.map((d) => days.get(d)).filter((d) => d !== undefined)
  const last7 = pick(daysBefore(today, 7))
  const last28 = pick(daysBefore(today, 28))
  const keys = GOAL_KEYS.filter((key) => goals[key])
  const hasDaily = keys.some((key) => GOALS[key].kind === 'daily')
  const opts = { saltUnit: settings.saltUnit, weightKg: weight.weightKg }

  return (
    <div class={styles.tab}>
      <p class={styles.caveat}>{CAVEAT}</p>
      {keys.map((key) => (
        <button key={key} type="button" class={styles.card} onClick={() => setDetail(key)}>
          <span class={styles.cardHeader}>
            <span class={styles.cardName}>{key === 'salt' && settings.saltUnit === 'sodium' ? 'Sodium' : GOALS[key].title}</span>
            <svg class={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
          <span class={styles.cardGoal}>{capitalize(describeGoal(goals[key]!, key, opts))}</span>
          <AverageStats goalKey={key} goal={goals[key]!} last7={last7} last28={last28} weightKg={weight.weightKg} saltUnit={settings.saltUnit} />
          {GOALS[key].kind === 'daily' && <DayStrip goalKey={key} days={last28} />}
        </button>
      ))}
      {hasDaily && <Legend />}
      {hasDaily && <p class={styles.rule}>▲ above the goal, ▼ below the goal.</p>}
      <p class={styles.rule}>{hasDaily ? `${COUNT_RULE} ${CLOSE_RULE}` : COUNT_RULE}</p>

      {detail && goals[detail] && (
        <GoalDetail
          goalKey={detail}
          goal={goals[detail]!}
          days={days}
          weeks={weeks}
          today={today}
          saltUnit={settings.saltUnit}
          weightKg={weight.weightKg}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

interface AverageStatsProps {
  goalKey: GoalKey
  goal: NutrientGoal
  last7: DayData[]
  last28: DayData[]
  weightKg?: number
  saltUnit?: 'salt' | 'sodium'
}

/**
 * The 7-day and 28-day averages, and the 28-day result. Every card shows them, daily goals too,
 * so all cards give the same information at first glance.
 */
function AverageStats({ goalKey, goal, last7, last28, weightKg, saltUnit }: AverageStatsProps) {
  // An average needs no goal: before any day had the goal, the card still shows the amount.
  const value = (days: DayData[]) => {
    const r = habitResult(days, goalKey)
    const v = r ? inUnit(r.amount, r, goal.unit, goalKey, weightKg) : averageInUnit(days, goalKey, goal.unit, weightKg)
    return v === undefined ? '–' : formatInUnit(v, goal.unit, goalKey, saltUnit)
  }
  const r28 = habitResult(last28, goalKey)
  return (
    <span class={styles.stats}>
      <span class={styles.stat}>
        <span class={styles.statLabel}>7 days</span>
        <span class={styles.statValue}>{value(last7)}</span>
      </span>
      <span class={styles.stat}>
        <span class={styles.statLabel}>28 days</span>
        <span class={styles.statValue}>{value(last28)}</span>
      </span>
      {r28 && (
        <span class={`${styles.chip} ${r28.status === 'within' ? styles.chipMet : styles.chipNotMet}`}>
          {STATUS_TEXT[r28.status]}
        </span>
      )}
    </span>
  )
}

type Side = 'above' | 'below'

/**
 * A daily goal's last 28 days, because an average hides missed days. A missed day is a triangle
 * that points to the side it missed on. The color tells how far: close or off.
 */
function DayStrip({ goalKey, days }: { goalKey: GoalKey; days: DayData[] }) {
  const { marks } = dailyResult(days, goalKey)
  const sides = days.map((d) => missSide(d, goalKey))
  const count = (mark: DayMark, side?: Side) =>
    marks.filter((m, i) => m === mark && (side === undefined || sides[i] === side)).length
  const parts: [number, string][] = [
    [count('met'), 'met'],
    [count('close', 'above'), 'close above the goal'],
    [count('close', 'below'), 'close below the goal'],
    [count('missed', 'above'), 'off above the goal'],
    [count('missed', 'below'), 'off below the goal'],
  ]
  const label = `Last 28 days: ${parts.filter(([n]) => n > 0).map(([n, text]) => `${n} ${text}`).join(', ') || 'no day counted'}`
  return (
    <span class={styles.strip} role="img" aria-label={label}>
      {marks.map((m, i) => <span key={i} class={markClass(m, sides[i])} />)}
    </span>
  )
}

const MARK_CLASS: Record<DayMark, string> = {
  met: styles.markMet,
  close: styles.markClose,
  missed: styles.markMissed,
  none: styles.markNone,
}

const SIDE_CLASS: Record<Side, string> = { above: styles.markUp, below: styles.markDown }

const markClass = (mark: DayMark, side?: Side) =>
  `${styles.mark} ${MARK_CLASS[mark]}${side ? ` ${SIDE_CLASS[side]}` : ''}`

function Legend() {
  return (
    <div class={styles.legend}>
      <span class={styles.legendItem}><span class={markClass('met')} />Met</span>
      <span class={styles.legendItem}>
        <span class={markClass('close', 'above')} />
        <span class={markClass('close', 'below')} />
        Close
      </span>
      <span class={styles.legendItem}>
        <span class={markClass('missed', 'above')} />
        <span class={markClass('missed', 'below')} />
        Off
      </span>
      <span class={styles.legendItem}><span class={markClass('none')} />Not counted</span>
    </div>
  )
}
