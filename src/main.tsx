import { render } from 'preact'
import { App } from './app'
import './styles/global.css'
// Request persistent storage so the browser won't evict IndexedDB data
navigator.storage?.persist?.()

// Blur inputs on Enter/Tab so the keyboard dismisses on mobile
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === 'Tab') && e.target instanceof HTMLInputElement && e.target.type === 'text') {
    e.preventDefault()
    e.target.blur()
  }
})

render(<App />, document.getElementById('app')!)
