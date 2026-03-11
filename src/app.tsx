import Router, { Route } from 'preact-router'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { SettingsPage } from './pages/SettingsPage'
import { AddIntakePage } from './pages/AddIntakePage'
import { AddBurnPage } from './pages/AddBurnPage'
import styles from './app.module.css'

export function App() {
  return (
    <>
      <main class={styles.page}>
        <Router>
          <Route path="/" component={Dashboard} />
          <Route path="/history" component={History} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/add-intake/:date" component={AddIntakePage} />
          <Route path="/add-burn/:date" component={AddBurnPage} />
        </Router>
      </main>
      <BottomNav />
    </>
  )
}
