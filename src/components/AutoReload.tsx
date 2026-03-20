import { useEffect } from 'preact/hooks'

export function AutoReload() {
  useEffect(() => {
    // When a new service worker takes control, reload immediately
    // to avoid mixed-version state (old JS + new SW serving new assets).
    const onControllerChange = () => window.location.reload()
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
  }, [])

  return null
}
