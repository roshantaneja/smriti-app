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

/** Micronutrients surfaced in the UI (beyond the four headline macros + fiber). */
export const MICROS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "saturatedFat", label: "Saturated fat", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
  { key: "calcium", label: "Calcium", unit: "mg" },
  { key: "iron", label: "Iron", unit: "mg" },
  { key: "potassium", label: "Potassium", unit: "mg" },
  { key: "vitaminC", label: "Vitamin C", unit: "mg" },
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

/**
 * Compute a log entry's absolute nutrients *live* from its soft references
 * (recipe/ingredient). Used at log time to snapshot the entry, and as the
 * fallback for old entries that predate snapshots.
 */
export function computeEntryNutrients(
  entry: Pick<LogEntry, "kind" | "recipeId" | "servings" | "ingredientId" | "grams" | "nutrients">,
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

/**
 * Resolve any log entry to absolute nutrients. Prefers the snapshot stored at
 * log time (`entry.nutrients`) so history is stable; falls back to live
 * computation for entries logged before snapshots existed.
 */
export function resolveEntryNutrients(
  entry: LogEntry,
  ctx: {
    getIngredient: (id: string) => Ingredient | undefined;
    getRecipe: (id: string) => Recipe | undefined;
  },
): Nutrients {
  if (entry.kind === "water") return {};
  if (entry.nutrients) return entry.nutrients;
  return computeEntryNutrients(entry, ctx);
}

/** Scale an absolute nutrient profile by a plain factor (e.g. portion edits). */
export function scaleNutrientsBy(n: Nutrients, factor: number): Nutrients {
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

/** Estimated cost of a recipe from the priced portion of its ingredients. */
export interface RecipeCost {
  /** Total estimated cost across all servings (priced ingredients only). */
  total: number;
  /** Estimated cost per serving. */
  perServing: number;
  /** How many recipe items carried price data. */
  pricedItems: number;
  /** Total recipe items (so the UI can flag partial coverage). */
  totalItems: number;
}

/**
 * Estimate recipe cost from ingredient price data. Returns `null` when no
 * ingredient in the recipe has a price. Only priced ingredients contribute, so
 * `pricedItems < totalItems` means the estimate is a lower bound.
 */
export function recipeCost(
  recipe: Recipe,
  getIngredient: (id: string) => Ingredient | undefined,
): RecipeCost | null {
  let total = 0;
  let pricedItems = 0;
  for (const it of recipe.items) {
    const ing = getIngredient(it.ingredientId);
    const price = ing?.price;
    if (price && price.grams > 0 && price.amount > 0) {
      total += (it.grams / price.grams) * price.amount;
      pricedItems += 1;
    }
  }
  if (pricedItems === 0) return null;
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  return {
    total: round(total, 2),
    perServing: round(total / servings, 2),
    pricedItems,
    totalItems: recipe.items.length,
  };
}
