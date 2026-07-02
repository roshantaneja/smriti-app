// Weekly plan math: week boundaries (Monday-start), grocery aggregation with
// cost estimation, list totals, and per-day planned nutrients.
//
// Jest APIs are imported from @jest/globals because this project's TypeScript
// (6.x) no longer auto-includes @types packages and tsconfig sets no `types`.

import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  aggregateGroceries,
  formatGrams,
  groceryKey,
  groceryTotals,
  planDayNutrients,
  weekDays,
  weekStart,
} from '../grocery';
import type { Ingredient, PlanEntry, Recipe } from '../types';

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

const planEntry = (over: Partial<PlanEntry> = {}): PlanEntry => ({
  id: 'plan-1',
  date: '2026-06-29',
  meal: 'dinner',
  kind: 'recipe',
  ...over,
});

// Shared fixtures: a Mon 2026-06-29 → Sun 2026-07-05 week.
const WEEK = '2026-06-29';

const chicken = ing({
  id: 'chicken',
  name: 'Chicken breast',
  category: 'Meat',
  per100g: { calories: 165, protein: 31 },
  price: { amount: 8, grams: 1000 },
});
const rice = ing({
  id: 'rice',
  name: 'Rice',
  category: 'Grains',
  per100g: { calories: 360, protein: 7 },
  price: { amount: 2, grams: 500 },
});
const basil = ing({
  id: 'basil',
  name: 'Basil',
  category: 'Produce',
  per100g: { calories: 23, protein: 3.2 },
  // no price
});

const bowl = recipe({
  id: 'bowl',
  name: 'Chicken bowl',
  servings: 4,
  items: [
    { ingredientId: 'chicken', grams: 400, amount: 400, unit: 'g' },
    { ingredientId: 'rice', grams: 300, amount: 300, unit: 'g' },
  ],
});
const salad = recipe({
  id: 'salad',
  name: 'Chicken salad',
  servings: 2,
  items: [
    { ingredientId: 'chicken', grams: 200, amount: 200, unit: 'g' },
    { ingredientId: 'basil', grams: 50, amount: 50, unit: 'g' },
  ],
});

const getIngredient = (id: string) => [chicken, rice, basil].find((i) => i.id === id);
const getRecipe = (id: string) => [bowl, salad].find((r) => r.id === id);

describe('addDays', () => {
  it('shifts forward across a month boundary', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });

  it('shifts backward', () => {
    expect(addDays('2026-07-01', -2)).toBe('2026-06-29');
  });
});

describe('weekStart', () => {
  it('returns the Monday of a mid-week date', () => {
    // 2026-07-01 is a Wednesday.
    expect(weekStart('2026-07-01')).toBe('2026-06-29');
  });

  it('maps Sunday to the Monday six days earlier (Mon–Sun weeks)', () => {
    // 2026-07-05 is a Sunday: it belongs to the week that began 2026-06-29,
    // not the one starting 2026-07-06.
    expect(weekStart('2026-07-05')).toBe('2026-06-29');
  });

  it('is a fixed point for Mondays', () => {
    expect(weekStart('2026-06-29')).toBe('2026-06-29');
  });

  it('crosses a year boundary', () => {
    // 2026-01-01 is a Thursday; its Monday is 2025-12-29.
    expect(weekStart('2026-01-01')).toBe('2025-12-29');
  });
});

describe('weekDays', () => {
  it('lists the 7 days from the start, across a month boundary', () => {
    expect(weekDays('2026-06-29')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ]);
  });
});

describe('groceryKey', () => {
  it('scopes the checklist key to the week', () => {
    expect(groceryKey('2026-06-29', 'chicken')).toBe('2026-06-29:chicken');
  });
});

