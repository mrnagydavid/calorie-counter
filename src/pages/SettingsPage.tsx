import { useState, useEffect, useCallback } from 'preact/hooks'
import { NumericInput } from '../components/NumericInput'
import { getInstallPrompt, clearInstallPrompt } from '../components/InstallBanner'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DayOfWeek } from '../db/index'
import {
  getOrCreateSettings,
  updateSettings,
  cleanOverrides,
  DAYS,
  computeWeeklyAverage,
} from '../db/settings'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get('user-settings'))

  // Bootstrap settings on first visit
  useEffect(() => {
    getOrCreateSettings()
  }, [])

  if (!settings) return null

  return (
    <div class={styles.page}>
      <h1 class={styles.title}>Settings</h1>
      <CalorieTargetSection baseline={settings.baselineCalories} />
      <DayOverridesSection
        baseline={settings.baselineCalories}
        overrides={settings.dayOverrides}
      />
      <DataManagementSection />
      <InstallSection />
      <LegalSection />
      <p class={styles.version}>v{__COMMIT_HASH__}</p>
    </div>
  )
}

function CalorieTargetSection({ baseline }: { baseline: number }) {
  const [value, setValue] = useState(String(baseline))

  useEffect(() => {
    setValue(String(baseline))
  }, [baseline])

  const save = useCallback(() => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num > 0 && num !== baseline) {
      updateSettings({ baselineCalories: num })
    } else {
      setValue(String(baseline))
    }
  }, [value, baseline])

  return (
    <section class={styles.section}>
      <h2 class={styles.sectionTitle}>Daily Calorie Target</h2>
      <div class={styles.inputRow}>
        <NumericInput
          inputMode="numeric"
          class={styles.calorieInput}
          value={value}
          onInput={(e) => setValue((e.target as HTMLInputElement).value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          min="1"
        />
        <span class={styles.unit}>kcal</span>
      </div>
    </section>
  )
}

function DayOverridesSection({
  baseline,
  overrides,
}: {
  baseline: number
  overrides: Partial<Record<DayOfWeek, number>>
}) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null)
  const [editValue, setEditValue] = useState('')
  const cleaned = cleanOverrides(overrides, baseline)
  const hasOverrides = Object.keys(cleaned).length > 0

  useEffect(() => {
    if (selectedDay) {
      setEditValue(String(overrides[selectedDay] ?? baseline))
    }
  }, [selectedDay, overrides, baseline])

  const saveOverride = useCallback(() => {
    if (!selectedDay) return
    const num = parseInt(editValue, 10)
    if (isNaN(num) || num <= 0) {
      setEditValue(String(overrides[selectedDay] ?? baseline))
      return
    }
    const newOverrides = cleanOverrides({ ...overrides, [selectedDay]: num }, baseline)
    updateSettings({ dayOverrides: newOverrides })
  }, [selectedDay, editValue, overrides, baseline])

  const resetDay = useCallback(() => {
    if (!selectedDay) return
    setEditValue(String(baseline))
    const newOverrides = { ...overrides }
    delete newOverrides[selectedDay]
    updateSettings({ dayOverrides: cleanOverrides(newOverrides, baseline) })
  }, [selectedDay, overrides, baseline])

  const selectedDayLabel = selectedDay
    ? DAYS.find((d) => d.key === selectedDay)!.key.charAt(0).toUpperCase() +
      DAYS.find((d) => d.key === selectedDay)!.key.slice(1)
    : ''

  return (
    <section class={styles.section}>
      <h2 class={styles.sectionTitle}>Day-of-Week Overrides</h2>
      <div class={styles.dayRow}>
        {DAYS.map(({ key, label }) => {
          const isOverride = key in cleaned
          const isSelected = selectedDay === key
          const classes = [
            styles.dayButton,
            isOverride ? styles.hasOverride : '',
            isSelected ? styles.selected : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={key}
              class={classes}
              onClick={() => setSelectedDay(isSelected ? null : key)}
            >
              {label}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div class={styles.overrideEditor}>
          <span class={styles.overrideLabel}>{selectedDayLabel}</span>
          <NumericInput
            inputMode="numeric"
            class={styles.calorieInput}
            value={editValue}
            onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
            onBlur={saveOverride}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            min="1"
          />
          <span class={styles.unit}>kcal</span>
          <button class={styles.resetButton} onClick={resetDay}>
            Reset
          </button>
        </div>
      )}

      {hasOverrides && (
        <div class={styles.averageBox}>
          Daily average: <strong>{computeWeeklyAverage(baseline, cleaned)} kcal</strong>
        </div>
      )}
    </section>
  )
}

function DataManagementSection() {
  const settings = useLiveQuery(() => db.settings.get('user-settings'))
  const [dialog, setDialog] = useState<'import-confirm' | 'clear-confirm' | null>(null)
  const [importData, setImportData] = useState<string | null>(null)
  const reminderEnabled = settings?.exportReminderEnabled ?? true

  const handleExport = useCallback(async () => {
    const [settings, intakeEntries, burnEntries, customFoods] = await Promise.all([
      db.settings.toArray(),
      db.intakeEntries.toArray(),
      db.burnEntries.toArray(),
      db.customFoods.toArray(),
    ])
    const data = JSON.stringify(
      { settings, intakeEntries, burnEntries, customFoods },
      null,
      2,
    )
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calorie-counter-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImportFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        setImportData(reader.result as string)
        setDialog('import-confirm')
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])

  const confirmImport = useCallback(async () => {
    if (!importData) return
    try {
      const data = JSON.parse(importData)
      await db.transaction(
        'rw',
        db.settings,
        db.intakeEntries,
        db.burnEntries,
        db.customFoods,
        async () => {
          await db.settings.clear()
          await db.intakeEntries.clear()
          await db.burnEntries.clear()
          await db.customFoods.clear()
          if (data.settings?.length) await db.settings.bulkAdd(data.settings)
          if (data.intakeEntries?.length) await db.intakeEntries.bulkAdd(data.intakeEntries)
          if (data.burnEntries?.length) await db.burnEntries.bulkAdd(data.burnEntries)
          if (data.customFoods?.length) await db.customFoods.bulkAdd(data.customFoods)
        },
      )
    } catch {
      alert('Invalid backup file.')
    }
    setDialog(null)
    setImportData(null)
  }, [importData])

  const confirmClear = useCallback(async () => {
    await db.transaction(
      'rw',
      db.intakeEntries,
      db.burnEntries,
      db.customFoods,
      async () => {
        await db.intakeEntries.clear()
        await db.burnEntries.clear()
        await db.customFoods.clear()
      },
    )
    setDialog(null)
  }, [])

  return (
    <section class={styles.section}>
      <h2 class={styles.sectionTitle}>Data Management</h2>
      <div class={styles.checkboxRow}>
        <input
          type="checkbox"
          id="exportReminder"
          checked={reminderEnabled}
          onChange={(e) =>
            updateSettings({
              exportReminderEnabled: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <label for="exportReminder">Remind monthly to export my data</label>
      </div>
      <div class={styles.dataButtons}>
        <button class={styles.dataButton} onClick={handleExport}>
          Export Data (JSON)
        </button>
        <button class={styles.dataButton} onClick={handleImportFile}>
          Import Data (JSON)
        </button>
        <button
          class={`${styles.dataButton} ${styles.danger}`}
          onClick={() => setDialog('clear-confirm')}
        >
          Clear All Data
        </button>
      </div>

      {dialog === 'import-confirm' && (
        <div class={styles.overlay} onClick={() => setDialog(null)}>
          <div class={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3>Import Data</h3>
            <p>This will replace all existing data with the imported backup. Continue?</p>
            <div class={styles.dialogActions}>
              <button class={styles.dialogCancel} onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button class={styles.dialogConfirmSafe} onClick={confirmImport}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog === 'clear-confirm' && (
        <div class={styles.overlay} onClick={() => setDialog(null)}>
          <div class={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3>Clear All Data</h3>
            <p>
              This will delete all intake entries, burn entries, and custom foods. Settings
              will be kept. This cannot be undone.
            </p>
            <div class={styles.dialogActions}>
              <button class={styles.dialogCancel} onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button class={styles.dialogConfirm} onClick={confirmClear}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function LegalSection() {
  const [expanded, setExpanded] = useState<'terms' | 'privacy' | null>(null)

  return (
    <section class={styles.section}>
      <h2 class={styles.sectionTitle}>Legal</h2>
      <div class={styles.dataButtons}>
        <button
          class={styles.dataButton}
          onClick={() => setExpanded(expanded === 'terms' ? null : 'terms')}
        >
          Terms & Conditions
        </button>
        {expanded === 'terms' && (
          <div class={styles.legalText}>
            <p>
              This is a free calorie counting app. It counts calories. That's it.
            </p>
            <p>
              The calorie data comes from the USDA FoodData Central database and the
              Open Food Facts project. We do our best, but nutritional values are
              approximate. Do not use this app to make medical decisions. We are not
              dietitians, doctors, or lawyers — which is ironic given this section.
            </p>
            <p>
              The app is provided "as is" with no warranties. If your banana has
              more calories than we said, that's between you and the banana.
            </p>
          </div>
        )}
        <button
          class={styles.dataButton}
          onClick={() => setExpanded(expanded === 'privacy' ? null : 'privacy')}
        >
          Privacy Policy
        </button>
        {expanded === 'privacy' && (
          <div class={styles.legalText}>
            <p>
              The short version: we don't collect your data. At all. Truly.
            </p>
            <p>
              All your data (meals, settings, everything) is stored locally on your
              device in your browser's IndexedDB. It never leaves your phone. There
              is no account, no server, no analytics, no tracking pixels, no cookies
              (the irony — a food app with no cookies).
            </p>
            <p>
              When you scan a barcode, a request is made to Open Food Facts
              (openfoodfacts.org) to look up the product. They have their own privacy
              policy. When you search the food database, it's a local file — no network
              request at all.
            </p>
            <p>
              We genuinely wish more apps had this little to say in their privacy policy.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function InstallSection() {
  const [installed, setInstalled] = useState(false)

  const handleInstall = useCallback(async () => {
    const prompt = getInstallPrompt()
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      clearInstallPrompt()
      setInstalled(true)
    }
  }, [])

  const prompt = getInstallPrompt()
  if (!prompt && !installed) return null

  return (
    <section class={styles.section}>
      <h2 class={styles.sectionTitle}>App</h2>
      {installed ? (
        <p class={styles.installedText}>App installed!</p>
      ) : (
        <button class={styles.dataButton} onClick={handleInstall}>
          Install App
        </button>
      )}
    </section>
  )
}
