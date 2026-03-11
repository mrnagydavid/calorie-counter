import type { IntakeEntry, BurnEntry } from '../db/index'
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

export function EntryList({ intakes, burns }: EntryListProps) {
  const merged: MergedEntry[] = [
    ...intakes.map((e) => ({ type: 'intake' as const, data: e })),
    ...burns.map((e) => ({ type: 'burn' as const, data: e })),
  ].sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt))

  if (merged.length === 0) {
    return <div class={styles.empty}>No entries yet. Tap + to add one.</div>
  }

  return (
    <div>
      <div class={styles.sectionTitle}>Entries</div>
      <div class={styles.list}>
        {merged.map((entry) => (
          <div class={styles.entry} key={entry.data.id}>
            <div class={styles.info}>
              <div class={styles.name}>{entry.data.name}</div>
              <div class={styles.time}>{formatTime(entry.data.createdAt)}</div>
            </div>
            <div class={`${styles.calories} ${entry.type === 'burn' ? styles.burn : ''}`}>
              {entry.type === 'burn' ? '+' : ''}{entry.data.calories} kcal
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
