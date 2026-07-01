// Core nutrition math: scaling, summing, recipe totals, log-entry resolution,
// and recipe cost estimation.
//
// Jest APIs are imported from @jest/globals because this project's TypeScript
// (6.x) no longer auto-includes @types packages and tsconfig sets no `types`.

import { describe, expect, it } from '@jest/globals';

import {
  computeEntryNutrients,
  recipeCost,
  recipePerServing,
  recipeTotals,
  resolveEntryNutrients,
  scale,
  sum,
  totalForEntries,
  totalWater,
} from '../nutrition';
import type { Ingredient, LogEntry, Recipe } from '../types';

const ing = (over: Partial<Ingredient> = {}): Ingredient => ({
  id: 'ing-1',
  name: 'Test food',
  category: 'Test',
  per100g: { calories: 200, protein: 10 },
  portions: [],
  source: 'test',
  ...over,
});

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: 'rec-1',
  name: 'Test recipe',
  servings: 2,
  items: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: 'log-1',
  date: '2026-01-01',
  kind: 'quick',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const noCtx = {
  getIngredient: () => undefined,
  getRecipe: () => undefined,
};

describe('scale', () => {
  it('scales a per-100g profile to an arbitrary gram amount', () => {
    expect(scale({ calories: 410, protein: 24.2 }, 50)).toEqual({
      calories: 205,
      protein: 12.1,
    });
  });

  it('rounds calories to an integer and other nutrients to 1 decimal', () => {
    expect(scale({ calories: 123, protein: 3.33 }, 50)).toEqual({
      calories: 62, // 61.5 -> 62
      protein: 1.7, // 1.665 -> 1.7
    });
  });

  it('returns an empty profile for an empty input', () => {
    expect(scale({}, 250)).toEqual({});
  });

  it('omits keys not present in the source profile', () => {
    const out = scale({ protein: 8 }, 200);
    expect(out).toEqual({ protein: 16 });
    expect(out.calories).toBeUndefined();
  });
});

describe('sum', () => {
  it('adds profiles key by key', () => {
    expect(
      sum([
        { calories: 100, protein: 1.25, fat: 2 },
        { calories: 50, protein: 2.5 },
      ]),
    ).toEqual({ calories: 150, protein: 3.8, fat: 2 });
  });

  it('rounds calories to an integer after summing', () => {
    expect(sum([{ calories: 100.4 }, { calories: 50.4 }])).toEqual({ calories: 151 });
  });

  it('returns {} for an empty list', () => {
    expect(sum([])).toEqual({});
  });
});

describe('recipeTotals / recipePerServing', () => {
  const a = ing({ id: 'a', per100g: { calories: 200, protein: 10 } });
  const b = ing({ id: 'b', per100g: { calories: 100, protein: 5, fiber: 4 } });
  const getIngredient = (id: string) => [a, b].find((i) => i.id === id);
  const r = recipe({
    servings: 2,
    items: [
      { ingredientId: 'a', grams: 100, amount: 100, unit: 'g' },
      { ingredientId: 'b', grams: 50, amount: 50, unit: 'g' },
    ],
  });

  it('totals nutrients across all items', () => {
    expect(recipeTotals(r, getIngredient)).toEqual({
      calories: 250,
      protein: 12.5,
      fiber: 2,
    });
  });

  it('treats an unresolvable ingredient as contributing nothing', () => {
    const withGhost = recipe({
      items: [
        { ingredientId: 'a', grams: 100, amount: 100, unit: 'g' },
        { ingredientId: 'missing', grams: 500, amount: 500, unit: 'g' },
      ],
    });
    expect(recipeTotals(withGhost, getIngredient)).toEqual({ calories: 200, protein: 10 });
  });

  it('divides totals by servings for a single serving', () => {
    expect(recipePerServing(r, getIngredient)).toEqual({
      calories: 125,
      protein: 6.3, // 6.25 -> 6.3
      fiber: 1,
    });
  });

  it('guards servings=0 by treating it as 1', () => {
    const zero = recipe({ ...r, servings: 0 });
    expect(recipePerServing(zero, getIngredient)).toEqual(recipeTotals(r, getIngredient));
  });
});

