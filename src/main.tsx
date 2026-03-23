import { render } from 'preact'
import { App } from './app'
import './styles/global.css'
// Request persistent storage so the browser won't evict IndexedDB data
navigator.storage?.persist?.()

render(<App />, document.getElementById('app')!)
