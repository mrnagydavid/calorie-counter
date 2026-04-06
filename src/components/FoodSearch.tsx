import { useState, useEffect, useRef } from 'preact/hooks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index'
import styles from './FoodSearch.module.css'

interface FoodItem {
  id: number
  name: string
  cat: string
  kcal: number
  portions?: { desc: string; g: number }[]
}

export interface FoodSearchResult {
  name: string
  cat: string
  kcal: number
  portions?: { desc: string; g: number }[]
}

interface FoodSearchProps {
  onSelect: (result: FoodSearchResult, query: string) => void
  onClose: () => void
  onShowMyFoods?: (query: string) => void
  initialQuery?: string
}

let _foodsCache: FoodItem[] | null = null

async function loadFoods(): Promise<FoodItem[]> {
  if (_foodsCache) return _foodsCache
  const res = await fetch('/usda-foods.json')
  _foodsCache = await res.json()
  return _foodsCache!
}

/**
 * Score a single query word against a food name.
 * Tier 0: first comma-segment matches exactly (e.g. "egg" → "Egg, whole, raw")
 * Tier 1: first word of first segment matches (e.g. "milk" → "Milk shakes")
 * Tier 2: first segment starts with word (e.g. "egg" → "Eggnog")
 * Tier 3: a later word in the name starts with query word
 * Tier 4: name contains query word as substring
 * Returns -1 if no match.
 */
function scoreWord(lower: string, firstSegment: string, firstWord: string, nameWords: string[], qw: string): number {
  const qwPlural = qw.endsWith('s') ? qw.slice(0, -1) : qw + 's'
  if (firstSegment === qw || firstSegment === qwPlural) return 0
  if (firstWord === qw || firstWord === qwPlural) return 1
  if (firstSegment.startsWith(qw)) return 2
  if (nameWords.some(w => w.startsWith(qw) || w === qwPlural)) return 3
  if (lower.includes(qw)) return 4
  return -1
}

/**
 * Score a food name against a query. The query is split into words; every word
 * must match somewhere in the name. The score is the sum of per-word tiers,
 * so word order doesn't matter and items where ALL words match well rank highest.
 *
 * "raw egg" and "egg raw" produce identical scores.
 * "Egg, whole, raw" scores 0+3=3, "Eggplant, raw" scores 2+3=5 → Egg wins.
 */
function scoreMatch(name: string, query: string): number {
  const lower = name.toLowerCase()
  const firstSegment = lower.split(',')[0].trim()
  const firstWord = firstSegment.split(/\s+/)[0]
  const nameWords = lower.split(/[\s,]+/)

  const queryWords = query.split(/\s+/).filter(Boolean)
  let tierSum = 0

  for (const qw of queryWords) {
    const tier = scoreWord(lower, firstSegment, firstWord, nameWords, qw)
    if (tier < 0) return -1
    tierSum += tier
  }

  const isBasic = /\braw\b|\bfresh\b|\bfluid\b/.test(lower) ? 0 : 1
  return tierSum * 10000 + isBasic * 1000 + Math.min(name.length, 200)
}

export function FoodSearch({ onSelect, onClose, onShowMyFoods, initialQuery = '' }: FoodSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [foods, setFoods] = useState<FoodItem[] | null>(null)
  const [results, setResults] = useState<FoodItem[]>([])
  const [googleOpened, setGoogleOpened] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const allCustomFoods = useLiveQuery(() => db.customFoods.toArray())
  const customFoodMatches = allCustomFoods && query.length >= 2
    ? allCustomFoods.filter((f) => {
        const lower = f.name.toLowerCase()
        const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
        return words.every((w) => lower.includes(w))
      }).length
    : 0

  useEffect(() => { loadFoods().then(setFoods) }, [])
  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!foods || query.length < 2) {
      setResults([])
      return
    }

    const q = query.toLowerCase().trim()
    const scored: { food: FoodItem; score: number }[] = []

    for (const food of foods) {
      const score = scoreMatch(food.name, q)
      if (score >= 0) scored.push({ food, score })
    }

    scored.sort((a, b) => a.score - b.score)
    setResults(scored.slice(0, 50).map(s => s.food))
  }, [query, foods])

  return (
    <div class={styles.overlay}>
      <div class={styles.container}>
        <div class={styles.header}>
          <button class={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            class={styles.searchInput}
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Search foods..."
          />
        </div>

        <div class={styles.hint}>
          Data from USDA FoodData Central, a scientific database — some names may look unusual.
        </div>

        {query.trim().length >= 2 && (
          <div class={styles.googleRow}>
            <button
              class={styles.googleButton}
              onClick={() => {
                window.open(
                  `https://www.google.com/search?q=calories+in+${encodeURIComponent(query.trim())}+per+100g`,
                  '_blank',
                )
                setGoogleOpened(true)
              }}
            >
              🔍 Search on Google
            </button>
            {googleOpened && (
              <button class={styles.backButton} onClick={onClose}>
                ← Back to Add intake
              </button>
            )}
          </div>
        )}

        {customFoodMatches > 0 && onShowMyFoods && (
          <div class={styles.myFoodsHint}>
            {customFoodMatches} match{customFoodMatches > 1 ? 'es' : ''} in your saved foods{' '}
            <button class={styles.myFoodsLink} onClick={() => onShowMyFoods(query.trim())}>
              Show
            </button>
          </div>
        )}

        {!foods && <div class={styles.loading}>Loading food database...</div>}

        <div class={styles.resultList}>
          {foods && query.length >= 2 && results.length === 0 && (
            <div class={styles.noResults}>No foods found</div>
          )}
          {results.map((food) => (
            <button
              key={food.id}
              class={styles.resultItem}
              onClick={() => onSelect({ name: food.name, cat: food.cat, kcal: food.kcal, portions: food.portions }, query)}
            >
              <div class={styles.resultName}>{food.name}</div>
              <div class={styles.resultMeta}>
                <span>{food.kcal} kcal/100g</span>
                <span class={styles.resultCat}>{food.cat}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
