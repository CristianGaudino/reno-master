/**
 * The only place in the app that converts between unit systems.
 *
 * Everything internal — storage, geometry, rules — is integer millimetres and
 * grams. Display formatting and text input are the boundary, and they live here.
 * Spec section 8: van dimensions come from both US and European sources and
 * users are split, so both systems are first-class.
 */

import {
  GRAMS_PER_KILOGRAM,
  GRAMS_PER_POUND,
  MM_PER_FOOT,
  MM_PER_INCH,
} from './constants'
import type { Grams, Mm, UnitSystem } from './definitions'

// ---------------------------------------------------------------------------
// Length
// ---------------------------------------------------------------------------

export function mmToInches(mm: Mm): number {
  return mm / MM_PER_INCH
}

export function inchesToMm(inches: number): Mm {
  return Math.round(inches * MM_PER_INCH)
}

export function feetInchesToMm(feet: number, inches = 0): Mm {
  return Math.round(feet * MM_PER_FOOT + inches * MM_PER_INCH)
}

/** Round a fractional inch value to the nearest `1/denominator`. */
function roundToFraction(value: number, denominator: number): number {
  return Math.round(value * denominator) / denominator
}

function reduceFraction(numerator: number, denominator: number): [number, number] {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(numerator, denominator) || 1
  return [numerator / divisor, denominator / divisor]
}

/**
 * Format inches as feet and inches with a vulgar fraction, e.g. `6' 1 1/2"`.
 * Used for anything van-sized, where a bare inch count is hard to picture.
 */
function formatFeetInches(totalInches: number, denominator: number): string {
  const negative = totalInches < 0
  const abs = Math.abs(totalInches)

  const rounded = roundToFraction(abs, denominator)
  let feet = Math.floor(rounded / 12)
  let inches = rounded - feet * 12

  // Rounding can push inches to exactly 12; carry into feet.
  if (inches >= 12) {
    feet += 1
    inches -= 12
  }

  const whole = Math.floor(inches + 1e-9)
  const fractional = inches - whole
  const numerator = Math.round(fractional * denominator)

  let inchText = String(whole)
  if (numerator > 0) {
    const [n, d] = reduceFraction(numerator, denominator)
    inchText = whole === 0 ? `${n}/${d}` : `${whole} ${n}/${d}`
  }

  const sign = negative ? '-' : ''
  return feet > 0 ? `${sign}${feet}' ${inchText}"` : `${sign}${inchText}"`
}

export interface FormatLengthOptions {
  /**
   * Imperial only. Fractional-inch precision; 8 gives eighths, which is the
   * finest most people will cut to with a hand tool.
   */
  denominator?: number
  /** Suppress the unit suffix, for use next to a shared label. */
  bare?: boolean
  /**
   * Force plain inches rather than feet-and-inches. Right for small clearances,
   * where `2 1/2"` reads better than `0' 2 1/2"`.
   */
  inchesOnly?: boolean
}

/**
 * Format a millimetre value for display.
 *
 * Metric shows whole millimetres — sub-millimetre precision is noise at van
 * scale and implies an accuracy the underlying data does not have.
 */
export function formatLength(
  mm: Mm,
  system: UnitSystem,
  options: FormatLengthOptions = {},
): string {
  const { denominator = 8, bare = false, inchesOnly = false } = options

  if (system === 'metric') {
    const rounded = Math.round(mm)
    return bare ? String(rounded) : `${rounded} mm`
  }

  const inches = mmToInches(mm)
  if (inchesOnly || Math.abs(inches) < 12) {
    const rounded = roundToFraction(inches, denominator)
    const whole = Math.trunc(rounded)
    const numerator = Math.round(Math.abs(rounded - whole) * denominator)
    if (numerator === 0) return bare ? String(whole) : `${whole}"`
    const [n, d] = reduceFraction(numerator, denominator)
    const sign = rounded < 0 && whole === 0 ? '-' : ''
    const text = whole === 0 ? `${sign}${n}/${d}` : `${whole} ${n}/${d}`
    return bare ? text : `${text}"`
  }

  return formatFeetInches(inches, denominator)
}

/**
 * Parse user input into millimetres, accepting whatever people actually type.
 *
 * Metric: `1830`, `1830mm`, `183cm`, `1.83m`
 * Imperial: `72`, `72"`, `6'`, `6' 1"`, `6ft 1in`, `6-1`, `72 1/2`, `6' 1 1/2"`
 *
 * Returns `null` for anything unparseable so the caller can leave the field in
 * an error state rather than silently substituting a wrong number.
 */
export function parseLength(input: string, system: UnitSystem): Mm | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null

  // Explicit metric suffixes are honoured in either system, so a European user
  // pasting "1830mm" while in imperial mode gets what they meant.
  const metricMatch = raw.match(/^(-?[\d.]+)\s*(mm|cm|m)$/)
  if (metricMatch) {
    const value = Number(metricMatch[1])
    if (!Number.isFinite(value)) return null
    const unit = metricMatch[2]
    if (unit === 'cm') return Math.round(value * 10)
    if (unit === 'm') return Math.round(value * 1000)
    return Math.round(value)
  }

  if (system === 'metric') {
    const value = Number(raw)
    return Number.isFinite(value) ? Math.round(value) : null
  }

  return parseImperial(raw)
}

