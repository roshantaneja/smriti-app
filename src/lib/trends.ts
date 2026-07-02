// Trend & analytics math over the daily log and weigh-ins: per-day totals,
// rolling averages, logging streaks, and an EWMA-smoothed weight trend.
// Pure functions — no store access, fully tested.

import { addDays } from './grocery';
import { resolveEntryNutrients, scaleNutrientsBy, sum } from './nutrition';
import type { Ingredient, LogEntry, Nutrients, Recipe, WeightEntry } from './types';

interface Ctx {
  getIngredient: (id: string) => Ingredient | undefined;
  getRecipe: (id: string) => Recipe | undefined;
}

/**
 * Summed nutrients per day, keyed by YYYY-MM-DD. Every day with at least one
 * entry gets a key (a water-only day maps to `{}` since water carries none).
 */
export function dayTotals(log: LogEntry[], ctx: Ctx): Map<string, Nutrients> {
  const grouped = new Map<string, Nutrients[]>();
  for (const e of log) {
    const resolved = resolveEntryNutrients(e, ctx);
    const list = grouped.get(e.date);
    if (list) list.push(resolved);
    else grouped.set(e.date, [resolved]);
  }
  const out = new Map<string, Nutrients>();
  for (const [date, list] of grouped) out.set(date, sum(list));
  return out;
}

/** The last `n` day keys ending at `today`, ordered oldest → newest. */
export function lastNDays(n: number, today: string): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

/** The set of days carrying at least one food (non-water) entry. */
function foodDays(log: LogEntry[]): Set<string> {
  const days = new Set<string>();
  for (const e of log) {
    if (e.kind !== 'water') days.add(e.date);
  }
  return days;
}

export interface RangeAverages {
  /** Average daily nutrients across the logged days in the window. */
  avg: Nutrients;
  /** Days in the window with ≥1 non-water entry — the averaging denominator. */
  daysLogged: number;
}

/**
 * Daily nutrient averages over the trailing `days`-day window ending at
 * `today` (inclusive). Divides by the number of days actually logged (≥1
 * non-water entry), not the window length, so unlogged days don't drag the
 * averages toward zero — the convention Cronometer-style trackers use.
 */
export function rangeAverages(
  log: LogEntry[],
  ctx: Ctx,
  days: number,
  today: string,
): RangeAverages {
  const window = new Set(lastNDays(days, today));
  const logged = new Set<string>();
  const perEntry: Nutrients[] = [];
  for (const e of log) {
    if (!window.has(e.date)) continue;
    if (e.kind !== 'water') logged.add(e.date);
    perEntry.push(resolveEntryNutrients(e, ctx));
  }
  const daysLogged = logged.size;
  if (daysLogged === 0) return { avg: {}, daysLogged: 0 };
  return { avg: scaleNutrientsBy(sum(perEntry), 1 / daysLogged), daysLogged };
}

/**
 * Consecutive days with ≥1 non-water entry, counted backwards from `today`.
 * An unlogged today doesn't break the streak (the day isn't over yet), so the
 * run may also end at yesterday; two unlogged days in a row end it at 0.
 */
export function currentStreak(log: LogEntry[], today: string): number {
  const days = foodDays(log);
  let d = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(d)) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}

export interface WeightTrendPoint {
  date: string;
  /** Raw scale reading for the weigh-in. */
  kg: number;
  /** EWMA-smoothed trend weight at this point, rounded to 2 decimals. */
  trendKg: number;
}

/**
 * Exponentially-weighted moving average over weigh-ins, sorted by date:
 *
 *   trend₀ = kg₀
 *   trendᵢ = α · kgᵢ + (1 − α) · trendᵢ₋₁
 *
 * A higher α tracks the scale faster; the default α = 0.3 smooths day-to-day
 * water-weight noise into a MacroFactor-style trend line.
 */
export function weightTrend(weights: WeightEntry[], alpha = 0.3): WeightTrendPoint[] {
  const sorted = [...weights].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  const out: WeightTrendPoint[] = [];
  let trend: number | undefined;
  for (const w of sorted) {
    trend = trend == null ? w.kg : alpha * w.kg + (1 - alpha) * trend;
    out.push({ date: w.date, kg: w.kg, trendKg: Math.round(trend * 100) / 100 });
  }
  return out;
}

/** Total water (ml) per day. Days with no water entries are absent. */
export function waterByDay(log: LogEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of log) {
    if (e.kind !== 'water') continue;
    out.set(e.date, (out.get(e.date) ?? 0) + (e.waterMl ?? 0));
  }
  return out;
}
