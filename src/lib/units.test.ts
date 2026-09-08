import { describe, expect, it } from 'vitest'
import {
  feetInchesToMm,
  formatLength,
  formatMass,
  inchesToMm,
  parseLength,
  parseMass,
} from './units'

describe('length conversion', () => {
  it('converts 6 feet to millimetres exactly', () => {
    expect(feetInchesToMm(6)).toBe(1829)
    expect(inchesToMm(72)).toBe(1829)
  })

  it('round-trips imperial input through display without drifting', () => {
    // A user types a figure, sees it rendered, and types what they saw back in.
    // If that loses accuracy, dimensions creep every time someone edits a field.
    for (const input of ['6\' 1"', '72"', '5\' 11 1/2"', '1/2"', '23 3/8"']) {
      const mm = parseLength(input, 'imperial')
      expect(mm, `parsing ${input}`).not.toBeNull()
      const formatted = formatLength(mm!, 'imperial')
      const reparsed = parseLength(formatted, 'imperial')
      expect(Math.abs(reparsed! - mm!), `round-trip of ${input}`).toBeLessThanOrEqual(1)
    }
  })

  it('accepts the many ways people write feet and inches', () => {
    const expected = feetInchesToMm(6, 1)
    for (const input of ['6\' 1"', "6' 1", '6ft 1in', '6-1', '6’ 1”']) {
      expect(parseLength(input, 'imperial'), input).toBe(expected)
    }
  })

  it('honours explicit metric suffixes even in imperial mode', () => {
    // Van dimensions get pasted from European sources; silently reading "1830mm"
    // as inches would be a 46-fold error.
    expect(parseLength('1830mm', 'imperial')).toBe(1830)
    expect(parseLength('183cm', 'imperial')).toBe(1830)
    expect(parseLength('1.83m', 'imperial')).toBe(1830)
  })

  it('returns null rather than guessing at unparseable input', () => {
    expect(parseLength('', 'metric')).toBeNull()
    expect(parseLength('wide-ish', 'metric')).toBeNull()
    expect(parseLength('abc', 'imperial')).toBeNull()
  })

  it('formats small clearances as inches rather than feet', () => {
    expect(formatLength(inchesToMm(6), 'imperial')).toBe('6"')
    expect(formatLength(1829, 'imperial')).toBe('6\' 0"')
  })

  it('carries a rounded 11 15/16 up to the next foot', () => {
    // 11.99" must not render as 0' 12".
    const mm = inchesToMm(11.99)
    expect(formatLength(mm, 'imperial')).toBe('1\' 0"')
  })

  it('shows whole millimetres in metric', () => {
    expect(formatLength(1829.4, 'metric')).toBe('1829 mm')
  })
})

describe('mass conversion', () => {
  it('round-trips kilograms and pounds', () => {
    expect(parseMass('100', 'metric')).toBe(100_000)
    expect(parseMass('100kg', 'imperial')).toBe(100_000)
    expect(parseMass('220.462', 'imperial')).toBe(100_000)
  })

  it('formats with sensible precision at each magnitude', () => {
    expect(formatMass(1500, 'metric')).toBe('1.5 kg')
    expect(formatMass(150_000, 'metric')).toBe('150 kg')
  })
})
