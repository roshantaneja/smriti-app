// All nutrition math lives here so scaling rules are defined once.

import type {
  Ingredient,
  LogEntry,
  Nutrients,
  NutrientKey,
  Recipe,
} from "./types";

const ALL_KEYS: NutrientKey[] = [
  "calories", "protein", "carbs", "fat", "fiber", "sugar",
  "saturatedFat", "sodium", "calcium", "iron", "vitaminC", "vitaminD", "potassium",
];

const round = (v: number, p = 1) => {
  const m = Math.pow(10, p);
  return Math.round(v * m) / m;
};

/** Scale a per-100g profile to an arbitrary gram amount. */
export function scale(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = {};
  for (const key of ALL_KEYS) {
    const v = per100g[key];
    if (typeof v === "number") out[key] = key === "calories" ? Math.round(v * f) : round(v * f);
  }
  return out;
}

/** Sum any number of nutrient profiles. */
export function sum(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const key of ALL_KEYS) {
      const v = n[key];
      if (typeof v === "number") out[key] = round((out[key] ?? 0) + v);
    }
  }
  if (out.calories != null) out.calories = Math.round(out.calories);
  return out;
}

/** Total nutrients for a whole recipe (all servings). */
export function recipeTotals(
  recipe: Recipe,
  getIngredient: (id: string) => Ingredient | undefined,
): Nutrients {
  return sum(
    recipe.items.map((it) => {
      const ing = getIngredient(it.ingredientId);
      return ing ? scale(ing.per100g, it.grams) : {};
    }),
  );
}

/** Nutrients for a single serving of a recipe. */
export function recipePerServing(
  recipe: Recipe,
  getIngredient: (id: string) => Ingredient | undefined,
): Nutrients {
  const totals = recipeTotals(recipe, getIngredient);
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  const out: Nutrients = {};
  for (const key of ALL_KEYS) {
    const v = totals[key];
    if (typeof v === "number") out[key] = key === "calories" ? Math.round(v / servings) : round(v / servings);
  }
  return out;
}

/** Resolve any log entry (recipe / ingredient / quick / water) to absolute nutrients. */
export function resolveEntryNutrients(
  entry: LogEntry,
  ctx: {
    getIngredient: (id: string) => Ingredient | undefined;
    getRecipe: (id: string) => Recipe | undefined;
  },
): Nutrients {
  switch (entry.kind) {
    case "recipe": {
      const recipe = entry.recipeId ? ctx.getRecipe(entry.recipeId) : undefined;
      if (!recipe) return {};
      const per = recipePerServing(recipe, ctx.getIngredient);
      return scaleNutrientsBy(per, entry.servings ?? 1);
    }
    case "ingredient": {
      const ing = entry.ingredientId ? ctx.getIngredient(entry.ingredientId) : undefined;
      if (!ing) return {};
      return scale(ing.per100g, entry.grams ?? 0);
    }
    case "quick":
      return entry.nutrients ?? {};
    case "water":
      return {};
  }
}

function scaleNutrientsBy(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const key of ALL_KEYS) {
    const v = n[key];
    if (typeof v === "number") out[key] = key === "calories" ? Math.round(v * factor) : round(v * factor);
  }
  return out;
}

/** Sum nutrients across a set of entries (e.g. a day's log). */
export function totalForEntries(
  entries: LogEntry[],
  ctx: {
    getIngredient: (id: string) => Ingredient | undefined;
    getRecipe: (id: string) => Recipe | undefined;
  },
): Nutrients {
  return sum(entries.map((e) => resolveEntryNutrients(e, ctx)));
}

/** Total water (ml) logged across entries. */
export function totalWater(entries: LogEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.kind === "water" ? e.waterMl ?? 0 : 0), 0);
}
