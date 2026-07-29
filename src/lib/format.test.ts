import { describe, it, expect } from 'vitest'
import { formatUsd, formatPercent, formatSupply, truncateAddress } from './format'

describe('formatUsd', () => {
  it('formats billions', () => {
    expect(formatUsd(1_234_567_890)).toBe('$1.2B')
  })
  it('formats millions', () => {
    expect(formatUsd(1_234_567)).toBe('$1.2M')
  })
  it('formats thousands', () => {
    expect(formatUsd(4_321)).toBe('$4.3K')
  })
  it('formats whole dollars with two decimals', () => {
    expect(formatUsd(12.5)).toBe('$12.50')
  })
  it('formats sub-dollar values with three significant figures', () => {
    expect(formatUsd(0.0000123)).toBe('$0.0000123')
  })
  it('uses the boundary rule at exactly 1000/1e6/1e9', () => {
    expect(formatUsd(1_000)).toBe('$1.0K')
    expect(formatUsd(1_000_000)).toBe('$1.0M')
    expect(formatUsd(1_000_000_000)).toBe('$1.0B')
    expect(formatUsd(1)).toBe('$1.00')
  })
})

describe('formatPercent', () => {
  it('prefixes a plus sign for gains', () => {
    expect(formatPercent(3.14)).toBe('+3.1%')
  })
  it('keeps the minus sign for losses', () => {
    expect(formatPercent(-2.5)).toBe('-2.5%')
  })
  it('does not prefix zero', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })
})

describe('formatSupply', () => {
  it('groups thousands with the en-US locale', () => {
    expect(formatSupply(1_000_000_000)).toBe('1,000,000,000')
  })
})

describe('truncateAddress', () => {
  it('truncates long addresses to head...tail', () => {
    expect(truncateAddress('AbCdEfGhIjKlMnOpQrStWxYz')).toBe('AbCd...WxYz')
  })
  it('honours a custom head/tail length', () => {
    expect(truncateAddress('AbCdEfGhIjKlMnOpQrStWxYz', 6)).toBe('AbCdEf...StWxYz')
  })
  it('returns short strings unchanged', () => {
    expect(truncateAddress('short')).toBe('short')
  })
})
