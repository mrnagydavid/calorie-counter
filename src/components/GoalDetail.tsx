import type { GoalKey, GoalUnit, NutrientGoal } from '../db/index'
import { parseDate, shiftDate } from '../db/dates'
import {
  averageInUnit,
  dailyResult,
  daysBefore,
  formatInUnit,
  habitResult,
  inUnit,
  mondayOf,
  type DayData,
  type DayMark,
  type HabitResult,
} from '../utils/goalProgress'
import { describeGoal, GOALS, matchPreset, SODIUM_MG_PER_SALT_G, UNIT_OPTIONS } from '../utils/goals'
import { EditScreen } from './EditScreen'
import { capitalize, CAVEAT, COUNT_RULE, STATUS_TEXT } from './goalTexts'
import styles from './GoalDetail.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface GoalDetailProps {
  goalKey: GoalKey
  /** The current goal. Each day is judged with its own copy. */
  goal: NutrientGoal
  days: Map<string, DayData>
  /** The last 26 weeks, Monday to Sunday, oldest first. */
  weeks: string[][]
  today: string
  saltUnit?: 'salt' | 'sodium'
  weightKg?: number
  onClose: () => void
}

export function GoalDetail(props: GoalDetailProps) {
  const { goalKey, goal, saltUnit, weightKg, onClose } = props
  const config = GOALS[goalKey]
  const title = goalKey === 'salt' && saltUnit === 'sodium' ? 'Sodium' : config.title
  const preset = matchPreset(config.presets, goal)

  return (
    <EditScreen title={title} onClose={onClose}>
      <div class={styles.goal}>
        <span class={styles.goalText}>{capitalize(describeGoal(goal, goalKey, { saltUnit, weightKg }))}</span>
        <span class={styles.goalSub}>
          {config.kind === 'habit'
            ? `${preset ? `${saltUnit === 'sodium' && preset.sodiumLabel ? preset.sodiumLabel : preset.label} · ` : ''}judged on your average over weeks`
            : 'Judged day by day. Each day uses the goal it had on that day.'}
        </span>
      </div>
      <p class={styles.caveat}>{CAVEAT}</p>
      {config.kind === 'habit' ? <HabitDetail {...props} /> : <DailyDetail {...props} />}
    </EditScreen>
  )
}

const pick = (days: Map<string, DayData>, dates: string[]) =>
  dates.map((d) => days.get(d)).filter((d) => d !== undefined)

/** "0.6% of kcal", "2.0 g", "300 mg". */
function formatDiff(value: number, unit: GoalUnit, key: GoalKey, saltUnit?: 'salt' | 'sodium') {
  if (unit === 'pctKcal' && key !== 'salt') return `${value.toFixed(1)}% of kcal`
  return formatInUnit(value, unit, key, saltUnit)
}

const grams = (g: number) => String(g < 10 ? Math.round(g * 10) / 10 : Math.round(g))

