// Zustand store behavior, exercised head-lessly via useStore.getState().
// AsyncStorage is mocked in jest.setup.js, so persistence is inert here.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import mockSeedData from '../../../assets/data/seed-ingredients.json';
import { resolveEntryNutrients } from '../nutrition';
import { useStore } from '../store';
import type { Goals, Ingredient, Recipe } from '../types';

// NOTE: jest-expo maps tsconfig paths in declaration order, so the broad
// `^@/(.*)$` alias shadows `^@/assets/(.*)$` under jest (Metro resolves the
// more specific alias fine). seed.ts imports '@/assets/data/...', so we feed
// the REAL seed JSON through the seam via a relative import instead. The
// `mock`-prefixed variable is legal in the hoisted factory because the mock
// is only instantiated after imports have initialized.
jest.mock('../seed', () => ({ SEED_INGREDIENTS: mockSeedData }));

const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 120,
  carbs: 220,
  fat: 65,
  fiber: 30,
  waterMl: 2500,
};

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
    hasOnboarded: false,
    userIngredients: [],
    recipes: [],
    log: [],
    goals: { ...DEFAULT_GOALS },
    settings: { usdaApiKey: '' },
  });
});

describe('ingredients', () => {
  it('addIngredient generates an id, returns the ingredient, and stores it', () => {
    const ing = useStore.getState().addIngredient(ingredientInput());
    expect(ing.id).toEqual(expect.stringContaining('ing-'));
    expect(ing.name).toBe('Paneer');
    expect(useStore.getState().userIngredients).toEqual([ing]);
  });

  it('addIngredient respects a caller-provided id', () => {
    const ing = useStore.getState().addIngredient({ ...ingredientInput(), id: 'custom-1' });
    expect(ing.id).toBe('custom-1');
  });

  it('updateIngredient patches only the matching ingredient', () => {
    const a = useStore.getState().addIngredient(ingredientInput({ name: 'A' }));
    const b = useStore.getState().addIngredient(ingredientInput({ name: 'B' }));
    useStore.getState().updateIngredient(a.id, { name: 'A2', category: 'Test' });
    const list = useStore.getState().userIngredients;
    expect(list.find((i) => i.id === a.id)).toMatchObject({ name: 'A2', category: 'Test' });
    expect(list.find((i) => i.id === b.id)?.name).toBe('B');
  });

  it('deleteIngredient removes the ingredient', () => {
    const ing = useStore.getState().addIngredient(ingredientInput());
    useStore.getState().deleteIngredient(ing.id);
    expect(useStore.getState().userIngredients).toEqual([]);
  });
});

describe('recipes', () => {
  it('addRecipe generates id + createdAt and stores it', () => {
    const rec = useStore.getState().addRecipe(recipeInput());
    expect(rec.id).toEqual(expect.stringContaining('rec-'));
    expect(new Date(rec.createdAt).getTime()).not.toBeNaN();
    expect(useStore.getState().recipes).toEqual([rec]);
  });

  it('updateRecipe patches the matching recipe', () => {
    const rec = useStore.getState().addRecipe(recipeInput());
    useStore.getState().updateRecipe(rec.id, { servings: 6, rating: 5 });
    expect(useStore.getState().getRecipe(rec.id)).toMatchObject({ servings: 6, rating: 5 });
  });

  it('deleteRecipe removes the recipe', () => {
    const rec = useStore.getState().addRecipe(recipeInput());
    useStore.getState().deleteRecipe(rec.id);
    expect(useStore.getState().recipes).toEqual([]);
    expect(useStore.getState().getRecipe(rec.id)).toBeUndefined();
  });
});

describe('getIngredient', () => {
  it('finds seed ingredients without them being persisted state', () => {
    expect(useStore.getState().userIngredients).toEqual([]);
    const seed = useStore.getState().getIngredient('usda-170899');
    expect(seed?.name).toBe('Cheddar cheese');
    expect(seed?.source).toContain('USDA');
  });

  it('finds user ingredients', () => {
    const ing = useStore.getState().addIngredient(ingredientInput());
    expect(useStore.getState().getIngredient(ing.id)).toEqual(ing);
  });

  it('prefers the seed ingredient on an id collision', () => {
    useStore.getState().addIngredient({ ...ingredientInput({ name: 'Fake cheddar' }), id: 'usda-170899' });
    expect(useStore.getState().getIngredient('usda-170899')?.name).toBe('Cheddar cheese');
  });

  it('returns undefined for an unknown id', () => {
    expect(useStore.getState().getIngredient('nope')).toBeUndefined();
  });
});

