import { useState, useCallback } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type IntakeEntry, type BurnEntry, type WeightEntry } from '../db/index'
import { getOrCreateSettings } from '../db/settings'
import { refreshTodayWeight } from '../db/dailyTargets'
import { calcNetKcal, activityName, toActivity } from '../services/activityEnergy'
import { NumericInput } from './NumericInput'
import { EntryEditor } from './EntryEditor'
import styles from './EntryList.module.css'

interface EntryListProps {
  intakes: IntakeEntry[]
  burns: BurnEntry[]
  weightEntry?: WeightEntry | null
}

type MergedEntry =
  | { type: 'intake'; data: IntakeEntry }
  | { type: 'burn'; data: BurnEntry }

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const WEIGHT_ID = '__weight__'

export function EntryList({ intakes, burns, weightEntry }: EntryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Burn edit
  const [editCalories, setEditCalories] = useState('')
  // Calculated burn edit: the activity's own inputs, recomputed on save
  const [editDistance, setEditDistance] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editAscent, setEditAscent] = useState('')
  const [editHr, setEditHr] = useState('')
  // Weight edit
  const [editWeight, setEditWeight] = useState('')

  const settings = useLiveQuery(() => getOrCreateSettings())

  /** Inputs for a calculated burn, using the edit fields and the entry's own weight. */
  const editedActivityInputs = (entry: BurnEntry) => {
    const a = entry.activity!
    return {
      kind: a.kind,
      weightKg: a.weightKg,
      distanceKm: parseFloat(editDistance) || 0,
      durationMin: parseInt(editDuration, 10) || 0,
      ascentM: parseInt(editAscent, 10) || 0,
      avgHr: parseInt(editHr, 10) || 0,
      maxHr: settings?.maxHr,
    }
  }

  const handleWeightDelete = useCallback(async () => {
    if (!weightEntry) return
    await db.weightEntries.delete(weightEntry.id)
    await refreshTodayWeight(weightEntry.date)
    setExpandedId(null)
    setEditingId(null)
  }, [weightEntry])

  const handleWeightSave = useCallback(async () => {
    if (!weightEntry) return
    const w = parseFloat(editWeight)
    if (!w || w <= 0) return
    await db.weightEntries.update(weightEntry.id, { weight: w })
    await refreshTodayWeight(weightEntry.date)
    setEditingId(null)
    setExpandedId(null)
  }, [weightEntry, editWeight])

  const merged: MergedEntry[] = [
    ...intakes.map((e) => ({ type: 'intake' as const, data: e })),
    ...burns.map((e) => ({ type: 'burn' as const, data: e })),
  ].sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt))

  const handleTap = (id: string) => {
    if (editingId) return
    setExpandedId(expandedId === id ? null : id)
  }

  const handleDelete = async (entry: MergedEntry) => {
    if (entry.type === 'intake') {
      await db.intakeEntries.delete(entry.data.id)
    } else {
      await db.burnEntries.delete(entry.data.id)
    }
    setExpandedId(null)
  }

  const startEdit = (entry: MergedEntry) => {
    setEditingId(entry.data.id)
    // An intake opens a full-screen editor with its own state
    if (entry.type === 'intake') return
    if (entry.data.activity) {
      const a = entry.data.activity
      setEditDistance(a.distanceKm != null ? String(a.distanceKm) : '')
      setEditDuration(a.durationMin != null ? String(a.durationMin) : '')
      setEditAscent(a.ascentM != null ? String(a.ascentM) : '')
      setEditHr(a.avgHr != null ? String(a.avgHr) : '')
    } else {
      setEditCalories(String(entry.data.calories))
    }
  }

  const saveEdit = async (entry: MergedEntry) => {
    if (entry.type === 'intake') return // saved by the intake editor
    if (entry.data.activity) {
      const burn = entry.data
      const a = burn.activity!
      const inputs = editedActivityInputs(burn)
      const calories = calcNetKcal(inputs)
      if (calories !== null && calories > 0) {
        // Rebuilt rather than merged, so clearing an optional field really drops it
        const activity = toActivity(inputs)
        // Keep a name the user wrote themselves; refresh a generated one
        const wasGenerated = burn.name === activityName(a)
        await db.burnEntries.update(burn.id, {
          calories,
          activity,
          ...(wasGenerated ? { name: activityName(activity) } : {}),
        })
      }
    } else {
      const cal = parseInt(editCalories, 10)
      if (!isNaN(cal) && cal > 0) {
        await db.burnEntries.update(entry.data.id, { calories: cal })
      }
    }
    setEditingId(null)
    setExpandedId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const closeIntakeEditor = useCallback(() => {
    setEditingId(null)
    setExpandedId(null)
  }, [])

  if (merged.length === 0 && !weightEntry) {
    return <div class={styles.empty}>No entries yet. Tap + to add one.</div>
  }

  return (
    <div>
      <div class={styles.sectionTitle}>Entries</div>
      <div class={styles.list}>
        {weightEntry && (
          <div>
            <div class={styles.entry} onClick={() => handleTap(WEIGHT_ID)}>
              <div class={styles.info}>
                <div class={styles.name}>Weight</div>
              </div>
              <div class={styles.calories}>
                {weightEntry.weight} kg
              </div>
            </div>

            {expandedId === WEIGHT_ID && editingId !== WEIGHT_ID && (
              <div class={styles.actions}>
                <button class={styles.deleteButton} onClick={handleWeightDelete}>
                  Delete
                </button>
                <button class={styles.editButton} onClick={() => {
                  setEditWeight(String(weightEntry.weight))
                  setEditingId(WEIGHT_ID)
                }}>
                  Edit
                </button>
              </div>
            )}

            {editingId === WEIGHT_ID && (
              <div class={styles.editForm}>
                <div class={styles.editRow}>
                  <label class={styles.editLabel}>Weight</label>
                  <NumericInput
                    inputMode="decimal"
                    class={styles.editInput}
                    value={editWeight}
                    onInput={(e) => setEditWeight((e.target as HTMLInputElement).value)}
                    min="0"
                    step="0.1"
                  />
                  <span class={styles.editUnit}>kg</span>
                </div>
                <div class={styles.editActions}>
                  <button class={styles.cancelButton} onClick={cancelEdit}>Cancel</button>
                  <button class={styles.saveButton} onClick={handleWeightSave}>Save</button>
                </div>
              </div>
            )}
          </div>
        )}
        {merged.map((entry) => {
          const isExpanded = expandedId === entry.data.id
          const isEditing = editingId === entry.data.id

          return (
            <div key={entry.data.id}>
              <div class={styles.entry} onClick={() => handleTap(entry.data.id)}>
                <div class={styles.info}>
                  <div class={styles.name}>{entry.data.name}</div>
                  <div class={styles.time}>
                    {formatTime(entry.data.createdAt)}
                    {entry.type === 'burn' && entry.data.activity &&
                      entry.data.name !== activityName(entry.data.activity) && (
                        <span class={styles.meta}>{activityName(entry.data.activity)}</span>
                      )}
                  </div>
                </div>
                <div class={`${styles.calories} ${entry.type === 'burn' ? styles.burn : ''}`}>
                  {entry.type === 'burn' ? '+' : ''}{entry.data.calories} kcal
                </div>
              </div>

              {isExpanded && !isEditing && (
                <div class={styles.actions}>
                  <button class={styles.deleteButton} onClick={() => handleDelete(entry)}>
                    Delete
                  </button>
                  <button class={styles.editButton} onClick={() => startEdit(entry)}>
                    Edit
                  </button>
                </div>
              )}

              {isEditing && entry.type === 'intake' && (
                <EntryEditor entry={entry.data} onClose={closeIntakeEditor} />
              )}

              {isEditing && entry.type === 'burn' && entry.data.activity && (
                <div class={styles.editForm}>
                  {entry.data.activity.kind === 'bike' ? (
                    <>
                      <div class={styles.editRow}>
                        <label class={styles.editLabel}>Duration</label>
                        <NumericInput
                          class={styles.editInput}
                          value={editDuration}
                          onInput={(e) => setEditDuration((e.target as HTMLInputElement).value)}
                        />
                        <span class={styles.editUnit}>min</span>
                      </div>
                      <div class={styles.editRow}>
                        <label class={styles.editLabel}>Avg HR</label>
                        <NumericInput
                          class={styles.editInput}
                          value={editHr}
                          onInput={(e) => setEditHr((e.target as HTMLInputElement).value)}
                        />
                        <span class={styles.editUnit}>bpm</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div class={styles.editRow}>
                        <label class={styles.editLabel}>Distance</label>
                        <NumericInput
                          inputMode="decimal"
                          class={styles.editInput}
                          value={editDistance}
                          onInput={(e) => setEditDistance((e.target as HTMLInputElement).value)}
                          step="0.1"
                        />
                        <span class={styles.editUnit}>km</span>
                      </div>
                      {/* Both are optional, but they have to be editable here too:
                          correcting a distance while a stale duration sits in the
                          record would silently rewrite the pace behind the total. */}
                      <div class={styles.editRow}>
                        <label class={styles.editLabel}>Duration</label>
                        <NumericInput
                          class={styles.editInput}
                          value={editDuration}
                          onInput={(e) => setEditDuration((e.target as HTMLInputElement).value)}
                        />
                        <span class={styles.editUnit}>min</span>
                      </div>
                      <div class={styles.editRow}>
                        <label class={styles.editLabel}>Climb</label>
                        <NumericInput
                          class={styles.editInput}
                          value={editAscent}
                          onInput={(e) => setEditAscent((e.target as HTMLInputElement).value)}
                        />
                        <span class={styles.editUnit}>m</span>
                      </div>
                    </>
                  )}
                  <div class={styles.editTotal}>
                    Burned: {calcNetKcal(editedActivityInputs(entry.data)) ?? '—'} kcal
                  </div>
                  <div class={styles.editActions}>
                    <button class={styles.cancelButton} onClick={cancelEdit}>Cancel</button>
                    <button class={styles.saveButton} onClick={() => saveEdit(entry)}>Save</button>
                  </div>
                </div>
              )}

              {isEditing && entry.type === 'burn' && !entry.data.activity && (
                <div class={styles.editForm}>
                  <div class={styles.editRow}>
                    <label class={styles.editLabel}>Calories</label>
                    <NumericInput
                      class={styles.editInput}
                      value={editCalories}
                      onInput={(e) => setEditCalories((e.target as HTMLInputElement).value)}
                    />
                    <span class={styles.editUnit}>kcal</span>
                  </div>
                  <div class={styles.editActions}>
                    <button class={styles.cancelButton} onClick={cancelEdit}>Cancel</button>
                    <button class={styles.saveButton} onClick={() => saveEdit(entry)}>Save</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
