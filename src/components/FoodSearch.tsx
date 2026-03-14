import { useState, useEffect, useRef } from 'preact/hooks'
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
  onSelect: (result: FoodSearchResult) => void
  onClose: () => void
}

let _foodsCache: FoodItem[] | null = null

async function loadFoods(): Promise<FoodItem[]> {
  if (_foodsCache) return _foodsCache
  const res = await fetch('/usda-foods.json')
  _foodsCache = await res.json()
  return _foodsCache!
}

function scoreMatch(name: string, query: string): number {
  const lower = name.toLowerCase()
  const firstSegment = lower.split(',')[0].trim()
  const firstWord = firstSegment.split(/\s+/)[0]

  // Basic plural: "apple" also matches "apples" and vice versa
  const queryPlural = query.endsWith('s') ? query.slice(0, -1) : query + 's'
  const firstSegmentMatches = firstSegment === query || firstSegment === queryPlural
  const firstWordMatches = firstWord === query || firstWord === queryPlural

  // Tier 0: first comma-segment is exactly the query (e.g. "egg" → "Egg, whole, raw")
  // Tier 1: first word of segment matches (e.g. "milk" → "Milk shakes")
  // Tier 2: first segment starts with query (e.g. "egg" → "Eggnog")
  // Tier 3: a later word starts with query
  // Tier 4: name contains query as substring
  // Tier 5: multi-word query, all words appear
  let tier: number
  if (firstSegmentMatches) {
    tier = 0
  } else if (firstWordMatches) {
    tier = 1
  } else if (firstSegment.startsWith(query)) {
    tier = 2
  } else {
    const words = lower.split(/[\s,]+/)
    const wordStartIdx = words.findIndex(w => w.startsWith(query))
    if (wordStartIdx >= 0) {
      tier = 3
    } else {
      const idx = lower.indexOf(query)
      if (idx >= 0) {
        tier = 4
      } else {
        const queryWords = query.split(/\s+/)
        if (queryWords.length > 1 && queryWords.every(qw => lower.includes(qw))) {
          tier = 5
        } else {
          return -1
        }
      }
    }
  }

  // Within each tier, prefer basic/raw foods and shorter (simpler) names
  const isBasic = /\braw\b|\bfresh\b|\bfluid\b/.test(lower) ? 0 : 1
  return tier * 10000 + isBasic * 1000 + Math.min(name.length, 200)
}

export function FoodSearch({ onSelect, onClose }: FoodSearchProps) {
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<FoodItem[] | null>(null)
  const [results, setResults] = useState<FoodItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

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

        {!foods && <div class={styles.loading}>Loading food database...</div>}

        <div class={styles.resultList}>
          {foods && query.length >= 2 && results.length === 0 && (
            <div class={styles.noResults}>No foods found</div>
          )}
          {results.map((food) => (
            <button
              key={food.id}
              class={styles.resultItem}
              onClick={() => onSelect({ name: food.name, cat: food.cat, kcal: food.kcal, portions: food.portions })}
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
