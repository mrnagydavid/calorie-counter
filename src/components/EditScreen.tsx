import type { ComponentChildren } from 'preact'
import styles from './EditScreen.module.css'

interface EditScreenProps {
  title: string
  onClose: () => void
  children: ComponentChildren
}

/** Full-screen shell for an editor: back button, title and a scroll body. */
export function EditScreen({ title, onClose, children }: EditScreenProps) {
  return (
    <div class={styles.overlay}>
      <div class={styles.container}>
        <div class={styles.header}>
          <button class={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 class={styles.headerTitle}>{title}</h1>
        </div>
        <div class={styles.body}>{children}</div>
      </div>
    </div>
  )
}
