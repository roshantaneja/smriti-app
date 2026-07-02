// Local-day helpers. dayKey/dayLabel work in local time, so tests pin "now"
// with fake timers where the result depends on the current date.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { dayKey, dayLabel } from '../date';

afterEach(() => {
  jest.useRealTimers();
});

describe('dayKey', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 6, 1))).toBe('2026-07-01');
  });

  it('zero-pads single-digit months and days', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 10, 9))).toBe('2026-11-09');
  });

  it('is stable for the same calendar day regardless of time of day', () => {
    expect(dayKey(new Date(2026, 2, 15, 0, 0, 1))).toBe('2026-03-15');
    expect(dayKey(new Date(2026, 2, 15, 23, 59, 59))).toBe('2026-03-15');
  });

  it('defaults to now', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    expect(dayKey()).toBe('2026-06-15');
  });
});

describe('dayLabel', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 12, 0, 0)); // Mon Jun 15 2026
  });

  it('labels the current day "Today"', () => {
    expect(dayLabel('2026-06-15')).toBe('Today');
  });

  it('labels the previous day "Yesterday"', () => {
    expect(dayLabel('2026-06-14')).toBe('Yesterday');
  });

  it('renders older days as a short locale date (weekday + month + day)', () => {
    // Exact text is locale-dependent; assert the parts we control.
    const label = dayLabel('2026-06-01');
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Yesterday');
    expect(label).toContain('1');
    expect(label.length).toBeGreaterThan(3);
  });
});