function parseImperial(raw: string): Mm | null {
  // Normalise the many ways people write feet and inches into a single form.
  // Note the leading digit in these patterns: "6ft" has no word boundary
  // between the 6 and the f, so a plain \bft\b would never match it.
  const text = raw
    .replace(/(\d)\s*(?:feet|foot|ft)\b/g, "$1'")
    .replace(/(\d)\s*(?:inches|inch|in)\b/g, '$1"')
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  // 6-1 as shorthand for 6' 1"
  const dashMatch = text.match(/^(-?\d+)\s*-\s*(\d+(?:\s+\d+\/\d+)?)$/)
  if (dashMatch) {
    const feet = Number(dashMatch[1])
    const inches = parseInchExpression(dashMatch[2] ?? '')
    if (inches === null) return null
    return feetInchesToMm(feet, inches)
  }

  const feetMatch = text.match(/^(-?[\d.]+)\s*'\s*(.*)$/)
  if (feetMatch) {
    const feet = Number(feetMatch[1])
    if (!Number.isFinite(feet)) return null
    const remainder = (feetMatch[2] ?? '').replace(/"$/, '').trim()
    if (!remainder) return feetInchesToMm(feet)
    const inches = parseInchExpression(remainder)
    if (inches === null) return null
    return feetInchesToMm(feet, inches)
  }

  const inches = parseInchExpression(text.replace(/"$/, '').trim())
  return inches === null ? null : inchesToMm(inches)
}

/** Parse `12`, `12.5`, `1/2`, or `12 1/2` into a number of inches. */
function parseInchExpression(text: string): number | null {
  if (!text) return null

  const mixed = text.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) {
    const whole = Number(mixed[1])
    const numerator = Number(mixed[2])
    const denominator = Number(mixed[3])
    if (!denominator) return null
    const magnitude = Math.abs(whole) + numerator / denominator
    return whole < 0 ? -magnitude : magnitude
  }

  const fraction = text.match(/^(-?\d+)\/(\d+)$/)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (!denominator) return null
    return Number(fraction[1]) / denominator
  }

  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Suffix for a bare numeric input field. */
export function lengthUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'mm' : 'in'
}

/**
 * Step size for a numeric input's arrow keys: 1mm metric, 1/8" imperial, so a
 * keypress moves by the smallest unit the user is likely to work to.
 */
export function lengthStep(system: UnitSystem): Mm {
  return system === 'metric' ? 1 : Math.round(MM_PER_INCH / 8)
}

// ---------------------------------------------------------------------------
// Mass
// ---------------------------------------------------------------------------

export function gramsToKg(g: Grams): number {
  return g / GRAMS_PER_KILOGRAM
}

export function gramsToPounds(g: Grams): number {
  return g / GRAMS_PER_POUND
}

export function kgToGrams(kg: number): Grams {
  return Math.round(kg * GRAMS_PER_KILOGRAM)
}

export function poundsToGrams(lb: number): Grams {
  return Math.round(lb * GRAMS_PER_POUND)
}

export function formatMass(g: Grams, system: UnitSystem, bare = false): string {
  if (system === 'metric') {
    const kg = gramsToKg(g)
    const text = kg >= 100 ? kg.toFixed(0) : kg.toFixed(1)
    return bare ? text : `${text} kg`
  }
  const lb = gramsToPounds(g)
  const text = lb >= 100 ? lb.toFixed(0) : lb.toFixed(1)
  return bare ? text : `${text} lb`
}

export function parseMass(input: string, system: UnitSystem): Grams | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null

  const suffixed = raw.match(/^(-?[\d.]+)\s*(kg|g|lb|lbs)$/)
  if (suffixed) {
    const value = Number(suffixed[1])
    if (!Number.isFinite(value)) return null
    const unit = suffixed[2]
    if (unit === 'kg') return kgToGrams(value)
    if (unit === 'g') return Math.round(value)
    return poundsToGrams(value)
  }

  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return system === 'metric' ? kgToGrams(value) : poundsToGrams(value)
}

export function massUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'kg' : 'lb'
}

// ---------------------------------------------------------------------------
// Volume (storage capacity)
// ---------------------------------------------------------------------------

/** Cubic millimetres to litres. */
export function mm3ToLitres(mm3: number): number {
  return mm3 / 1_000_000
}

export function formatVolume(mm3: number, system: UnitSystem): string {
  const litres = mm3ToLitres(mm3)
  if (system === 'metric') return `${litres.toFixed(0)} L`
  const cubicFeet = litres / 28.316846592
  return `${cubicFeet.toFixed(1)} cu ft`
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Minor units (pence/cents) to a display string. */
export function formatCost(minorUnits: number, currency = 'GBP', locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100)
}
