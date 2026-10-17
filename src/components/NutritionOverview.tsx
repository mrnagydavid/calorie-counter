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
  weeksBefore,
  type DayData,
  type DayMark,
} from '../utils/goalProgress'
import { activeGoals, describeGoal, GOAL_KEYS, GOALS } from '../utils/goals'
import { GoalDetail } from './GoalDetail'
import { capitalize, CAVEAT, COUNT_RULE, STATUS_TEXT } from './goalTexts'
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
          {GOALS[key].kind === 'habit' ? (
            <HabitCard goalKey={key} goal={goals[key]!} last7={last7} last28={last28} weightKg={weight.weightKg} saltUnit={settings.saltUnit} />
          ) : (
            <DailyCard goalKey={key} last7={last7} last28={last28} />
          )}
        </button>
      ))}
      {hasDaily && <Legend />}
      <p class={styles.rule}>{COUNT_RULE}</p>

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

interface HabitCardProps {
  goalKey: GoalKey
  goal: NutrientGoal
  last7: DayData[]
  last28: DayData[]
  weightKg?: number
  saltUnit?: 'salt' | 'sodium'
}

function HabitCard({ goalKey, goal, last7, last28, weightKg, saltUnit }: HabitCardProps) {
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

function DailyCard({ goalKey, last7, last28 }: { goalKey: GoalKey; last7: DayData[]; last28: DayData[] }) {
  const d7 = dailyResult(last7, goalKey)
  const d28 = dailyResult(last28, goalKey)
  const met = (r: { met: number; counted: number }) => (r.counted > 0 ? `${r.met} of ${r.counted}` : '–')
  return (
    <>
      <span class={styles.stats}>
        <span class={styles.stat}>
          <span class={styles.statLabel}>7 days</span>
          <span class={styles.statValue}>{met(d7)}</span>
        </span>
        <span class={styles.stat}>
          <span class={styles.statLabel}>28 days</span>
          <span class={styles.statValue}>{met(d28)}</span>
        </span>
      </span>
      <span class={styles.strip} role="img" aria-label={`Last 28 days: ${d28.met} met, ${d28.counted - d28.met} not met`}>
        {d28.marks.map((m, i) => <span key={i} class={`${styles.mark} ${MARK_CLASS[m]}`} />)}
      </span>
    </>
  )
}

const MARK_CLASS: Record<DayMark, string> = {
  met: styles.markMet,
  missed: styles.markMissed,
  none: styles.markNone,
}

function Legend() {
  return (
    <div class={styles.legend}>
      <span class={styles.legendItem}><span class={`${styles.mark} ${styles.markMet}`} />Met</span>
      <span class={styles.legendItem}><span class={`${styles.mark} ${styles.markMissed}`} />Not met</span>
      <span class={styles.legendItem}><span class={`${styles.mark} ${styles.markNone}`} />Not counted</span>
    </div>
  )
}