describe('computeEntryNutrients', () => {
  const oats = ing({ id: 'oats', per100g: { calories: 380, protein: 13 } });
  const bowl = recipe({
    id: 'bowl',
    servings: 2,
    items: [{ ingredientId: 'oats', grams: 200, amount: 200, unit: 'g' }],
  });
  const ctx = {
    getIngredient: (id: string) => (id === 'oats' ? oats : undefined),
    getRecipe: (id: string) => (id === 'bowl' ? bowl : undefined),
  };

  it('multiplies per-serving nutrients by servings for a recipe entry', () => {
    // Whole recipe: 760 kcal / 26 g protein; per serving: 380 / 13.
    expect(computeEntryNutrients({ kind: 'recipe', recipeId: 'bowl', servings: 1.5 }, ctx)).toEqual(
      { calories: 570, protein: 19.5 },
    );
  });

  it('defaults a recipe entry to 1 serving', () => {
    expect(computeEntryNutrients({ kind: 'recipe', recipeId: 'bowl' }, ctx)).toEqual({
      calories: 380,
      protein: 13,
    });
  });

  it('returns {} when the recipe no longer exists', () => {
    expect(computeEntryNutrients({ kind: 'recipe', recipeId: 'gone', servings: 2 }, ctx)).toEqual(
      {},
    );
  });

  it('scales an ingredient entry by grams', () => {
    expect(
      computeEntryNutrients({ kind: 'ingredient', ingredientId: 'oats', grams: 50 }, ctx),
    ).toEqual({ calories: 190, protein: 6.5 });
  });

  it('returns {} for an ingredient entry with no grams', () => {
    expect(computeEntryNutrients({ kind: 'ingredient', ingredientId: 'oats' }, ctx)).toEqual({
      calories: 0,
      protein: 0,
    });
  });

  it('passes quick-add nutrients straight through', () => {
    expect(
      computeEntryNutrients({ kind: 'quick', nutrients: { calories: 250, fat: 9 } }, ctx),
    ).toEqual({ calories: 250, fat: 9 });
    expect(computeEntryNutrients({ kind: 'quick' }, ctx)).toEqual({});
  });

  it('returns {} for water entries', () => {
    expect(computeEntryNutrients({ kind: 'water' }, ctx)).toEqual({});
  });
});

describe('resolveEntryNutrients', () => {
  const oats = ing({ id: 'oats', per100g: { calories: 380, protein: 13 } });
  const ctx = {
    getIngredient: (id: string) => (id === 'oats' ? oats : undefined),
    getRecipe: () => undefined,
  };

  it('prefers the stored snapshot over live computation', () => {
    // The live ingredient would resolve to 380 kcal, but the snapshot wins.
    const e = entry({
      kind: 'ingredient',
      ingredientId: 'oats',
      grams: 100,
      nutrients: { calories: 999, protein: 1 },
    });
    expect(resolveEntryNutrients(e, ctx)).toEqual({ calories: 999, protein: 1 });
  });

  it('keeps recipe history stable when the recipe was deleted', () => {
    const e = entry({
      kind: 'recipe',
      recipeId: 'deleted-recipe',
      servings: 2,
      nutrients: { calories: 512, protein: 20 },
    });
    expect(resolveEntryNutrients(e, ctx)).toEqual({ calories: 512, protein: 20 });
  });

  it('falls back to live computation for pre-snapshot entries', () => {
    const e = entry({ kind: 'ingredient', ingredientId: 'oats', grams: 50 });
    expect(resolveEntryNutrients(e, ctx)).toEqual({ calories: 190, protein: 6.5 });
  });

  it('returns {} for water even if a snapshot is present', () => {
    const e = entry({ kind: 'water', waterMl: 250, nutrients: { calories: 999 } });
    expect(resolveEntryNutrients(e, ctx)).toEqual({});
  });

  it('treats an empty {} snapshot as authoritative (no live fallback)', () => {
    // NOTE: `entry.nutrients` is truthiness-checked, and {} is truthy — so an
    // empty snapshot short-circuits live computation. Documents current behavior.
    const e = entry({ kind: 'ingredient', ingredientId: 'oats', grams: 100, nutrients: {} });
    expect(resolveEntryNutrients(e, ctx)).toEqual({});
  });
});

