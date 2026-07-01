// Core domain model for Smriti.
//
// Everything nutritional is stored per 100 g on the Ingredient, and every
// logged amount resolves to grams. That single canonical unit (grams) is what
// keeps recipe math and daily totals consistent — household units (cups, eggs)
// are just conversions on top.

export type NutrientKey =
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "fiber"
  | "sugar"
  | "saturatedFat"
  | "sodium"
  | "calcium"
  | "iron"
  | "vitaminC"
  | "vitaminD"
  | "potassium";

export type Nutrients = Partial<Record<NutrientKey, number>>;

/** A named household measure and its (approximate) weight in grams. */
export interface Portion {
  unit: string;
  grams: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  /** Nutrients per 100 g — the canonical basis for all scaling. */
  per100g: Nutrients;
  /** Household measures so recipes aren't grams-only. Always also supports "g". */
  portions: Portion[];
  source: string;
  fdcId?: number;
  fdcDescription?: string;
}

export interface RecipeItem {
  ingredientId: string;
  /** Canonical amount in grams (derived from amount + unit at entry time). */
  grams: number;
  /** What the user actually typed, for friendly display/editing. */
  amount: number;
  unit: string; // "g" or a Portion.unit
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  items: RecipeItem[];
  prepMinutes?: number;
  /** 1–5, set after you've cooked it. Drives future ranking. */
  rating?: number;
  tags: string[];
  notes?: string;
  createdAt: string;
}

export type LogEntryKind = "recipe" | "ingredient" | "quick" | "water";

/**
 * A single thing logged on a given day. Kept as a flat, storage-friendly shape;
 * `resolveEntryNutrients` turns any entry into absolute Nutrients.
 */
export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD (local)
  kind: LogEntryKind;

  // kind === "recipe"
  recipeId?: string;
  servings?: number;

  // kind === "ingredient"
  ingredientId?: string;
  grams?: number;

  // kind === "quick" (free-form food; nutrients entered directly)
  label?: string;
  nutrients?: Nutrients; // absolute total for this entry

  // kind === "water"
  waterMl?: number;

  createdAt: string;
}

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
}