describe('addLogEntry snapshotting', () => {
  it('freezes recipe nutrients and label at log time, surviving recipe deletion', () => {
    const s = useStore.getState();
    const ing = s.addIngredient(ingredientInput({ per100g: { calories: 300, protein: 18 } }));
    const rec = s.addRecipe(
      recipeInput({
        name: 'Paneer bhurji',
        servings: 2,
        items: [{ ingredientId: ing.id, grams: 200, amount: 200, unit: 'g' }],
      }),
    );
    // Whole recipe: 600 kcal / 36 g protein; 1 serving = 300 / 18.
    useStore.getState().addLogEntry({
      date: '2026-07-01',
      kind: 'recipe',
      recipeId: rec.id,
      servings: 1,
      meal: 'dinner',
    });

    const entry = useStore.getState().log[0];
    expect(entry.nutrients).toEqual({ calories: 300, protein: 18 });
    expect(entry.label).toBe('Paneer bhurji');

    // Delete the source recipe — history must not change.
    useStore.getState().deleteRecipe(rec.id);
    const { getIngredient, getRecipe } = useStore.getState();
    expect(resolveEntryNutrients(entry, { getIngredient, getRecipe })).toEqual({
      calories: 300,
      protein: 18,
    });
    expect(entry.label).toBe('Paneer bhurji');
  });

  it('snapshots ingredient entries with the ingredient name as label', () => {
    const ing = useStore.getState().addIngredient(ingredientInput({ name: 'Paneer' }));
    useStore.getState().addLogEntry({
      date: '2026-07-01',
      kind: 'ingredient',
      ingredientId: ing.id,
      grams: 50,
      meal: 'lunch',
    });
    const entry = useStore.getState().log[0];
    expect(entry.nutrients).toEqual({ calories: 150, protein: 9, fat: 12.5 });
    expect(entry.label).toBe('Paneer');
  });

  it('stores quick entries as given', () => {
    useStore.getState().addLogEntry({
      date: '2026-07-01',
      kind: 'quick',
      label: 'Chai',
      nutrients: { calories: 120 },
    });
    const entry = useStore.getState().log[0];
    expect(entry).toMatchObject({ kind: 'quick', label: 'Chai', nutrients: { calories: 120 } });
    expect(entry.id).toEqual(expect.stringContaining('log-'));
  });
});

describe('water + log deletion', () => {
  it('addWater appends a water entry for the given date', () => {
    useStore.getState().addWater(250, '2026-07-01');
    const entry = useStore.getState().log[0];
    expect(entry).toMatchObject({ kind: 'water', waterMl: 250, date: '2026-07-01' });
  });

  it('addWater defaults to today (YYYY-MM-DD)', () => {
    useStore.getState().addWater(500);
    expect(useStore.getState().log[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('deleteLogEntry removes only the matching entry', () => {
    useStore.getState().addWater(250, '2026-07-01');
    useStore.getState().addWater(500, '2026-07-01');
    const [first, second] = useStore.getState().log;
    useStore.getState().deleteLogEntry(first.id);
    expect(useStore.getState().log).toEqual([second]);
  });
});

describe('goals', () => {
  it('setGoals patches individual fields, keeping the rest', () => {
    useStore.getState().setGoals({ protein: 150 });
    expect(useStore.getState().goals).toEqual({ ...DEFAULT_GOALS, protein: 150 });
  });

  it('setPreset replaces the whole goal set', () => {
    const preset: Goals = { calories: 1800, protein: 120, carbs: 30, fat: 133, fiber: 20, waterMl: 3000 };
    useStore.getState().setPreset(preset);
    expect(useStore.getState().goals).toEqual(preset);
  });
});

describe('settings + reset', () => {
  it('setUsdaApiKey updates the settings slice', () => {
    useStore.getState().setUsdaApiKey('DEMO_KEY');
    expect(useStore.getState().settings.usdaApiKey).toBe('DEMO_KEY');
  });

  it('setHasOnboarded flips the onboarding flag', () => {
    useStore.getState().setHasOnboarded(true);
    expect(useStore.getState().hasOnboarded).toBe(true);
  });

  it('resetData clears user data and restores default goals, but keeps settings and onboarding', () => {
    const s = useStore.getState();
    s.addIngredient(ingredientInput());
    s.addRecipe(recipeInput());
    s.addWater(250);
    s.setGoals({ calories: 1234 });
    s.setUsdaApiKey('DEMO_KEY');
    s.setHasOnboarded(true);

    useStore.getState().resetData();

    const after = useStore.getState();
    expect(after.userIngredients).toEqual([]);
    expect(after.recipes).toEqual([]);
    expect(after.log).toEqual([]);
    expect(after.goals).toEqual(DEFAULT_GOALS);
    expect(after.settings.usdaApiKey).toBe('DEMO_KEY');
    expect(after.hasOnboarded).toBe(true);
  });
});
