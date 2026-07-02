// Logging-accelerator store actions: snapshot-preserving entry edits, copying
// a day forward, saved-meal templates, and the daily note. Exercised head-lessly
// via useStore.getState(); AsyncStorage is mocked in jest.setup.js.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import mockSeedData from '../../../assets/data/seed-ingredients.json';
import { resolveEntryNutrients } from '../nutrition';
import { useStore } from '../store';
import type { Ingredient, Recipe } from '../types';

// NOTE: same seam as store.test.ts — jest-expo maps tsconfig paths in
// declaration order, so the broad `^@/(.*)$` alias shadows `^@/assets/(.*)$`
// under jest. seed.ts imports '@/assets/data/...', so we feed the REAL seed
// JSON through the seam via a relative import instead.
jest.mock('../seed', () => ({ SEED_INGREDIENTS: mockSeedData }));

const ingredientInput = (over: Partial<Ingredient> = {}): Omit<Ingredient, 'id'> => ({
  name: 'Paneer',
  category: 'Dairy',
  per100g: { calories: 300, protein: 18, fat: 25 },
  portions: [{ unit: 'cube', grams: 15 }],
  source: 'user',
  ...over,
});

const recipeInput = (over: Partial<Recipe> = {}): Omit<Recipe, 'id' | 'createdAt'> => ({
  name: 'Paneer bhurji',
  servings: 2,
  items: [],
  tags: [],
  ...over,
});

beforeEach(() => {
  useStore.setState({
    userIngredients: [],
    recipes: [],
    log: [],
    savedMeals: [],
    notes: {},
  });
});

/** Add a paneer ingredient and log `grams` of it on 2026-07-01 (lunch). */
const logPaneer = (grams = 100) => {
  const ing = useStore.getState().addIngredient(ingredientInput());
  useStore.getState().addLogEntry({
    date: '2026-07-01',
    kind: 'ingredient',
    ingredientId: ing.id,
    grams,
    meal: 'lunch',
  });
  const log = useStore.getState().log;
  return { ing, entry: log[log.length - 1] };
};

describe('updateLogEntry', () => {
  it('rescales the frozen ingredient snapshot linearly when grams change', () => {
    const { entry } = logPaneer(100);
    expect(entry.nutrients).toEqual({ calories: 300, protein: 18, fat: 25 });

    useStore.getState().updateLogEntry(entry.id, { grams: 200 });

    const updated = useStore.getState().log[0];
    expect(updated.grams).toBe(200);
    expect(updated.nutrients).toEqual({ calories: 600, protein: 36, fat: 50 });
  });

  it('rescales a recipe snapshot when servings change', () => {
    const s = useStore.getState();
    const ing = s.addIngredient(ingredientInput());
    const rec = s.addRecipe(
      recipeInput({ items: [{ ingredientId: ing.id, grams: 200, amount: 200, unit: 'g' }] }),
    );
    // Whole recipe: 600 kcal over 2 servings → 300 kcal per serving.
    useStore.getState().addLogEntry({
      date: '2026-07-01',
      kind: 'recipe',
      recipeId: rec.id,
      servings: 1,
      meal: 'dinner',
    });
    const entry = useStore.getState().log[0];
    expect(entry.nutrients).toEqual({ calories: 300, protein: 18, fat: 25 });

    useStore.getState().updateLogEntry(entry.id, { servings: 3 });

    const updated = useStore.getState().log[0];
    expect(updated.servings).toBe(3);
    expect(updated.nutrients).toEqual({ calories: 900, protein: 54, fat: 75 });
  });

  it('moving an entry to another meal leaves portion and snapshot untouched', () => {
    const { entry } = logPaneer(150);
    const before = { ...entry.nutrients };

    useStore.getState().updateLogEntry(entry.id, { meal: 'dinner' });

    const updated = useStore.getState().log[0];
    expect(updated.meal).toBe('dinner');
    expect(updated.grams).toBe(150);
    expect(updated.nutrients).toEqual(before);
  });

  it('patches only the matching entry', () => {
    const { entry: first } = logPaneer(100);
    useStore.getState().addLogEntry({
      date: '2026-07-01',
      kind: 'quick',
      label: 'Chai',
      nutrients: { calories: 120 },
      meal: 'snack',
    });
    const second = useStore.getState().log[1];

    useStore.getState().updateLogEntry(second.id, { label: 'Masala chai' });

    const log = useStore.getState().log;
    expect(log[0]).toEqual(first);
    expect(log[1].label).toBe('Masala chai');
    expect(log[1].nutrients).toEqual({ calories: 120 });
  });
});