describe('aggregateGroceries', () => {
  it('scales recipe items by planned servings over recipe servings', () => {
    // 2 of the bowl's 4 servings -> half of every item.
    const plan = [planEntry({ recipeId: 'bowl', servings: 2 })];
    const lines = aggregateGroceries(plan, WEEK, getIngredient, getRecipe);
    expect(lines).toEqual([
      // Sorted by category: Grains before Meat.
      {
        key: '2026-06-29:rice',
        ingredientId: 'rice',
        name: 'Rice',
        category: 'Grains',
        totalGrams: 150,
        estCost: 0.6, // 150/500 * 2
      },
      {
        key: '2026-06-29:chicken',
        ingredientId: 'chicken',
        name: 'Chicken breast',
        category: 'Meat',
        totalGrams: 200,
        estCost: 1.6, // 200/1000 * 8
      },
    ]);
  });

  it('sums the same ingredient across recipes and direct entries', () => {
    const plan = [
      planEntry({ id: 'p1', recipeId: 'bowl', servings: 4 }), // chicken 400
      planEntry({ id: 'p2', date: '2026-07-01', recipeId: 'salad', servings: 2 }), // chicken 200
      planEntry({ id: 'p3', date: '2026-07-02', kind: 'ingredient', ingredientId: 'chicken', grams: 100 }),
    ];
    const lines = aggregateGroceries(plan, WEEK, getIngredient, getRecipe);
    const chickenLine = lines.find((l) => l.ingredientId === 'chicken');
    expect(chickenLine).toEqual({
      key: '2026-06-29:chicken',
      ingredientId: 'chicken',
      name: 'Chicken breast',
      category: 'Meat',
      totalGrams: 700,
      estCost: 5.6, // 700/1000 * 8
    });
  });

  it('leaves estCost undefined for unpriced ingredients', () => {
    const plan = [planEntry({ recipeId: 'salad', servings: 2 })];
    const lines = aggregateGroceries(plan, WEEK, getIngredient, getRecipe);
    const basilLine = lines.find((l) => l.ingredientId === 'basil');
    expect(basilLine?.totalGrams).toBe(50);
    expect(basilLine?.estCost).toBeUndefined();
  });

  it('excludes leftover entries — that food was already cooked', () => {
    const plan = [
      planEntry({ id: 'p1', recipeId: 'bowl', servings: 2 }),
      planEntry({ id: 'p2', date: '2026-06-30', meal: 'lunch', recipeId: 'bowl', servings: 2, leftover: true }),
    ];
    const lines = aggregateGroceries(plan, WEEK, getIngredient, getRecipe);
    // Only the non-leftover half of the bowl is shopped for.
    expect(lines.find((l) => l.ingredientId === 'chicken')?.totalGrams).toBe(200);
  });

  it('excludes entries outside the week', () => {
    const plan = [
      planEntry({ id: 'p1', date: '2026-06-28', recipeId: 'bowl', servings: 4 }), // Sunday before
      planEntry({ id: 'p2', date: '2026-07-06', recipeId: 'bowl', servings: 4 }), // Monday after
    ];
    expect(aggregateGroceries(plan, WEEK, getIngredient, getRecipe)).toEqual([]);
  });

  it('skips plan entries whose recipe no longer exists', () => {
    const plan = [planEntry({ recipeId: 'gone', servings: 2 })];
    expect(aggregateGroceries(plan, WEEK, getIngredient, getRecipe)).toEqual([]);
  });

  it('guards recipe servings=0 by treating it as 1', () => {
    const zero = recipe({
      id: 'zero',
      servings: 0,
      items: [{ ingredientId: 'chicken', grams: 100, amount: 100, unit: 'g' }],
    });
    const plan = [planEntry({ recipeId: 'zero', servings: 1 })];
    const lines = aggregateGroceries(plan, WEEK, getIngredient, (id) =>
      id === 'zero' ? zero : undefined,
    );
    expect(lines[0]?.totalGrams).toBe(100);
  });

  it('sorts by category then name', () => {
    const plan = [
      planEntry({ id: 'p1', kind: 'ingredient', ingredientId: 'basil', grams: 20 }),
      planEntry({ id: 'p2', kind: 'ingredient', ingredientId: 'chicken', grams: 100 }),
      planEntry({ id: 'p3', kind: 'ingredient', ingredientId: 'rice', grams: 100 }),
    ];
    const lines = aggregateGroceries(plan, WEEK, getIngredient, getRecipe);
    expect(lines.map((l) => l.ingredientId)).toEqual(['rice', 'chicken', 'basil']);
  });
});

describe('groceryTotals', () => {
  it('sums priced lines and counts coverage', () => {
    const lines = aggregateGroceries(
      [
        planEntry({ id: 'p1', recipeId: 'bowl', servings: 2 }), // rice 0.60 + chicken 1.60
        planEntry({ id: 'p2', date: '2026-06-30', kind: 'ingredient', ingredientId: 'basil', grams: 50 }),
      ],
      WEEK,
      getIngredient,
      getRecipe,
    );
    expect(groceryTotals(lines)).toEqual({ totalCost: 2.2, pricedLines: 2, totalLines: 3 });
  });

  it('handles an empty list', () => {
    expect(groceryTotals([])).toEqual({ totalCost: 0, pricedLines: 0, totalLines: 0 });
  });
});

describe('planDayNutrients', () => {
  it('sums recipe servings and direct ingredient grams for one day', () => {
    const plan = [
      // Bowl totals: 1740 kcal / 145 g protein over 4 servings -> 435 / 36.3 each.
      planEntry({ id: 'p1', recipeId: 'bowl', servings: 2 }),
      planEntry({ id: 'p2', meal: 'snack', kind: 'ingredient', ingredientId: 'chicken', grams: 100 }),
    ];
    expect(planDayNutrients(plan, '2026-06-29', getIngredient, getRecipe)).toEqual({
      calories: 1035, // 435*2 + 165
      protein: 103.6, // 36.3*2 + 31
    });
  });

  it('only counts the requested date', () => {
    const plan = [
      planEntry({ id: 'p1', date: '2026-06-29', recipeId: 'bowl', servings: 1 }),
      planEntry({ id: 'p2', date: '2026-06-30', recipeId: 'bowl', servings: 1 }),
    ];
    expect(planDayNutrients(plan, '2026-06-30', getIngredient, getRecipe)).toEqual({
      calories: 435,
      protein: 36.3,
    });
  });

  it('includes leftovers — they are still eaten that day', () => {
    const plan = [planEntry({ recipeId: 'bowl', servings: 1, leftover: true })];
    expect(planDayNutrients(plan, '2026-06-29', getIngredient, getRecipe)).toEqual({
      calories: 435,
      protein: 36.3,
    });
  });

  it('contributes nothing for missing sources or empty days', () => {
    expect(
      planDayNutrients([planEntry({ recipeId: 'gone' })], '2026-06-29', getIngredient, getRecipe),
    ).toEqual({});
    expect(planDayNutrients([], '2026-06-29', getIngredient, getRecipe)).toEqual({});
  });
});

describe('formatGrams', () => {
  it('shows grams below 1 kg', () => {
    expect(formatGrams(450)).toBe('450 g');
    expect(formatGrams(999)).toBe('999 g');
  });

  it('switches to kg at 1000 g with one decimal', () => {
    expect(formatGrams(1000)).toBe('1 kg');
    expect(formatGrams(1250)).toBe('1.3 kg');
    expect(formatGrams(2400)).toBe('2.4 kg');
  });
});
