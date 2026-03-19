import { route } from 'preact-router'
import { currentMonthString, shouldShowExportReminder } from '../db/exportReminder'
import type { Settings } from '../db/index'
import { updateSettings } from '../db/settings'
import styles from './ExportReminderBanner.module.css'

interface ExportReminderBannerProps {
  settings: Settings
}

export function ExportReminderBanner({ settings }: ExportReminderBannerProps) {
  if (!shouldShowExportReminder(settings)) return null

  const dismiss = () => {
    updateSettings({ exportReminderDismissedUntil: currentMonthString() })
  }

  return (
    <div class={styles.banner}>
      <div class={styles.message}>
        It's a new month — back up your data so you don't lose it.
      </div>
      <div class={styles.actions}>
        <button class={styles.dismissButton} onClick={dismiss}>
          Dismiss
        </button>
        <button class={styles.exportButton} onClick={() => route('/settings')}>
          Go to Export
        </button>
      </div>
    </div>
  )
}
