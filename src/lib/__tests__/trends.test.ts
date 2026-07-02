// Trend math: per-day totals, rolling averages, logging streaks, EWMA weight
// trend, and per-day water. All dates are passed explicitly — no wall clock.
//
// Jest APIs are imported from @jest/globals because this project's TypeScript
// (6.x) no longer auto-includes @types packages and tsconfig sets no `types`.

import { describe, expect, it } from '@jest/globals';

import {
  currentStreak,
  dayTotals,
  lastNDays,
  rangeAverages,
  waterByDay,
  weightTrend,
} from '../trends';
import type { LogEntry, WeightEntry } from '../types';

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: 'log-1',
  date: '2026-01-01',
  kind: 'quick',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const weight = (over: Partial<WeightEntry> = {}): WeightEntry => ({
  id: 'wt-1',
  date: '2026-01-01',
  kg: 80,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const noCtx = {
  getIngredient: () => undefined,
  getRecipe: () => undefined,
};

describe('dayTotals', () => {
  it('groups entries by date and sums their nutrients', () => {
    const log = [
      entry({ id: 'a', date: '2026-01-01', nutrients: { calories: 300, protein: 20 } }),
      entry({ id: 'b', date: '2026-01-01', nutrients: { calories: 200, protein: 5.5 } }),
      entry({ id: 'c', date: '2026-01-02', nutrients: { calories: 100 } }),
    ];
    const totals = dayTotals(log, noCtx);
    expect(totals.get('2026-01-01')).toEqual({ calories: 500, protein: 25.5 });
    expect(totals.get('2026-01-02')).toEqual({ calories: 100 });
  });

  it('keeps a key for a water-only day but with no nutrients', () => {
    const totals = dayTotals([entry({ kind: 'water', waterMl: 500 })], noCtx);
    expect(totals.get('2026-01-01')).toEqual({});
  });

  it('returns an empty map for an empty log', () => {
    expect(dayTotals([], noCtx).size).toBe(0);
  });
});

describe('lastNDays', () => {
  it('returns the trailing n days ending at today, oldest first', () => {
    expect(lastNDays(3, '2026-07-02')).toEqual(['2026-06-30', '2026-07-01', '2026-07-02']);
  });

  it('returns just today for n=1', () => {
    expect(lastNDays(1, '2026-07-02')).toEqual(['2026-07-02']);
  });

  it('crosses a year boundary', () => {
    expect(lastNDays(2, '2026-01-01')).toEqual(['2025-12-31', '2026-01-01']);
  });
});

describe('rangeAverages', () => {
  it('averages over logged days only, not the window length', () => {
    const log = [
      entry({ id: 'a', date: '2026-07-01', nutrients: { calories: 500, protein: 10 } }),
      entry({ id: 'b', date: '2026-07-02', nutrients: { calories: 300, protein: 5 } }),
    ];
    expect(rangeAverages(log, noCtx, 7, '2026-07-02')).toEqual({
      avg: { calories: 400, protein: 7.5 },
      daysLogged: 2,
    });
  });

  it('ignores entries outside the window', () => {
    const log = [
      entry({ id: 'old', date: '2026-06-25', nutrients: { calories: 9999 } }),
      entry({ id: 'in', date: '2026-07-02', nutrients: { calories: 400 } }),
    ];
    expect(rangeAverages(log, noCtx, 7, '2026-07-02')).toEqual({
      avg: { calories: 400 },
      daysLogged: 1,
    });
  });

  it('does not count water-only days as logged', () => {
    const log = [
      entry({ id: 'food', date: '2026-07-02', nutrients: { calories: 600 } }),
      entry({ id: 'water', date: '2026-07-01', kind: 'water', waterMl: 500 }),
    ];
    expect(rangeAverages(log, noCtx, 7, '2026-07-02')).toEqual({
      avg: { calories: 600 },
      daysLogged: 1,
    });
  });

  it('returns an empty average when nothing is logged in the window', () => {
    expect(rangeAverages([], noCtx, 30, '2026-07-02')).toEqual({ avg: {}, daysLogged: 0 });
  });

  it('rounds calories to an integer and other nutrients to 1 decimal', () => {
    const log = [
      entry({ id: 'a', date: '2026-06-30', nutrients: { calories: 100, protein: 10 } }),
      entry({ id: 'b', date: '2026-07-01', nutrients: { calories: 100, protein: 10 } }),
      entry({ id: 'c', date: '2026-07-02', nutrients: { calories: 101, protein: 5 } }),
    ];
    expect(rangeAverages(log, noCtx, 7, '2026-07-02')).toEqual({
      avg: { calories: 100, protein: 8.3 }, // 301/3 = 100.33…, 25/3 = 8.33…
      daysLogged: 3,
    });
  });
});

describe('currentStreak', () => {
  it('counts consecutive logged days ending today', () => {
    const log = [
      entry({ id: 'a', date: '2026-07-02' }),
      entry({ id: 'b', date: '2026-07-01' }),
      entry({ id: 'c', date: '2026-06-30' }),
    ];
    expect(currentStreak(log, '2026-07-02')).toBe(3);
  });

  it('survives an unlogged today by ending at yesterday', () => {
    const log = [entry({ id: 'a', date: '2026-07-01' }), entry({ id: 'b', date: '2026-06-30' })];
    expect(currentStreak(log, '2026-07-02')).toBe(2);
  });

  it('is 0 when neither today nor yesterday is logged', () => {
    expect(currentStreak([entry({ date: '2026-06-29' })], '2026-07-02')).toBe(0);
  });

  it('breaks on a gap day', () => {
    const log = [entry({ id: 'a', date: '2026-07-02' }), entry({ id: 'b', date: '2026-06-30' })];
    expect(currentStreak(log, '2026-07-02')).toBe(1);
  });

  it('does not count water-only days', () => {
    const log = [
      entry({ id: 'a', date: '2026-07-02', kind: 'water', waterMl: 250 }),
      entry({ id: 'b', date: '2026-07-01' }),
    ];
    expect(currentStreak(log, '2026-07-02')).toBe(1);
  });
});

describe('weightTrend', () => {
  it('starts the trend at the first raw weight', () => {
    expect(weightTrend([weight({ kg: 80 })])).toEqual([
      { date: '2026-01-01', kg: 80, trendKg: 80 },
    ]);
  });

  it('applies trendᵢ = α·kgᵢ + (1 − α)·trendᵢ₋₁ with the default α = 0.3', () => {
    const out = weightTrend([
      weight({ id: 'w1', date: '2026-01-01', kg: 80 }),
      weight({ id: 'w2', date: '2026-01-02', kg: 82 }),
    ]);
    // 0.3·82 + 0.7·80 = 80.6
    expect(out).toEqual([
      { date: '2026-01-01', kg: 80, trendKg: 80 },
      { date: '2026-01-02', kg: 82, trendKg: 80.6 },
    ]);
  });

  it('sorts weigh-ins by date before smoothing', () => {
    const out = weightTrend([
      weight({ id: 'w2', date: '2026-01-02', kg: 82 }),
      weight({ id: 'w1', date: '2026-01-01', kg: 80 }),
    ]);
    expect(out.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-02']);
    expect(out[1].trendKg).toBe(80.6);
  });

  it('honors a custom alpha', () => {
    const out = weightTrend(
      [
        weight({ id: 'w1', date: '2026-01-01', kg: 80 }),
        weight({ id: 'w2', date: '2026-01-02', kg: 82 }),
      ],
      0.5,
    );
    expect(out[1].trendKg).toBe(81);
  });

  it('rounds the trend to 2 decimals', () => {
    const out = weightTrend([
      weight({ id: 'w1', date: '2026-01-01', kg: 80 }),
      weight({ id: 'w2', date: '2026-01-02', kg: 81.11 }),
    ]);
    // 0.3·81.11 + 0.7·80 = 80.333 → 80.33
    expect(out[1].trendKg).toBe(80.33);
  });

  it('returns [] for no weigh-ins', () => {
    expect(weightTrend([])).toEqual([]);
  });
});

describe('waterByDay', () => {
  it('sums water per day and ignores food entries', () => {
    const log = [
      entry({ id: 'a', date: '2026-07-01', kind: 'water', waterMl: 250 }),
      entry({ id: 'b', date: '2026-07-01', kind: 'water', waterMl: 500 }),
      entry({ id: 'c', date: '2026-07-02', kind: 'water', waterMl: 300 }),
      entry({ id: 'd', date: '2026-07-01', nutrients: { calories: 100 } }),
      entry({ id: 'e', date: '2026-07-03', kind: 'water' }), // missing ml counts as 0
    ];
    const out = waterByDay(log);
    expect(out.get('2026-07-01')).toBe(750);
    expect(out.get('2026-07-02')).toBe(300);
    expect(out.get('2026-07-03')).toBe(0);
  });

  it('leaves days without water absent', () => {
    expect(waterByDay([entry({ nutrients: { calories: 100 } })]).size).toBe(0);
  });
});
