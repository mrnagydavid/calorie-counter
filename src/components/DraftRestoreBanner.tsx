import styles from './DraftRestoreBanner.module.css'

interface DraftRestoreBannerProps {
  onRestore: () => void
  onDiscard: () => void
}

export function DraftRestoreBanner({ onRestore, onDiscard }: DraftRestoreBannerProps) {
  return (
    <div class={styles.banner}>
      <div class={styles.message}>
        You have an unfinished draft. Resume?
      </div>
      <div class={styles.actions}>
        <button class={styles.discardButton} onClick={onDiscard}>
          Discard
        </button>
        <button class={styles.restoreButton} onClick={onRestore}>
          Restore
        </button>
      </div>
    </div>
  )
}
