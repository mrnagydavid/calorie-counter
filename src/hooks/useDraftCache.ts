import { useState, useRef, useCallback } from 'preact/hooks'

type State = 'prompting' | 'syncing' | 'idle'

interface DraftCacheResult<T> {
  pending: T | null
  restore: () => T
  discard: () => void
  save: (data: T) => void
  clear: () => void
}

export function useDraftCache<T>(
  key: string,
  isEmpty: (data: T) => boolean,
): DraftCacheResult<T> {
  const storageKey = `draft:${key}`
  const stateRef = useRef<State>('idle')
  const [pending, setPending] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as T
        if (!isEmpty(parsed)) {
          stateRef.current = 'prompting'
          return parsed
        }
      }
    } catch { /* ignore corrupt data */ }
    return null
  })

  const restore = useCallback((): T => {
    stateRef.current = 'syncing'
    const data = pending!
    setPending(null)
    return data
  }, [pending])

  const discard = useCallback(() => {
    stateRef.current = 'idle'
    localStorage.removeItem(storageKey)
    setPending(null)
  }, [storageKey])

  const save = useCallback((data: T) => {
    if (isEmpty(data)) {
      // Don't clear a pending draft on mount with initial empty state
      if (stateRef.current !== 'prompting') {
        localStorage.removeItem(storageKey)
      }
      return
    }

    if (stateRef.current === 'prompting') {
      // User started editing without restoring — replace old draft
      stateRef.current = 'syncing'
      setPending(null)
    }

    if (stateRef.current === 'idle') {
      stateRef.current = 'syncing'
    }

    localStorage.setItem(storageKey, JSON.stringify(data))
  }, [storageKey, isEmpty])

  const clear = useCallback(() => {
    stateRef.current = 'idle'
    localStorage.removeItem(storageKey)
    setPending(null)
  }, [storageKey])

  return { pending, restore, discard, save, clear }
}
