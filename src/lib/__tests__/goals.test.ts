// Per-weekday goal overrides: weekday resolution and effective-goal merging.
//
// Jest APIs are imported from @jest/globals because this project's TypeScript
// (6.x) no longer auto-includes @types packages and tsconfig sets no `types`.

import { describe, expect, it } from '@jest/globals';

import { effectiveGoals, hasOverride, weekdayOf } from '../goals';
import type { Goals, Weekday } from '../types';

const BASE: Goals = {
  calories: 2000,
  protein: 120,
  carbs: 220,
  fat: 65,
  fiber: 30,
  waterMl: 2500,
};

type Overrides = Partial<Record<Weekday, Partial<Goals>>>;

describe('weekdayOf', () => {
  it('maps known dates to their weekday', () => {
    // 2026-07-01 is a Wednesday (same fixture week as the grocery tests).
    expect(weekdayOf('2026-07-01')).toBe('wed');
    expect(weekdayOf('2026-07-02')).toBe('thu');
    expect(weekdayOf('2026-07-03')).toBe('fri');
    expect(weekdayOf('2026-07-04')).toBe('sat');
  });

  it('handles Monday and Sunday (the week edges)', () => {
    expect(weekdayOf('2026-06-29')).toBe('mon');
    expect(weekdayOf('2026-07-05')).toBe('sun');
  });

  it('crosses a year boundary', () => {
    // 2025-12-31 is a Wednesday; 2026-01-01 a Thursday.
    expect(weekdayOf('2025-12-31')).toBe('wed');
    expect(weekdayOf('2026-01-01')).toBe('thu');
  });
});

describe('effectiveGoals', () => {
  it('returns the base goals when no override exists', () => {
    expect(effectiveGoals(BASE, {}, '2026-06-29')).toEqual(BASE);
  });

  it('lets a partial override win only for the fields it sets', () => {
    const overrides: Overrides = { mon: { calories: 2400, protein: 160 } };
    expect(effectiveGoals(BASE, overrides, '2026-06-29')).toEqual({
      ...BASE,
      calories: 2400,
      protein: 160,
    });
  });

  it('leaves other weekdays unaffected', () => {
    const overrides: Overrides = { mon: { calories: 2400 } };
    // 2026-06-30 is the Tuesday after the overridden Monday.
    expect(effectiveGoals(BASE, overrides, '2026-06-30')).toEqual(BASE);
  });

  it('applies a full-week style override on its own day only', () => {
    const overrides: Overrides = {
      sat: { calories: 1800, carbs: 150, fat: 70 },
      sun: { waterMl: 3000 },
    };
    expect(effectiveGoals(BASE, overrides, '2026-07-04')).toEqual({
      ...BASE,
      calories: 1800,
      carbs: 150,
      fat: 70,
    });
    expect(effectiveGoals(BASE, overrides, '2026-07-05')).toEqual({ ...BASE, waterMl: 3000 });
  });

  it('ignores an empty override object', () => {
    expect(effectiveGoals(BASE, { mon: {} }, '2026-06-29')).toEqual(BASE);
  });
});

describe('hasOverride', () => {
  it('is true only for days whose weekday has a non-empty override', () => {
    const overrides: Overrides = { wed: { calories: 2200 } };
    expect(hasOverride(overrides, '2026-07-01')).toBe(true); // Wednesday
    expect(hasOverride(overrides, '2026-07-02')).toBe(false); // Thursday
  });

  it('is false with no overrides or an empty override', () => {
    expect(hasOverride({}, '2026-07-01')).toBe(false);
    expect(hasOverride({ wed: {} }, '2026-07-01')).toBe(false);
  });
});
