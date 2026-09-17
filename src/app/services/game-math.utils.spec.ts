import { describe, it, expect } from 'vitest';
import { formatNumber } from './game-math.utils';

describe('formatNumber - Adaptive Compact Number Formatting', () => {
  it('should format numbers below 1000 as whole integer strings', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(999.8)).toBe('999');
  });

  it('should format thousands (K) with adaptive precision', () => {
    // >= 100K: 0 decimals (e.g. 493080 -> 493K)
    expect(formatNumber(493080)).toBe('493K');
    expect(formatNumber(100000)).toBe('100K');
    expect(formatNumber(999999)).toBe('999K');

    // 10K - 99K: 1 decimal
    expect(formatNumber(49308)).toBe('49.3K');
    expect(formatNumber(10000)).toBe('10K');
    expect(formatNumber(10500)).toBe('10.5K');

    // 1K - 9.9K: up to 2 decimals
    expect(formatNumber(4930)).toBe('4.93K');
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1250)).toBe('1.25K');
  });

  it('should format millions (M) with adaptive precision', () => {
    // < 10M: up to 2 decimals
    expect(formatNumber(1230500)).toBe('1.23M');
    expect(formatNumber(1000000)).toBe('1M');
    expect(formatNumber(5500000)).toBe('5.5M');

    // 10M - 99M: 1 decimal
    expect(formatNumber(12340000)).toBe('12.3M');

    // >= 100M: 0 decimals
    expect(formatNumber(123450000)).toBe('123M');
  });

  it('should format billions (B) with adaptive precision', () => {
    expect(formatNumber(1000000000)).toBe('1B');
    expect(formatNumber(2500000000)).toBe('2.5B');
    expect(formatNumber(12345678900)).toBe('12.3B');
    expect(formatNumber(456789000000)).toBe('456B');
  });

  it('should handle negative numbers gracefully', () => {
    expect(formatNumber(-493080)).toBe('-493K');
    expect(formatNumber(-49308)).toBe('-49.3K');
    expect(formatNumber(-4930)).toBe('-4.93K');
    expect(formatNumber(-500)).toBe('-500');
  });
});
