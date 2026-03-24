import { useMemo } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import styles from './WeightChart.module.css'

interface WeightChartProps {
  year: number
}

interface DataPoint {
  date: string
  weight: number
  dayOfYear: number // 0-365, for proportional X positioning
}

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const CHART_HEIGHT = 200
const CHART_PADDING_TOP = 24
const CHART_PADDING_BOTTOM = 30
const CHART_PADDING_LEFT = 44
const CHART_PADDING_RIGHT = 12
const DOT_RADIUS = 3.5

function dayOfYear(dateStr: string): number {
  const d = new Date(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10))
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - jan1.getTime()) / 86400000)
}

export function WeightChart({ year }: WeightChartProps) {
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const entries = useLiveQuery(
    () =>
      db.weightEntries
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray(),
    [startDate, endDate],
  )

  const dataPoints = useMemo<DataPoint[]>(() => {
    if (!entries || entries.length === 0) return []

    // Group by date, take latest entry per day
    const byDate = new Map<string, number>()
    const byDateTime = new Map<string, string>()
    for (const e of entries) {
      const existing = byDateTime.get(e.date)
      if (!existing || e.createdAt > existing) {
        byDate.set(e.date, e.weight)
        byDateTime.set(e.date, e.createdAt)
      }
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, weight]) => ({
        date,
        weight,
        dayOfYear: dayOfYear(date),
      }))
  }, [entries])

  if (!entries) return null

  if (dataPoints.length === 0) {
    return (
      <div class={styles.empty}>
        No weight entries this year
      </div>
    )
  }

  const weights = dataPoints.map((d) => d.weight)
  const minWeight = Math.min(...weights)
  const maxWeight = Math.max(...weights)

  const range = Math.max(maxWeight - minWeight, 1)
  const yMin = Math.floor((minWeight - range * 0.2) * 10) / 10
  const yMax = Math.ceil((maxWeight + range * 0.2) * 10) / 10
  const yRange = yMax - yMin

  const gridStep = yRange <= 2 ? 0.5 : yRange <= 5 ? 1 : 2
  const gridLines: number[] = []
  const firstGrid = Math.ceil(yMin / gridStep) * gridStep
  for (let v = firstGrid; v <= yMax; v += gridStep) {
    gridLines.push(Math.round(v * 10) / 10)
  }

  const plotWidth = 320 - CHART_PADDING_LEFT - CHART_PADDING_RIGHT
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const daysInYear = isLeapYear ? 366 : 365

  const toX = (doy: number) => {
    return CHART_PADDING_LEFT + (doy / (daysInYear - 1)) * plotWidth
  }
  const toY = (w: number) => {
    return CHART_PADDING_TOP + (1 - (w - yMin) / yRange) * plotHeight
  }

  const pathPoints = dataPoints.map((d) => `${toX(d.dayOfYear)},${toY(d.weight)}`).join(' ')

  // Month label positions (1st of each month)
  const monthPositions = MONTH_LABELS.map((label, i) => {
    const doy = dayOfYear(`${year}-${String(i + 1).padStart(2, '0')}-01`)
    return { label, x: toX(doy) }
  })

  return (
    <div class={styles.container}>
      <svg
        viewBox={`0 0 320 ${CHART_HEIGHT}`}
        class={styles.svg}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {gridLines.map((v) => {
          const y = toY(v)
          return (
            <g key={v}>
              <line
                x1={CHART_PADDING_LEFT}
                y1={y}
                x2={320 - CHART_PADDING_RIGHT}
                y2={y}
                stroke="var(--color-border)"
                stroke-width="1"
              />
              <text
                x={CHART_PADDING_LEFT - 6}
                y={y + 4}
                text-anchor="end"
                class={styles.axisLabel}
              >
                {v % 1 === 0 ? v : v.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Month labels on X axis */}
        {monthPositions.map((m) => (
          <text
            key={m.label}
            x={m.x}
            y={CHART_HEIGHT - 6}
            text-anchor="middle"
            class={styles.axisLabel}
          >
            {m.label}
          </text>
        ))}

        {/* Line */}
        {dataPoints.length > 1 && (
          <polyline
            points={pathPoints}
            fill="none"
            stroke="var(--color-primary)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        )}

        {/* Data points */}
        {dataPoints.map((d, i) => (
          <g key={d.date}>
            <circle
              cx={toX(d.dayOfYear)}
              cy={toY(d.weight)}
              r={DOT_RADIUS}
              fill="var(--color-primary)"
            />
            {/* Value label on first and last points */}
            {(dataPoints.length === 1 || i === 0 || i === dataPoints.length - 1) && (
              <text
                x={toX(d.dayOfYear)}
                y={toY(d.weight) - 10}
                text-anchor="middle"
                class={styles.valueLabel}
              >
                {d.weight % 1 === 0 ? d.weight : d.weight.toFixed(1)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
