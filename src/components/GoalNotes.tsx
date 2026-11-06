import { useState } from 'preact/hooks'
import styles from './GoalNotes.module.css'

// One state for Today and the Meal planner: a user who knows the notes hides them once.
// Kept in localStorage, so it lasts to the next session.
const STORAGE_KEY = 'goal-notes-open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

interface GoalNotesProps {
  /** The explanation: shown until the user hides it. */
  notes: string[]
  /** A warning about the day's numbers. It always shows, because it changes from day to day. */
  warning?: string
}

/** The notes under goal bars, with a "Hide explanation" button under them. */
export function GoalNotes({ notes, warning }: GoalNotesProps) {
  const [open, setOpen] = useState(readOpen)

  if (notes.length === 0 && !warning) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // The state is a convenience. The notes still work without it.
    }
  }

  return (
    <div>
      {open &&
        notes.map((note) => (
          <p key={note} class={styles.note}>
            {note}
          </p>
        ))}
      {warning && <p class={styles.note}>{warning}</p>}
      {notes.length > 0 && (
        <button class={styles.toggle} onClick={toggle} aria-expanded={open}>
          {open ? 'Hide explanation' : 'Show explanation'}
        </button>
      )}
    </div>
  )
}
