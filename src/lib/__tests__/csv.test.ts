// CSV export builders: per-entry log, per-day totals, and weigh-ins,
// including RFC 4180 escaping of commas, quotes, and newlines.
//
// Jest APIs are imported from @jest/globals because this project's TypeScript
// (6.x) no longer auto-includes @types packages and tsconfig sets no `types`.

import { describe, expect, it } from '@jest/globals';

import { dayTotalsToCsv, logToCsv, weightsToCsv } from '../csv';
import type { Ingredient, LogEntry, WeightEntry } from '../types';

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

const oats: Ingredient = {
  id: 'oats',
  name: 'Rolled oats',
  category: 'Grains',
  per100g: { calories: 380, protein: 13 },
  portions: [],
  source: 'test',
};

const ctx = {
  getIngredient: (id: string) => (id === 'oats' ? oats : undefined),
  getRecipe: () => undefined,
};

const noCtx = { getIngredient: () => undefined, getRecipe: () => undefined };

const LOG_HEADER = 'date,meal,kind,label,amount,calories,protein,carbs,fat,fiber,sugar,sodium';

describe('logToCsv', () => {
  it('emits only the header for an empty log', () => {
    expect(logToCsv([], noCtx)).toBe(LOG_HEADER);
  });

  it('writes one row per entry with snapshot nutrients (blanks for missing keys)', () => {
    const log = [
      entry({
        meal: 'breakfast',
        label: 'Protein shake',
        nutrients: { calories: 250, protein: 30 },
      }),
    ];
    expect(logToCsv(log, noCtx)).toBe(
      `${LOG_HEADER}\n2026-01-01,breakfast,quick,Protein shake,,250,30,,,,,`,
    );
  });

  it('formats amounts per kind: grams, servings, and ml', () => {
    const log = [
      entry({
        id: 'a',
        kind: 'ingredient',
        ingredientId: 'oats',
        grams: 50,
        meal: 'breakfast',
        createdAt: '2026-01-01T08:00:00.000Z',
      }),
      entry({
        id: 'b',
        kind: 'recipe',
        label: 'Dal',
        servings: 2,
        meal: 'dinner',
        nutrients: { calories: 500 },
        createdAt: '2026-01-01T19:00:00.000Z',
      }),
      entry({ id: 'c', kind: 'water', waterMl: 250, createdAt: '2026-01-01T20:00:00.000Z' }),
    ];
    const lines = logToCsv(log, ctx).split('\n');
    // Ingredient: label from the live ingredient, nutrients computed from grams.
    expect(lines[1]).toBe('2026-01-01,breakfast,ingredient,Rolled oats,50 g,190,6.5,,,,,');
    expect(lines[2]).toBe('2026-01-01,dinner,recipe,Dal,2 servings,500,,,,,,');
    // Water: no meal, no nutrients.
    expect(lines[3]).toBe('2026-01-01,,water,Water,250 ml,,,,,,,');
  });

  it('escapes labels containing commas, quotes, and newlines', () => {
    const log = [
      entry({ label: 'Rice, "special"\nbowl', nutrients: { calories: 100 } }),
    ];
    expect(logToCsv(log, noCtx).split('\n').slice(1).join('\n')).toBe(
      '2026-01-01,,quick,"Rice, ""special""\nbowl",,100,,,,,,',
    );
  });

  it('sorts rows by date then entry time', () => {
    const log = [
      entry({ id: 'late', date: '2026-01-02', label: 'Later', nutrients: { calories: 1 } }),
      entry({ id: 'early', date: '2026-01-01', label: 'Earlier', nutrients: { calories: 2 } }),
    ];
    const lines = logToCsv(log, noCtx).split('\n');
    expect(lines[1]).toContain('Earlier');
    expect(lines[2]).toContain('Later');
  });
});

describe('dayTotalsToCsv', () => {
  const HEADER = 'date,calories,protein,carbs,fat,fiber,sugar,sodium,water_ml';

  it('emits only the header for an empty log', () => {
    expect(dayTotalsToCsv([], noCtx)).toBe(HEADER);
  });

  it('writes one row per day with summed totals and water, sorted by date', () => {
    const log = [
      entry({ id: 'b', date: '2026-01-02', nutrients: { calories: 400, fat: 10 } }),
      entry({ id: 'a1', date: '2026-01-01', nutrients: { calories: 300, protein: 20 } }),
      entry({ id: 'a2', date: '2026-01-01', nutrients: { calories: 200, protein: 5.5 } }),
      entry({ id: 'w', date: '2026-01-01', kind: 'water', waterMl: 750 }),
    ];
    expect(dayTotalsToCsv(log, noCtx)).toBe(
      `${HEADER}\n2026-01-01,500,25.5,0,0,0,0,0,750\n2026-01-02,400,0,0,10,0,0,0,0`,
    );
  });

  it('includes water-only days with zeroed nutrients', () => {
    const log = [entry({ kind: 'water', waterMl: 500 })];
    expect(dayTotalsToCsv(log, noCtx)).toBe(`${HEADER}\n2026-01-01,0,0,0,0,0,0,0,500`);
  });
});

describe('weightsToCsv', () => {
  it('emits only the header for no weigh-ins', () => {
    expect(weightsToCsv([])).toBe('date,kg');
  });

  it('writes one row per weigh-in, sorted by date', () => {
    const list = [
      weight({ id: 'w2', date: '2026-01-05', kg: 79.4 }),
      weight({ id: 'w1', date: '2026-01-01', kg: 80 }),
    ];
    expect(weightsToCsv(list)).toBe('date,kg\n2026-01-01,80\n2026-01-05,79.4');
  });
});
