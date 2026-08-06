import { useEffect, useState } from 'preact/hooks'
import { todayString } from '../db/dates'

/**
 * The current local day as YYYY-MM-DD, kept fresh while the app stays open.
 *
 * An installed PWA is almost never reloaded — it is backgrounded and foregrounded for days.
 * Without this, every screen keeps the day it mounted with, so "Today" quietly shows yesterday
 * and any window derived from today (the 7/30-day averages) stays shifted by a day.
 *
 * The day is re-read at the next local midnight, and again whenever the app returns to the
 * foreground, because a background timer is throttled and does not fire on time.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayString)

  useEffect(() => {
    let timer = 0

    // Re-reads the real clock, so it self-corrects when a throttled or slept-through timer
    // fires late. Returning the same string keeps this from causing a render.
    function check() {
      setToday((prev) => {
        const now = todayString()
        return now === prev ? prev : now
      })
      schedule()
    }

    function schedule() {
      clearTimeout(timer)
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      // A second past midnight, to stay clear of the boundary itself
      timer = window.setTimeout(check, midnight.getTime() - now.getTime() + 1000)
    }

    function checkIfVisible() {
      if (document.visibilityState === 'visible') check()
    }

    schedule()
    document.addEventListener('visibilitychange', checkIfVisible)
    window.addEventListener('pageshow', checkIfVisible) // iOS PWA back-forward-cache restore

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', checkIfVisible)
      window.removeEventListener('pageshow', checkIfVisible)
    }
  }, [])

  return today
}