describe('totalForEntries', () => {
  it('sums resolved nutrients across a set of entries', () => {
    const entries = [
      entry({ id: 'a', kind: 'quick', nutrients: { calories: 100, protein: 4.4 } }),
      entry({ id: 'b', kind: 'quick', nutrients: { calories: 200, protein: 5.5 } }),
      entry({ id: 'c', kind: 'water', waterMl: 500 }),
    ];
    expect(totalForEntries(entries, noCtx)).toEqual({ calories: 300, protein: 9.9 });
  });
});

describe('totalWater', () => {
  it('counts only water entries', () => {
    const entries = [
      entry({ id: 'a', kind: 'water', waterMl: 250 }),
      entry({ id: 'b', kind: 'water', waterMl: 500 }),
      entry({ id: 'c', kind: 'quick', nutrients: { calories: 100 } }),
      entry({ id: 'd', kind: 'water' }), // missing ml counts as 0
    ];
    expect(totalWater(entries)).toBe(750);
  });

  it('returns 0 for no entries', () => {
    expect(totalWater([])).toBe(0);
  });
});

describe('recipeCost', () => {
  const priced = ing({ id: 'priced', price: { amount: 5, grams: 500 } });
  const unpriced = ing({ id: 'unpriced' });
  const zeroBasis = ing({ id: 'zero-basis', price: { amount: 3, grams: 0 } });
  const getIngredient = (id: string) => [priced, unpriced, zeroBasis].find((i) => i.id === id);

  it('returns null when no ingredient carries a price', () => {
    const r = recipe({ items: [{ ingredientId: 'unpriced', grams: 100, amount: 100, unit: 'g' }] });
    expect(recipeCost(r, getIngredient)).toBeNull();
  });

  it('ignores prices with a zero-gram basis (and returns null if none remain)', () => {
    const r = recipe({
      items: [{ ingredientId: 'zero-basis', grams: 100, amount: 100, unit: 'g' }],
    });
    expect(recipeCost(r, getIngredient)).toBeNull();
  });

  it('produces a lower-bound estimate when only some items are priced', () => {
    const r = recipe({
      servings: 4,
      items: [
        { ingredientId: 'priced', grams: 100, amount: 100, unit: 'g' }, // 100/500 * 5 = 1.00
        { ingredientId: 'unpriced', grams: 300, amount: 300, unit: 'g' },
      ],
    });
    expect(recipeCost(r, getIngredient)).toEqual({
      total: 1,
      perServing: 0.25,
      pricedItems: 1,
      totalItems: 2,
    });
  });

  it('sums every priced item and rounds to 2 decimals', () => {
    const r = recipe({
      servings: 3,
      items: [
        { ingredientId: 'priced', grams: 100, amount: 100, unit: 'g' }, // 1.00
        { ingredientId: 'priced', grams: 33, amount: 33, unit: 'g' }, // 0.33
      ],
    });
    expect(recipeCost(r, getIngredient)).toEqual({
      total: 1.33,
      perServing: 0.44, // 1.33 / 3 = 0.443...
      pricedItems: 2,
      totalItems: 2,
    });
  });

  it('guards servings=0 by dividing by 1', () => {
    const r = recipe({
      servings: 0,
      items: [{ ingredientId: 'priced', grams: 200, amount: 200, unit: 'g' }],
    });
    expect(recipeCost(r, getIngredient)).toEqual({
      total: 2,
      perServing: 2,
      pricedItems: 1,
      totalItems: 1,
    });
  });
});