function HabitDetail({ goalKey, goal, days, weeks, today, saltUnit, weightKg }: GoalDetailProps) {
  const last7 = pick(days, daysBefore(today, 7))
  const last28 = pick(days, daysBefore(today, 28))
  const r7 = habitResult(last7, goalKey)
  const r28 = habitResult(last28, goalKey)
  const unitValue = (sum: number, r: HabitResult) => inUnit(sum, r, goal.unit, goalKey, weightKg)

  // An average needs no goal: before any day had the goal, the box still shows the amount.
  const box = (label: string, r: HabitResult | undefined, dates: DayData[]) => {
    const v = r ? unitValue(r.amount, r) : averageInUnit(dates, goalKey, goal.unit, weightKg)
    const perDay = r ? r.amount / r.days : averageInUnit(dates, goalKey, 'g', weightKg)
    return (
      <div class={styles.box}>
        <span class={styles.boxLabel}>{label}</span>
        <span class={styles.boxValue}>{v === undefined ? '–' : formatInUnit(v, goal.unit, goalKey, saltUnit)}</span>
        {perDay !== undefined && <span class={styles.boxSub}>about {grams(perDay)} g a day</span>}
      </div>
    )
  }

  let chip: string | null = null
  if (r28) {
    chip = STATUS_TEXT[r28.status]
    const value = unitValue(r28.amount, r28)
    const limit = r28.status === 'above' ? r28.max : r28.status === 'below' ? r28.min : undefined
    const limitValue = limit === undefined ? undefined : unitValue(limit, r28)
    if (value !== undefined && limitValue !== undefined) {
      chip += ` by ${formatDiff(Math.abs(value - limitValue), goal.unit, goalKey, saltUnit)}`
    }
  }

  // One bar for each week. A week with no goal has a grey bar and no goal line.
  const points = weeks.map((dates) => {
    const weekDays = pick(days, dates)
    const r = habitResult(weekDays, goalKey)
    return {
      value: averageInUnit(weekDays, goalKey, goal.unit, weightKg),
      status: r?.status,
      max: r?.max !== undefined ? unitValue(r.max, r) : undefined,
      min: r?.min !== undefined ? unitValue(r.min, r) : undefined,
    }
  })
  // The scale always holds the current goal, so a bar can be read against it, also alone.
  const goalValues = [goal.min, goal.max].filter((v) => v !== undefined)
  const highest = Math.max(...points.flatMap((p) => [p.value ?? 0, p.max ?? 0, p.min ?? 0]), ...goalValues)
  const top = niceCeil(highest * 1.1)
  const share = (v: number) => (v / top) * 100
  const height = (v: number) => `${share(v)}%`
  const outsideText = outsideLabel(goal)
  const axisNumber = (v: number) =>
    goalKey === 'salt' && saltUnit === 'sodium' ? String(Math.round(v * SODIUM_MG_PER_SALT_G)) : String(Math.round(v * 100) / 100)
  // Each bar is the average per day of its week. A share of kcal is already per day.
  const unitCaption =
    goalKey === 'salt'
      ? `${saltUnit === 'sodium' ? 'mg sodium' : 'g salt'} per day`
      : goal.unit === 'g' || goal.unit === 'gPerKg'
        ? `${UNIT_OPTIONS[goal.unit]} per day`
        : UNIT_OPTIONS[goal.unit]
  // Labels closer than this share of the height would overlap
  const GAP = 12
  const showTop = goalValues.every((v) => 100 - share(v) >= GAP)
  const showZero = goalValues.every((v) => share(v) >= GAP)

  return (
    <>
      <div class={styles.boxes}>
        {box('Last 7 days', r7, last7)}
        {box('Last 28 days', r28, last28)}
      </div>
      {chip && r28 && <span class={`${styles.chip} ${r28.status === 'within' ? styles.chipMet : styles.chipNotMet}`}>{chip}</span>}

      <div class={styles.chartBlock}>
        <h2 class={styles.chartTitle}>Average per day, by week</h2>
        {/* One bar is not a trend */}
        {points.filter((p) => p.value !== undefined).length < 2 ? (
          <p class={styles.rule}>{tooFewWeeks(points.filter((p) => p.value !== undefined).length)}</p>
        ) : (
        <>
        <p class={styles.chartUnit}>In {unitCaption}</p>
        <div class={styles.chartArea}>
          <div class={styles.axis} aria-hidden="true">
            {showTop && <span class={styles.axisLabel} style={{ bottom: '100%' }}>{axisNumber(top)}</span>}
            {goalValues.map((v) => (
              <span key={v} class={`${styles.axisLabel} ${styles.axisGoal}`} style={{ bottom: height(v) }}>{axisNumber(v)}</span>
            ))}
            {showZero && <span class={styles.axisLabel} style={{ bottom: '0%' }}>0</span>}
          </div>
        <div class={styles.chart} role="img" aria-label={`Average per day for each of the last ${weeks.length} weeks, with the goal as a line`}>
          {/* The current goal, across all weeks */}
          {goalValues.map((v) => <div key={v} class={styles.currentGoal} style={{ bottom: height(v) }} />)}
          {points.map((p, i) => (
            <div key={i} class={styles.column}>
              {p.value !== undefined && (
                <div
                  class={`${styles.bar} ${p.status === undefined ? styles.barNoGoal : p.status === 'within' ? styles.barMet : styles.barNotMet}`}
                  style={{ height: height(p.value) }}
                />
              )}
              {p.max !== undefined && <div class={styles.goalLine} style={{ bottom: height(p.max) }} />}
              {p.min !== undefined && <div class={styles.goalLine} style={{ bottom: height(p.min) }} />}
            </div>
          ))}
        </div>
        </div>
        <div class={styles.monthsUnderAxis}>
          <MonthLabels weeks={weeks} />
        </div>
        <div class={styles.legend}>
          <span class={styles.legendItem}><span class={`${styles.swatch} ${styles.barMet}`} />Within goal</span>
          <span class={styles.legendItem}><span class={`${styles.swatch} ${styles.barNotMet}`} />{outsideText}</span>
          <span class={styles.legendItem}><span class={styles.lineSwatch} />Goal</span>
          <span class={styles.legendItem}><span class={styles.dashSwatch} />Current goal</span>
        </div>
        </>
        )}
      </div>
    </>
  )
}

/** Why a chart is not shown yet, and when it will be. */
function tooFewWeeks(weeksWithData: number): string {
  return `This chart needs data from at least 2 weeks to show a trend. So far you have ${
    weeksWithData === 0 ? 'no data' : 'data from 1 week'
  }.`
}

/** A round top for the scale: 1, 2, 2.5 or 5 times a power of ten. */
function niceCeil(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 2.5, 5, 10].map((f) => f * power).find((v) => v >= value)!
}

