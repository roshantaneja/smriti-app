// CSV builders for data export. Pure string functions — no filesystem access
// (the Settings screen writes the result to a cache file and shares it).
// Fields containing commas, quotes, or newlines are quoted per RFC 4180.

import { entryTitle } from './format';
import { resolveEntryNutrients } from './nutrition';
import { dayTotals, waterByDay } from './trends';
import type { Ingredient, LogEntry, Recipe, WeightEntry } from './types';

interface Ctx {
  getIngredient: (id: string) => Ingredient | undefined;
  getRecipe: (id: string) => Recipe | undefined;
}

function escapeField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toRow(fields: (string | number)[]): string {
  return fields.map(escapeField).join(',');
}

/** Nutrient columns shared by the per-entry and per-day exports, in order. */
const NUTRIENT_COLUMNS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const;

/** Amount column: grams for ingredients, servings for recipes, ml for water. */
function entryAmount(e: LogEntry): string {
  switch (e.kind) {
    case 'ingredient':
      return `${e.grams ?? 0} g`;
    case 'recipe': {
      const s = e.servings ?? 1;
      return `${s} serving${s === 1 ? '' : 's'}`;
    }
    case 'water':
      return `${e.waterMl ?? 0} ml`;
    case 'quick':
      return '';
  }
}

/**
 * One CSV row per log entry, sorted by date then log time. Nutrients a food
 * doesn't carry are left blank (not 0) so missing data stays distinguishable.
 */
export function logToCsv(log: LogEntry[], ctx: Ctx): string {
  const rows = [toRow(['date', 'meal', 'kind', 'label', 'amount', ...NUTRIENT_COLUMNS])];
  const sorted = [...log].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  for (const e of sorted) {
    const n = resolveEntryNutrients(e, ctx);
    rows.push(
      toRow([
        e.date,
        e.meal ?? '',
        e.kind,
        entryTitle(e, ctx),
        entryAmount(e),
        ...NUTRIENT_COLUMNS.map((k) => n[k] ?? ''),
      ]),
    );
  }
  return rows.join('\n');
}

/** One CSV row per logged day: nutrient totals plus water in ml, date-sorted. */
export function dayTotalsToCsv(log: LogEntry[], ctx: Ctx): string {
  const totals = dayTotals(log, ctx);
  const water = waterByDay(log);
  const days = [...new Set([...totals.keys(), ...water.keys()])].sort();
  const rows = [toRow(['date', ...NUTRIENT_COLUMNS, 'water_ml'])];
  for (const d of days) {
    const n = totals.get(d) ?? {};
    rows.push(toRow([d, ...NUTRIENT_COLUMNS.map((k) => n[k] ?? 0), water.get(d) ?? 0]));
  }
  return rows.join('\n');
}

/** One CSV row per weigh-in, sorted by date then entry time. */
export function weightsToCsv(weights: WeightEntry[]): string {
  const rows = [toRow(['date', 'kg'])];
  const sorted = [...weights].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  for (const w of sorted) rows.push(toRow([w.date, w.kg]));
  return rows.join('\n');
}
