import { useState } from 'preact/hooks'
import { db, type IntakeEntry, type BurnEntry } from '../db/index'
import { NumericInput } from './NumericInput'
import styles from './EntryList.module.css'

interface EntryListProps {
  intakes: IntakeEntry[]
  burns: BurnEntry[]
}

type MergedEntry =
  | { type: 'intake'; data: IntakeEntry }
  | { type: 'burn'; data: BurnEntry }

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isWeightUnit(unit: string): boolean {
  return unit === '100g' || unit === '100ml'
}

export function EntryList({ intakes, burns }: EntryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Weight-based edit (100g/100ml): amount in g/ml
  const [editAmount, setEditAmount] = useState('')
  // Quantity-based edit (serving/piece/unknown): quantity as string for free input
  const [editQty, setEditQty] = useState('')
  // Burn edit
  const [editCalories, setEditCalories] = useState('')
  // Unit calories (editable for all intake types)
  const [editUnitCal, setEditUnitCal] = useState('')

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
    if (entry.type === 'intake') {
      const d = entry.data
      setEditUnitCal(String(d.unitCalories))
      if (isWeightUnit(d.unit)) {
        // Convert quantity back to grams/ml: quantity is amount/100
        setEditAmount(String(Math.round(d.quantity * 100)))
      } else {
        setEditQty(String(d.quantity))
      }
    } else {
      setEditCalories(String(entry.data.calories))
    }
  }

  const saveEdit = async (entry: MergedEntry) => {
    if (entry.type === 'intake') {
      const d = entry.data
      const unitCal = parseFloat(editUnitCal) || 0
      let quantity: number
      if (isWeightUnit(d.unit)) {
        quantity = (parseFloat(editAmount) || 0) / 100
      } else {
        quantity = parseFloat(editQty) || 0
      }
      const calories = Math.round(unitCal * quantity)
      await db.intakeEntries.update(d.id, { unitCalories: unitCal, quantity, calories })
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

  if (merged.length === 0) {
    return <div class={styles.empty}>No entries yet. Tap + to add one.</div>
  }

  const computeEditTotal = (entry: IntakeEntry): number => {
    const unitCal = parseFloat(editUnitCal) || 0
    if (isWeightUnit(entry.unit)) {
      return Math.round(unitCal * (parseFloat(editAmount) || 0) / 100)
    }
    return Math.round(unitCal * (parseFloat(editQty) || 0))
  }

  const unitSuffix = (unit: string): string => {
    if (unit === '100g') return 'g'
    if (unit === '100ml') return 'ml'
    return ''
  }

  return (
    <div>
      <div class={styles.sectionTitle}>Entries</div>
      <div class={styles.list}>
        {merged.map((entry) => {
          const isExpanded = expandedId === entry.data.id
          const isEditing = editingId === entry.data.id

          return (
            <div key={entry.data.id}>
              <div class={styles.entry} onClick={() => handleTap(entry.data.id)}>
                <div class={styles.info}>
                  <div class={styles.name}>{entry.data.name}</div>
                  <div class={styles.time}>{formatTime(entry.data.createdAt)}</div>
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

              {isEditing && entry.type === 'intake' && isWeightUnit(entry.data.unit) && (
                <div class={styles.editForm}>
                  <div class={styles.editRow}>
                    <label class={styles.editLabel}>Per {entry.data.unit}</label>
                    <NumericInput
                      class={styles.editInput}
                      value={editUnitCal}
                      onInput={(e) => setEditUnitCal((e.target as HTMLInputElement).value)}
                    />
                    <span class={styles.editUnit}>kcal</span>
                  </div>
                  <div class={styles.editRow}>
                    <label class={styles.editLabel}>Amount</label>
                    <NumericInput
                      class={styles.editInput}
                      value={editAmount}
                      onInput={(e) => setEditAmount((e.target as HTMLInputElement).value)}
                    />
                    <span class={styles.editUnit}>{unitSuffix(entry.data.unit)}</span>
                  </div>
                  <div class={styles.editTotal}>
                    Total: {computeEditTotal(entry.data)} kcal
                  </div>
                  <div class={styles.editActions}>
                    <button class={styles.cancelButton} onClick={cancelEdit}>Cancel</button>
                    <button class={styles.saveButton} onClick={() => saveEdit(entry)}>Save</button>
                  </div>
                </div>
              )}

              {isEditing && entry.type === 'intake' && !isWeightUnit(entry.data.unit) && (
                <div class={styles.editForm}>
                  <div class={styles.editRow}>
                    <label class={styles.editLabel}>Per unit</label>
                    <NumericInput
                      class={styles.editInput}
                      value={editUnitCal}
                      onInput={(e) => setEditUnitCal((e.target as HTMLInputElement).value)}
                    />
                    <span class={styles.editUnit}>kcal</span>
                  </div>
                  <div class={styles.editRow}>
                    <label class={styles.editLabel}>Qty</label>
                    <div class={styles.stepper}>
                      <button class={styles.stepperBtn} onClick={() => {
                        const v = Math.max(0.5, (parseFloat(editQty) || 1) - 0.5)
                        setEditQty(String(v))
                      }}>-</button>
                      <NumericInput
                        class={styles.stepperInput}
                        value={editQty}
                        onInput={(e) => setEditQty((e.target as HTMLInputElement).value)}
                      />
                      <button class={styles.stepperBtn} onClick={() => {
                        const v = (parseFloat(editQty) || 0) + 0.5
                        setEditQty(String(v))
                      }}>+</button>
                    </div>
                  </div>
                  <div class={styles.editTotal}>
                    Total: {computeEditTotal(entry.data)} kcal
                  </div>
                  <div class={styles.editActions}>
                    <button class={styles.cancelButton} onClick={cancelEdit}>Cancel</button>
                    <button class={styles.saveButton} onClick={() => saveEdit(entry)}>Save</button>
                  </div>
                </div>
              )}

              {isEditing && entry.type === 'burn' && (
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
