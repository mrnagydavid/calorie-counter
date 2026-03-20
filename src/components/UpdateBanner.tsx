import { useEffect, useState } from 'preact/hooks'
import styles from './UpdateBanner.module.css'

export function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    // When a new service worker takes control, show the reload banner
    const onControllerChange = () => setUpdateReady(true)
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
  }, [])

  if (!updateReady) return null

  return (
    <div class={styles.banner}>
      <span class={styles.text}>A new version is available</span>
      <button class={styles.reloadButton} onClick={() => window.location.reload()}>
        Refresh
      </button>
    </div>
  )
}
