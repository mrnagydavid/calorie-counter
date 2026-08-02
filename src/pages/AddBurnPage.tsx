import { useState, useMemo, useCallback, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ActivityKind, type BurnActivity, type Sex } from '../db/index'
import { getOrCreateSettings, updateSettings, ageFromBirthYear, birthYearFromAge } from '../db/settings'
import { shortDate, daysAgo } from '../db/dates'
import {
  calcNetKcal,
  activityName,
  accuracyNote,
  type ActivityInputs,
} from '../services/activityEnergy'
import { NumericInput } from '../components/NumericInput'
import styles from './AddBurnPage.module.css'

interface AddBurnPageProps {
  date?: string
}

type Mode = 'manual' | ActivityKind

const MODES: { key: Mode; icon: string; label: string }[] = [
  { key: 'manual', icon: '✏️', label: 'Manual' },
  { key: 'walk', icon: '🚶', label: 'Walk' },
  { key: 'run', icon: '🏃', label: 'Run' },
  { key: 'bike', icon: '🚴', label: 'Bike' },
]

/** A weigh-in older than this is still used, but flagged. */
const STALE_WEIGH_IN_DAYS = 30

interface RecentBurn {
  name: string
  calories: number
  activity?: BurnActivity
}

export function AddBurnPage({ date = '' }: AddBurnPageProps) {
  const [mode, setMode] = useState<Mode>('manual')

  // Manual
  const [calories, setCalories] = useState('')

  // Name is auto-filled from the activity until the user types over it
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  // Activity inputs
  const [distance, setDistance] = useState('')
  const [weight, setWeight] = useState('')
  const [weightTouched, setWeightTouched] = useState(false)
  const [duration, setDuration] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [age, setAge] = useState('')
  const [ageTouched, setAgeTouched] = useState(false)
  const [sex, setSex] = useState<Sex>('male')
  const [sexTouched, setSexTouched] = useState(false)

  const allBurns = useLiveQuery(() =>
    db.burnEntries.orderBy('createdAt').reverse().toArray(),
  )
  const settings = useLiveQuery(() => getOrCreateSettings())
  const latestWeighIn = useLiveQuery(() =>
    db.weightEntries.orderBy('date').reverse().first(),
  )

  // --- prefill: weight from the newest weigh-in, falling back to the last one typed ---
  const weighInAge = latestWeighIn ? daysAgo(latestWeighIn.date) : null
  const prefillWeight = latestWeighIn?.weight ?? settings?.lastWeightKg ?? null

  const weightHint = useMemo(() => {
    if (latestWeighIn && weighInAge !== null && weighInAge <= STALE_WEIGH_IN_DAYS) {
      return { text: `From your weigh-in on ${shortDate(latestWeighIn.date)}`, warn: false }
    }
    if (latestWeighIn && weighInAge !== null) {
      return { text: `Your last weigh-in was ${weighInAge} days ago — check this`, warn: true }
    }
    return { text: 'No weigh-in yet. Log one and this fills itself.', warn: true }
  }, [latestWeighIn, weighInAge])

  useEffect(() => {
    if (weightTouched || prefillWeight == null) return
    setWeight(String(prefillWeight))
  }, [prefillWeight, weightTouched])

  // --- prefill: age and sex, remembered from the last ride ---
  useEffect(() => {
    if (!settings) return
    if (!ageTouched && settings.birthYear) setAge(String(ageFromBirthYear(settings.birthYear)))
    if (!sexTouched && settings.sex) setSex(settings.sex)
  }, [settings, ageTouched, sexTouched])

  // --- current inputs, shared by the live result and the submit handler ---
  const inputs = useMemo<ActivityInputs | null>(() => {
    if (mode === 'manual') return null
    return {
      kind: mode,
      weightKg: parseFloat(weight) || 0,
      distanceKm: parseFloat(distance) || 0,
      durationMin: parseInt(duration, 10) || 0,
      avgHr: parseInt(avgHr, 10) || 0,
      age: parseInt(age, 10) || 0,
      sex,
    }
  }, [mode, weight, distance, duration, avgHr, age, sex])

  const netKcal = inputs ? calcNetKcal(inputs) : null
  const autoName = inputs ? activityName(inputs) : ''
  const note = inputs ? accuracyNote(inputs) : null

  // Keep the name in step with the inputs until the user makes it their own
  useEffect(() => {
    if (!inputs || nameTouched) return
    setName(autoName)
  }, [inputs, autoName, nameTouched])

  // --- recents: replayed with today's weight, age and sex ---
  const recents = useMemo<RecentBurn[]>(() => {
    if (!allBurns) return []
    const seen = new Set<string>()
    const result: RecentBurn[] = []
    for (const entry of allBurns) {
      if (!entry.name || seen.has(entry.name)) continue
      seen.add(entry.name)

      let calories = entry.calories
      if (entry.activity && prefillWeight != null) {
        const replayed = calcNetKcal({
          ...entry.activity,
          weightKg: prefillWeight,
          age: settings?.birthYear ? ageFromBirthYear(settings.birthYear) : undefined,
          sex: settings?.sex,
        })
        if (replayed !== null) calories = replayed
      }

      result.push({ name: entry.name, calories, activity: entry.activity })
      if (result.length >= 10) break
    }
    return result
  }, [allBurns, prefillWeight, settings])

  const switchMode = useCallback((next: Mode) => {
    setMode(next)
    setNameTouched(false)
    if (next === 'manual') setName('')
  }, [])

  const handleRecentTap = useCallback((item: RecentBurn) => {
    const a = item.activity
    if (!a) {
      setMode('manual')
      setName(item.name)
      setNameTouched(true)
      setCalories(String(item.calories))
      return
    }

    setMode(a.kind)
    if (a.distanceKm != null) setDistance(String(a.distanceKm))
    if (a.durationMin != null) setDuration(String(a.durationMin))
    if (a.avgHr != null) setAvgHr(String(a.avgHr))

    // A stored name that is just the default keeps tracking the inputs;
    // one the user wrote themselves is preserved.
    setName(item.name)
    setNameTouched(item.name !== activityName(a))
  }, [])

  const manualCal = parseInt(calories, 10) || 0
  const canSubmit = mode === 'manual' ? manualCal > 0 : netKcal !== null && netKcal > 0

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    if (mode === 'manual') {
      await db.burnEntries.add({
        id: crypto.randomUUID(),
        date,
        name: name.trim() || `Burned ${manualCal} kcal`,
        calories: manualCal,
        createdAt: new Date().toISOString(),
      })
      route('/')
      return
    }

    if (!inputs || netKcal === null) return

    const activity: BurnActivity = { kind: inputs.kind, weightKg: inputs.weightKg }
    if (inputs.kind === 'bike') {
      activity.durationMin = inputs.durationMin
      activity.avgHr = inputs.avgHr
    } else {
      activity.distanceKm = inputs.distanceKm
    }

    await db.burnEntries.add({
      id: crypto.randomUUID(),
      date,
      name: name.trim() || autoName,
      calories: netKcal,
      createdAt: new Date().toISOString(),
      activity,
    })

    // Remember what was typed, so the next ride only needs a duration and a heart rate
    await updateSettings({
      lastWeightKg: inputs.weightKg,
      ...(inputs.kind === 'bike' && inputs.age
        ? { birthYear: birthYearFromAge(inputs.age), sex }
        : {}),
    })

    route('/')
  }, [canSubmit, mode, date, name, manualCal, inputs, netKcal, autoName, sex])

  const weightField = (
    <div class={styles.section}>
      <div class={styles.fieldLabel}>Your weight</div>
      <div class={styles.inputRow}>
        <NumericInput
          inputMode="decimal"
          class={styles.calorieInput}
          value={weight}
          onInput={(e) => {
            setWeightTouched(true)
            setWeight((e.target as HTMLInputElement).value)
          }}
          placeholder="0.0"
          min="0"
          step="0.1"
        />
        <span class={styles.unit}>kg</span>
      </div>
      <div class={`${styles.hint} ${weightHint.warn ? styles.hintWarn : ''}`}>
        {weightHint.text}
      </div>
    </div>
  )

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backButton} onClick={() => route('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class={styles.headerTitle}>Add Burned Calories</h1>
      </div>

      {recents.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Recent</div>
          <div class={styles.recentList}>
            {recents.map((item) => (
              <button
                key={item.name}
                class={styles.recentItem}
                onClick={() => handleRecentTap(item)}
              >
                <span class={styles.recentName}>{item.name}</span>
                <span class={styles.recentCal}>{item.calories} kcal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div class={styles.segmented}>
        {MODES.map((m) => (
          <button
            key={m.key}
            class={`${styles.segment} ${mode === m.key ? styles.segmentActive : ''}`}
            onClick={() => switchMode(m.key)}
          >
            <span class={styles.segmentIcon}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'manual' && (
        <div class={styles.section}>
          <div class={styles.fieldLabel}>Calories burned</div>
          <div class={styles.inputRow}>
            <NumericInput
              inputMode="numeric"
              class={styles.calorieInput}
              value={calories}
              onInput={(e) => setCalories((e.target as HTMLInputElement).value)}
              placeholder="0"
              min="0"
            />
            <span class={styles.unit}>kcal</span>
          </div>
        </div>
      )}

      {(mode === 'walk' || mode === 'run') && (
        <>
          <div class={styles.section}>
            <div class={styles.fieldLabel}>Distance</div>
            <div class={styles.inputRow}>
              <NumericInput
                inputMode="decimal"
                class={styles.calorieInput}
                value={distance}
                onInput={(e) => setDistance((e.target as HTMLInputElement).value)}
                placeholder="0.0"
                min="0"
                step="0.1"
              />
              <span class={styles.unit}>km</span>
            </div>
          </div>
          {weightField}
        </>
      )}

      {mode === 'bike' && (
        <>
          <div class={styles.section}>
            <div class={styles.fieldLabel}>Duration</div>
            <div class={styles.inputRow}>
              <NumericInput
                inputMode="numeric"
                class={styles.calorieInput}
                value={duration}
                onInput={(e) => setDuration((e.target as HTMLInputElement).value)}
                placeholder="0"
                min="0"
              />
              <span class={styles.unit}>min</span>
            </div>
          </div>

          <div class={styles.section}>
            <div class={styles.fieldLabel}>Avg heart rate</div>
            <div class={styles.inputRow}>
              <NumericInput
                inputMode="numeric"
                class={styles.calorieInput}
                value={avgHr}
                onInput={(e) => setAvgHr((e.target as HTMLInputElement).value)}
                placeholder="0"
                min="0"
              />
              <span class={styles.unit}>bpm</span>
            </div>
          </div>

          {weightField}

          <div class={styles.section}>
            <div class={styles.fieldLabel}>Age</div>
            <div class={styles.inputRow}>
              <NumericInput
                inputMode="numeric"
                class={styles.calorieInput}
                value={age}
                onInput={(e) => {
                  setAgeTouched(true)
                  setAge((e.target as HTMLInputElement).value)
                }}
                placeholder="0"
                min="0"
              />
              <span class={styles.unit}>years</span>
            </div>
          </div>

          <div class={styles.section}>
            <div class={styles.fieldLabel}>Sex</div>
            <div class={styles.toggle}>
              <button
                class={`${styles.toggleOption} ${sex === 'male' ? styles.toggleActive : ''}`}
                onClick={() => { setSexTouched(true); setSex('male') }}
              >
                Male
              </button>
              <button
                class={`${styles.toggleOption} ${sex === 'female' ? styles.toggleActive : ''}`}
                onClick={() => { setSexTouched(true); setSex('female') }}
              >
                Female
              </button>
            </div>
          </div>
        </>
      )}

      <div class={styles.section}>
        <div class={styles.fieldLabel}>{mode === 'manual' ? 'Name (optional)' : 'Name'}</div>
        <input
          type="text"
          class={styles.textInput}
          value={name}
          onInput={(e) => {
            setNameTouched(true)
            setName((e.target as HTMLInputElement).value)
          }}
          placeholder={mode === 'manual' ? 'e.g. Padel' : 'e.g. Morning loop'}
        />
      </div>

      {mode !== 'manual' && (
        <div class={styles.result}>
          <div class={styles.resultLabel}>Burned</div>
          <div class={`${styles.resultValue} ${netKcal === null ? styles.resultEmpty : ''}`}>
            {netKcal ?? 0}
            <span class={styles.resultUnit}>kcal</span>
          </div>
          <div class={`${styles.resultNote} ${note?.warn ? styles.hintWarn : ''}`}>
            {netKcal === null ? 'Fill in the fields above to see an estimate.' : note?.text}
          </div>
        </div>
      )}

      <button class={styles.submitButton} disabled={!canSubmit} onClick={handleSubmit}>
        Add Entry
      </button>
    </div>
  )
}
