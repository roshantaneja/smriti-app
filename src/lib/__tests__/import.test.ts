// External-source mappers: Open Food Facts products and USDA FoodData Central
// search results -> Ingredient drafts (per 100 g).

import { describe, expect, it } from '@jest/globals';

import { offProductToIngredient, usdaFoodToIngredient } from '../import';

describe('offProductToIngredient', () => {
  // Realistic OFF v2 `product` payload: macros in grams per 100 g, minerals and
  // vitamins in GRAMS per 100 g (the mapper must convert those to mg).
  const offProduct = () => ({
    code: '0089686170023',
    product_name: 'Greek Yogurt',
    brands: 'Fage, Fage USA',
    serving_quantity: '170',
    nutriments: {
      'energy-kcal_100g': 59,
      proteins_100g: 10.2,
      carbohydrates_100g: 3.6,
      fat_100g: 0.4,
      fiber_100g: 0.5,
      sugars_100g: 3.2,
      'saturated-fat_100g': 0.1,
      sodium_100g: 0.036, // grams -> 36 mg
      calcium_100g: 0.11, // grams -> 110 mg
      iron_100g: 0.0004, // grams -> 0.4 mg
      potassium_100g: 0.141, // grams -> 141 mg
      'vitamin-c_100g': 0.0005, // grams -> 0.5 mg
    },
  });

  it('maps macros per 100 g directly', () => {
    const draft = offProductToIngredient(offProduct())!;
    expect(draft).not.toBeNull();
    expect(draft.per100g).toMatchObject({
      calories: 59,
      protein: 10.2,
      carbs: 3.6,
      fat: 0.4,
      fiber: 0.5,
      sugar: 3.2,
      saturatedFat: 0.1,
    });
  });

  it('converts minerals and vitamin C from grams to mg (x1000)', () => {
    const draft = offProductToIngredient(offProduct())!;
    expect(draft.per100g).toMatchObject({
      sodium: 36,
      calcium: 110,
      iron: 0.4,
      potassium: 141,
      vitaminC: 0.5,
    });
  });

  it('appends the first brand to the name and uses it as the category', () => {
    const draft = offProductToIngredient(offProduct())!;
    expect(draft.name).toBe('Greek Yogurt (Fage)');
    expect(draft.category).toBe('Fage');
    expect(draft.source).toBe('Open Food Facts');
  });

  it('falls back to the "Packaged" category when there is no brand', () => {
    const product = { ...offProduct(), brands: undefined };
    const draft = offProductToIngredient(product)!;
    expect(draft.name).toBe('Greek Yogurt');
    expect(draft.category).toBe('Packaged');
  });

  it('captures the barcode from `code`', () => {
    expect(offProductToIngredient(offProduct())!.barcode).toBe('0089686170023');
  });

  it('adds a "serving" portion from serving_quantity', () => {
    expect(offProductToIngredient(offProduct())!.portions).toEqual([
      { unit: 'serving', grams: 170 },
    ]);
  });

  it('adds no portion when serving_quantity is missing or unusable', () => {
    expect(
      offProductToIngredient({ ...offProduct(), serving_quantity: undefined })!.portions,
    ).toEqual([]);
    expect(
      offProductToIngredient({ ...offProduct(), serving_quantity: 'about a cup' })!.portions,
    ).toEqual([]);
  });

  it('drops zero and negative nutrient values', () => {
    const product = offProduct();
    product.nutriments.fiber_100g = 0;
    product.nutriments.sugars_100g = -1;
    const draft = offProductToIngredient(product)!;
    expect(draft.per100g.fiber).toBeUndefined();
    expect(draft.per100g.sugar).toBeUndefined();
    expect(draft.per100g.protein).toBe(10.2); // others survive
  });

  it('returns null when the product has no name', () => {
    expect(offProductToIngredient({ ...offProduct(), product_name: '  ' })).toBeNull();
  });

  it('falls back through product_name_en and generic_name for the name', () => {
    const product = { ...offProduct(), product_name: undefined, generic_name: 'Strained yogurt' };
    expect(offProductToIngredient(product)!.name).toBe('Strained yogurt (Fage)');
  });

  it('returns null when there are no usable nutrients', () => {
    expect(offProductToIngredient({ ...offProduct(), nutriments: {} })).toBeNull();
    expect(offProductToIngredient({ ...offProduct(), nutriments: undefined })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(offProductToIngredient(null)).toBeNull();
    expect(offProductToIngredient(undefined)).toBeNull();
    expect(offProductToIngredient('yogurt')).toBeNull();
  });
});

describe('usdaFoodToIngredient', () => {
  // Realistic `/foods/search` result: nutrients already per 100 g in their
  // standard units (kcal, g, mg), keyed by USDA nutrient IDs.
  const usdaFood = () => ({
    fdcId: 170899,
    description: 'CHEESE, CHEDDAR, SHARP',
    foodCategory: 'Dairy and Egg Products',
    servingSize: 28,
    servingSizeUnit: 'g',
    householdServingFullText: '1 slice',
    foodNutrients: [
      { nutrientId: 1008, value: 403 }, // calories (kcal)
      { nutrientId: 1003, value: 22.9 }, // protein (g)
      { nutrientId: 1004, value: 33.3 }, // fat (g)
      { nutrientId: 1005, value: 3.37 }, // carbs (g)
      { nutrientId: 1079, value: 0.4 }, // fiber (g)
      { nutrientId: 1093, value: 653 }, // sodium (mg)
      { nutrientId: 1087, value: 710 }, // calcium (mg)
      { nutrientId: 9999, value: 42 }, // unknown ID — ignored
    ],
  });

  it('maps nutrient IDs onto the canonical per-100g profile', () => {
    const draft = usdaFoodToIngredient(usdaFood())!;
    expect(draft).not.toBeNull();
    expect(draft.per100g).toEqual({
      calories: 403,
      protein: 22.9,
      fat: 33.3,
      carbs: 3.4, // 3.37 rounded to 1 decimal
      fiber: 0.4,
      sodium: 653,
      calcium: 710,
    });
  });

  it('Title-cases the ALL-CAPS description and keeps the original as fdcDescription', () => {
    const draft = usdaFoodToIngredient(usdaFood())!;
    expect(draft.name).toBe('Cheese, cheddar, sharp');
    expect(draft.fdcDescription).toBe('CHEESE, CHEDDAR, SHARP');
  });

  it('sets fdcId, category, and source', () => {
    const draft = usdaFoodToIngredient(usdaFood())!;
    expect(draft.fdcId).toBe(170899);
    expect(draft.category).toBe('Dairy and Egg Products');
    expect(draft.source).toBe('USDA FoodData Central');
  });

  it('defaults the category to "USDA" when missing', () => {
    expect(usdaFoodToIngredient({ ...usdaFood(), foodCategory: undefined })!.category).toBe(
      'USDA',
    );
  });

  it('builds a portion from the household serving when the serving unit is grams', () => {
    expect(usdaFoodToIngredient(usdaFood())!.portions).toEqual([{ unit: '1 slice', grams: 28 }]);
  });

  it('labels the portion "serving" when there is no household text', () => {
    const food = { ...usdaFood(), householdServingFullText: undefined };
    expect(usdaFoodToIngredient(food)!.portions).toEqual([{ unit: 'serving', grams: 28 }]);
  });

  it('adds no portion when the serving unit is not grams', () => {
    const food = { ...usdaFood(), servingSizeUnit: 'ml' };
    expect(usdaFoodToIngredient(food)!.portions).toEqual([]);
  });

  it('supports the nested nutrient.id / amount shape', () => {
    const food = {
      description: 'BANANA',
      foodNutrients: [{ nutrient: { id: 1008 }, amount: 89 }],
    };
    expect(usdaFoodToIngredient(food)!.per100g).toEqual({ calories: 89 });
  });

  it('drops zero and negative nutrient values', () => {
    const food = {
      description: 'WATERCRESS',
      foodNutrients: [
        { nutrientId: 1008, value: 11 },
        { nutrientId: 1004, value: 0 },
        { nutrientId: 1005, value: -2 },
      ],
    };
    const draft = usdaFoodToIngredient(food)!;
    expect(draft.per100g).toEqual({ calories: 11 });
  });

  it('returns null when the description is missing', () => {
    expect(usdaFoodToIngredient({ ...usdaFood(), description: '   ' })).toBeNull();
  });

  it('returns null when no recognized nutrients remain', () => {
    expect(
      usdaFoodToIngredient({ description: 'MYSTERY', foodNutrients: [{ nutrientId: 9999, value: 1 }] }),
    ).toBeNull();
    expect(usdaFoodToIngredient({ description: 'MYSTERY' })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(usdaFoodToIngredient(null)).toBeNull();
    expect(usdaFoodToIngredient(undefined)).toBeNull();
    expect(usdaFoodToIngredient(42)).toBeNull();
  });
});
