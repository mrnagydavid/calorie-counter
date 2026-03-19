import type { Settings } from './index'

export function currentMonthString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function shouldShowExportReminder(settings: Settings): boolean {
  // Treat undefined as true (default ON for existing users without the field)
  const enabled = settings.exportReminderEnabled ?? true
  if (!enabled) return false

  // Only show on the 1st of the month
  if (new Date().getDate() !== 1) return false

  // If already dismissed for this month, don't show
  const dismissedUntil = settings.exportReminderDismissedUntil
  if (dismissedUntil && dismissedUntil >= currentMonthString()) return false

  return true
}
