// Interpolate between two hex colors. t=0 returns c1, t=1 returns c2.
function lerpColor(c1: string, c2: string, t: number): string {
  const p = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  const [r1, g1, b1] = p(c1)
  const [r2, g2, b2] = p(c2)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

const GREY = '#6b7280'
const GREEN = '#10b981'
const YELLOW = '#f59e0b'
const RED = '#ef4444'

export function barColor(ratio: number): string {
  if (ratio <= 0.5) return GREY
  if (ratio <= 0.95) return lerpColor(GREY, GREEN, (ratio - 0.5) / 0.45)
  if (ratio <= 1.05) return GREEN
  if (ratio <= 1.1) return lerpColor(GREEN, YELLOW, (ratio - 1.05) / 0.05)
  if (ratio <= 1.2) return lerpColor(YELLOW, RED, (ratio - 1.1) / 0.1)
  return RED
}