describe('copyLogEntries', () => {
  /** 2026-07-01: paneer lunch + quick breakfast + water. */
  const seedDay = () => {
    logPaneer(100);
    useStore.getState().addLogEntry({
      date: '2026-07-01',
      kind: 'quick',
      label: 'Chai',
      nutrients: { calories: 120 },
      meal: 'breakfast',
    });
    useStore.getState().addWater(250, '2026-07-01');
  };

  it('clones a whole day onto the target date with new ids', () => {
    seedDay();
    const before = useStore.getState().log;

    useStore.getState().copyLogEntries('2026-07-01', '2026-07-02');

    const log = useStore.getState().log;
    expect(log).toHaveLength(6);
    const copies = log.filter((e) => e.date === '2026-07-02');
    expect(copies).toHaveLength(3);
    const oldIds = new Set(before.map((e) => e.id));
    for (const c of copies) expect(oldIds.has(c.id)).toBe(false);
    // Content (meal, portion, snapshot) is preserved — only id/date/createdAt are new.
    expect(copies.find((e) => e.kind === 'ingredient')).toMatchObject({
      meal: 'lunch',
      grams: 100,
      nutrients: { calories: 300, protein: 18, fat: 25 },
    });
    expect(copies.find((e) => e.kind === 'water')).toMatchObject({ waterMl: 250 });
  });

  it('copies only the requested meal', () => {
    seedDay();

    useStore.getState().copyLogEntries('2026-07-01', '2026-07-02', 'breakfast');

    const copies = useStore.getState().log.filter((e) => e.date === '2026-07-02');
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ kind: 'quick', label: 'Chai', meal: 'breakfast' });
  });

  it('is a no-op when the source day has no entries', () => {
    seedDay();
    const before = useStore.getState().log;

    useStore.getState().copyLogEntries('2026-06-30', '2026-07-02');

    expect(useStore.getState().log).toEqual(before);
  });
});

describe('saved meals', () => {
  it('addSavedMeal stores the named template and returns it', () => {
    const meal = useStore.getState().addSavedMeal('Usual breakfast', [
      { kind: 'quick', label: 'Chai', nutrients: { calories: 120 } },
    ]);
    expect(meal.id).toEqual(expect.stringContaining('meal-'));
    expect(meal.name).toBe('Usual breakfast');
    expect(useStore.getState().savedMeals).toEqual([meal]);
  });

  it('deleteSavedMeal removes only the matching template', () => {
    const a = useStore.getState().addSavedMeal('A', []);
    const b = useStore.getState().addSavedMeal('B', []);
    useStore.getState().deleteSavedMeal(a.id);
    expect(useStore.getState().savedMeals).toEqual([b]);
  });

  it('logSavedMeal expands every item onto the date + meal, snapshotting as it logs', () => {
    const s = useStore.getState();
    const ing = s.addIngredient(ingredientInput());
    const rec = s.addRecipe(
      recipeInput({ items: [{ ingredientId: ing.id, grams: 200, amount: 200, unit: 'g' }] }),
    );
    const meal = useStore.getState().addSavedMeal('Dinner combo', [
      { kind: 'ingredient', ingredientId: ing.id, grams: 50 },
      { kind: 'recipe', recipeId: rec.id, servings: 2 },
      { kind: 'quick', label: 'Chai', nutrients: { calories: 120 } },
    ]);

    useStore.getState().logSavedMeal(meal.id, '2026-07-02', 'dinner');

    const log = useStore.getState().log;
    expect(log).toHaveLength(3);
    for (const e of log) expect(e).toMatchObject({ date: '2026-07-02', meal: 'dinner' });
    expect(log.find((e) => e.kind === 'ingredient')).toMatchObject({
      label: 'Paneer',
      nutrients: { calories: 150, protein: 9, fat: 12.5 },
    });
    expect(log.find((e) => e.kind === 'recipe')).toMatchObject({
      label: 'Paneer bhurji',
      nutrients: { calories: 600, protein: 36, fat: 50 },
    });
    // Quick items carry their nutrients as given.
    expect(log.find((e) => e.kind === 'quick')).toMatchObject({
      label: 'Chai',
      nutrients: { calories: 120 },
    });
  });

  it('ingredient items are snapshotted at log time, so later edits do not rewrite the log', () => {
    const ing = useStore.getState().addIngredient(ingredientInput());
    const meal = useStore
      .getState()
      .addSavedMeal('Paneer snack', [{ kind: 'ingredient', ingredientId: ing.id, grams: 100 }]);
    useStore.getState().logSavedMeal(meal.id, '2026-07-02', 'snack');

    useStore.getState().updateIngredient(ing.id, { per100g: { calories: 999 } });

    const entry = useStore.getState().log[0];
    const { getIngredient, getRecipe } = useStore.getState();
    expect(resolveEntryNutrients(entry, { getIngredient, getRecipe })).toEqual({
      calories: 300,
      protein: 18,
      fat: 25,
    });
  });

  it('logSavedMeal does nothing for an unknown id', () => {
    useStore.getState().logSavedMeal('meal-nope', '2026-07-02', 'lunch');
    expect(useStore.getState().log).toEqual([]);
  });
});

describe('setNote', () => {
  it('sets and overwrites the note for a day', () => {
    useStore.getState().setNote('2026-07-02', 'Felt great after lunch');
    expect(useStore.getState().notes['2026-07-02']).toBe('Felt great after lunch');

    useStore.getState().setNote('2026-07-02', 'Too much chai');
    expect(useStore.getState().notes['2026-07-02']).toBe('Too much chai');
  });

  it('clears the note when the text is empty or whitespace', () => {
    useStore.getState().setNote('2026-07-02', 'x');
    useStore.getState().setNote('2026-07-02', '');
    expect(useStore.getState().notes).toEqual({});

    useStore.getState().setNote('2026-07-03', 'keep?');
    useStore.getState().setNote('2026-07-03', '   ');
    expect(useStore.getState().notes['2026-07-03']).toBeUndefined();
  });

  it('leaves other days untouched when one is cleared', () => {
    useStore.getState().setNote('2026-07-01', 'a');
    useStore.getState().setNote('2026-07-02', 'b');
    useStore.getState().setNote('2026-07-01', '');
    expect(useStore.getState().notes).toEqual({ '2026-07-02': 'b' });
  });
});
