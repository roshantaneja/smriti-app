// Household-measure <-> grams conversion helpers.

import { describe, expect, it } from '@jest/globals';

import { defaultUnit, toGrams, unitOptions } from '../units';
import type { Ingredient } from '../types';

const ing = (over: Partial<Ingredient> = {}): Ingredient => ({
  id: 'ing-1',
  name: 'Rolled oats',
  category: 'Grains',
  per100g: { calories: 380 },
  portions: [],
  source: 'test',
  ...over,
});

describe('unitOptions', () => {
  it('always lists grams first with a factor of 1', () => {
    const options = unitOptions(
      ing({ portions: [{ unit: 'cup', grams: 90 }, { unit: 'tbsp', grams: 6 }] }),
    );
    expect(options[0]).toEqual({ unit: 'g', grams: 1 });
    expect(options).toEqual([
      { unit: 'g', grams: 1 },
      { unit: 'cup', grams: 90 },
      { unit: 'tbsp', grams: 6 },
    ]);
  });

  it('offers only grams when the ingredient has no portions', () => {
    expect(unitOptions(ing())).toEqual([{ unit: 'g', grams: 1 }]);
  });
});

describe('toGrams', () => {
  const oats = ing({ portions: [{ unit: 'cup', grams: 90 }] });

  it('passes gram amounts through untouched', () => {
    expect(toGrams(oats, 125, 'g')).toBe(125);
  });

  it('multiplies by the portion weight for a known unit', () => {
    expect(toGrams(oats, 2, 'cup')).toBe(180);
    expect(toGrams(oats, 0.5, 'cup')).toBe(45);
  });

  it('falls back to treating the amount as grams for an unknown unit', () => {
    expect(toGrams(oats, 30, 'handful')).toBe(30);
  });
});

describe('defaultUnit', () => {
  it('picks the first household portion when one exists', () => {
    expect(
      defaultUnit(ing({ portions: [{ unit: 'egg', grams: 50 }, { unit: 'cup', grams: 240 }] })),
    ).toBe('egg');
  });

  it('falls back to grams when there are no portions', () => {
    expect(defaultUnit(ing())).toBe('g');
  });
});
