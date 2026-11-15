import { normalizeBarcode } from '../utils/barcode'
import type { BarcodeCacheEntry } from './index'

/** A row (saved food, entry) with its barcode in the stored form. Rows with no barcode are kept as they are. */
export function withNormalizedBarcode<T extends { barcode?: string }>(row: T): T {
  return typeof row.barcode === 'string' && row.barcode ? { ...row, barcode: normalizeBarcode(row.barcode) } : row
}

/**
 * Cache rows keyed by the stored form. Two old keys (12 and 13 digits) can become one key: then
 * the row with the higher version wins, and on a tie the newer one.
 */
export function mergeBarcodeCacheRows(rows: BarcodeCacheEntry[]): BarcodeCacheEntry[] {
  const byKey = new Map<string, BarcodeCacheEntry>()
  for (const row of rows) {
    const next = { ...row, barcode: normalizeBarcode(row.barcode) }
    const prev = byKey.get(next.barcode)
    if (!prev || isNewer(next, prev)) byKey.set(next.barcode, next)
  }
  return [...byKey.values()]
}

function isNewer(a: BarcodeCacheEntry, b: BarcodeCacheEntry): boolean {
  const va = a.version ?? 1
  const vb = b.version ?? 1
  return va !== vb ? va > vb : a.cachedAt > b.cachedAt
}
