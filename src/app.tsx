import { useEffect, useState } from 'preact/hooks'
import Router, { Route } from 'preact-router'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { SettingsPage } from './pages/SettingsPage'
import { AddIntakePage } from './pages/AddIntakePage'
import { AddBurnPage } from './pages/AddBurnPage'
import { MealPlanner } from './pages/MealPlanner'
import { RecipeCalculator } from './pages/RecipeCalculator'
import { AddWeightPage } from './pages/AddWeightPage'
import { MyFoodsPage } from './pages/MyFoodsPage'
import { UpdateScreen } from './components/UpdateScreen'
import { checkDataGate } from './services/nutrientMigration'
import styles from './app.module.css'

export function App() {
  // The update screen replaces the app, so the Dashboard never shows before it.
  const [gate, setGate] = useState<'checking' | 'update' | 'ready'>('checking')

  useEffect(() => { checkDataGate().then(setGate) }, [])

  if (gate === 'checking') return null
  if (gate === 'update') return <UpdateScreen onDone={() => setGate('ready')} />

  return (
    <>
      <main class={styles.page}>
        <Router>
          <Route path="/" component={Dashboard} />
          <Route path="/history" component={History} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/my-foods" component={MyFoodsPage} />
          <Route path="/add-intake/:date" component={AddIntakePage} />
          <Route path="/add-burn/:date" component={AddBurnPage} />
          <Route path="/planner/:date" component={MealPlanner} />
          <Route path="/recipe-calculator" component={RecipeCalculator} />
          <Route path="/add-weight/:date" component={AddWeightPage} />
        </Router>
      </main>
      <BottomNav />
    </>
  )
}
