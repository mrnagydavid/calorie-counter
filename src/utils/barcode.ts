// GS1 barcode rules: the check digit, UPC-E expansion, and the one form the app stores.
// Scans, typed codes, saved foods and the lookup cache all use `normalizeBarcode`, so a code
// matches itself whichever decoder read it.

/** All digits, of a retail length. Gates the manual lookup, which has no format to check. */
export function isValidBarcode(s: string): boolean {
  const trimmed = s.trim()
  return /^\d+$/.test(trimmed) && [8, 12, 13, 14].includes(trimmed.length)
}

/** GS1 mod-10: the last digit equals the check digit of the digits before it. */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{2,}$/.test(code)) return false
  let sum = 0
  // From the right, after the check digit, the weights are 3, 1, 3, 1, ...
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += Number(code[i]) * weight
  }
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1])
}

/**
 * The 12-digit UPC-A of an 8-digit UPC-E (number system, 6 digits, check digit), or null when
 * the value is not UPC-E. The check digit belongs to the UPC-A, so check it after this.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const d = code.slice(1, 7)
  const last = d[5]
  let body: string
  if (last <= '2') body = d.slice(0, 2) + last + '0000' + d.slice(2, 5)
  else if (last === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5)
  else if (last === '4') body = d.slice(0, 4) + '00000' + d[4]
  else body = d.slice(0, 5) + '0000' + last
  return code[0] + body + code[7]
}

/**
 * The stored form. UPC-A (12 digits) gets a leading 0, and a GTIN-14 that starts with 0 loses
 * it, so both equal the EAN-13 that decoders also return for them. Other codes are kept.
 */
export function normalizeBarcode(code: string): string {
  const s = code.trim()
  if (!/^\d+$/.test(s)) return s
  if (s.length === 12) return '0' + s
  if (s.length === 14 && s[0] === '0') return s.slice(1)
  return s
}

/**
 * A decoded retail barcode in the stored form, or null when the read must be ignored: a format
 * that is not retail, a wrong length, or a wrong check digit. `format` uses BarcodeDetector names.
 */
export function readRetailBarcode(rawValue: string, format: string): string | null {
  const code = rawValue.trim()
  let gtin: string | null
  switch (format) {
    case 'ean_13':
    case 'upc_a':
      // Decoders differ: some give an EAN-13 that starts with 0 as a 12-digit UPC-A.
      gtin = /^\d{12,13}$/.test(code) ? code : null
      break
    case 'ean_8':
      gtin = /^\d{8}$/.test(code) ? code : null
      break
    case 'upc_e':
      gtin = expandUpcE(code)
      break
    default:
      gtin = null
  }
  return gtin && hasValidCheckDigit(gtin) ? normalizeBarcode(gtin) : null
}

export interface ReadVote {
  /** Records one frame (null: no code in it). Returns the code once it has enough votes. */
  add(code: string | null): string | null
  /** How many frames in the window read this code. */
  count(code: string): number
  clear(): void
}

/**
 * Accepts a code only when `needed` of the last `window` frames read it. A blurred frame can
 * give wrong digits that still pass the check digit, but rarely the same wrong digits twice.
 */
export function createReadVote(window: number, needed: number): ReadVote {
  let recent: (string | null)[] = []
  const count = (code: string) => recent.filter((c) => c === code).length
  return {
    add(code) {
      recent.push(code)
      if (recent.length > window) recent.shift()
      if (code === null) return null
      return count(code) >= needed ? code : null
    },
    count,
    clear() {
      recent = []
    },
  }
}