/** The legend word for a week that misses the goal. */
function outsideLabel(goal: NutrientGoal): string {
  if (goal.min !== undefined && goal.max !== undefined) return 'Outside goal'
  return goal.min !== undefined ? 'Below goal' : 'Above goal'
}

function MonthLabels({ weeks }: { weeks: string[][] }) {
  let previous = -1
  return (
    <div class={styles.months} aria-hidden="true">
      {weeks.map((dates, i) => {
        const monday = dates[0] ?? ''
        const month = monday ? parseDate(monday).getMonth() : previous
        const label = i > 0 && month !== previous ? MONTHS[month] : ''
        previous = month
        return <span key={i} class={styles.month}>{label}</span>
      })}
    </div>
  )
}

function DailyDetail({ goalKey, days, weeks, today }: GoalDetailProps) {
  const last28Dates = daysBefore(today, 28)
  const d7 = dailyResult(pick(days, daysBefore(today, 7)), goalKey)
  const d28 = dailyResult(pick(days, last28Dates), goalKey)
  const marks = new Map<string, DayMark>(last28Dates.map((date, i) => [date, d28.marks[i]]))

  // Monday to Sunday, from the week of the first of the 28 days to the current week.
  const start = mondayOf(last28Dates[0])
  const end = shiftDate(mondayOf(today), 6)
  const cells: { date: string; kind: DayMark | 'outside' | 'today' | 'future' }[] = []
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const kind = marks.get(date) ?? (date === today ? 'today' : date > today ? 'future' : 'outside')
    cells.push({ date, kind })
  }

  const perWeek = weeks.map((dates) => {
    const r = dailyResult(pick(days, dates), goalKey)
    return r.counted > 0 ? r.met : undefined
  })

  return (
    <>
      <div class={styles.boxes}>
        <div class={styles.box}>
          <span class={styles.boxLabel}>Last 7 days</span>
          <span class={styles.boxValue}>{d7.counted > 0 ? `${d7.met} of ${d7.counted}` : '–'}</span>
          <span class={styles.boxSub}>days met</span>
        </div>
        <div class={styles.box}>
          <span class={styles.boxLabel}>Last 28 days</span>
          <span class={styles.boxValue}>{d28.counted > 0 ? `${d28.met} of ${d28.counted}` : '–'}</span>
          <span class={styles.boxSub}>days met · {28 - d28.counted} not counted</span>
        </div>
      </div>

      <div class={styles.chartBlock}>
        <h2 class={styles.chartTitle}>Last 28 days</h2>
        <div class={styles.calendar}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} class={styles.weekday}>{d}</span>)}
          {cells.map(({ date, kind }) => (
            <span key={date} class={`${styles.cell} ${CELL_CLASS[kind]}`} aria-label={`${date}: ${CELL_LABEL[kind]}`}>
              {parseDate(date).getDate()}
            </span>
          ))}
        </div>
        <div class={styles.legend}>
          <span class={styles.legendItem}><span class={`${styles.swatch} ${styles.cellMet}`} />Met</span>
          <span class={styles.legendItem}><span class={`${styles.swatch} ${styles.cellMissed}`} />Not met</span>
          <span class={styles.legendItem}><span class={`${styles.swatch} ${styles.cellNone}`} />Not counted</span>
          <span class={styles.legendItem}><span class={`${styles.swatch} ${styles.cellToday}`} />Today</span>
        </div>
        <p class={styles.rule}>{COUNT_RULE}</p>
      </div>

      <div class={styles.chartBlock}>
        <h2 class={styles.chartTitle}>Days met per week</h2>
        {perWeek.filter((n) => n !== undefined).length < 2 ? (
          <p class={styles.rule}>{tooFewWeeks(perWeek.filter((n) => n !== undefined).length)}</p>
        ) : (
        <>
        <div class={styles.chart} role="img" aria-label={`Days met per week, last ${weeks.length} weeks`}>
          <div class={styles.sevenLine} style={{ bottom: `${(7 / 8) * 100}%` }}>
            <span>7 days</span>
          </div>
          {perWeek.map((n, i) => (
            <div key={i} class={styles.column}>
              {n !== undefined && <div class={`${styles.bar} ${styles.barDaily}`} style={{ height: `${(n / 8) * 100}%` }} />}
            </div>
          ))}
        </div>
        <MonthLabels weeks={weeks} />
        </>
        )}
      </div>
    </>
  )
}

const CELL_CLASS: Record<DayMark | 'outside' | 'today' | 'future', string> = {
  met: styles.cellMet,
  missed: styles.cellMissed,
  none: styles.cellNone,
  today: styles.cellToday,
  outside: styles.cellOutside,
  future: styles.cellOutside,
}

const CELL_LABEL: Record<DayMark | 'outside' | 'today' | 'future', string> = {
  met: 'met',
  missed: 'not met',
  none: 'not counted',
  today: 'today, counts after it ends',
  outside: 'outside the 28 days',
  future: 'future',
}
