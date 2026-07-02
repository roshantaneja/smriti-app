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

/** Optional purchase price for an ingredient, used to estimate recipe cost. */
export interface IngredientPrice {
  /** What you paid, in your local currency. */
  amount: number;
  /** How many grams that amount buys (the price basis). */
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
  /** GTIN/barcode for products imported from Open Food Facts. */
  barcode?: string;
  /** Optional cost basis for cost-per-serving math. */
  price?: IngredientPrice;
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

/** Which part of the day an entry belongs to. Chosen manually, never inferred. */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * A single thing logged on a given day. Kept as a flat, storage-friendly shape;
 * `resolveEntryNutrients` turns any entry into absolute Nutrients.
 */
export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD (local)
  kind: LogEntryKind;

  /** Which meal this belongs to. Optional; legacy/water entries have none. */
  meal?: MealType;

  // kind === "recipe"
  recipeId?: string;
  servings?: number;

  // kind === "ingredient"
  ingredientId?: string;
  grams?: number;

  // Free-form label + absolute nutrient snapshot.
  // Always set for "quick"; snapshotted at log time for "recipe"/"ingredient"
  // too so editing/deleting the source doesn't rewrite history.
  label?: string;
  nutrients?: Nutrients; // absolute total for this entry

  // kind === "water"
  waterMl?: number;

  createdAt: string;
}

/** One line of a saved meal — the same soft references a LogEntry carries. */
export interface SavedMealItem {
  kind: "ingredient" | "recipe" | "quick";
  ingredientId?: string;
  grams?: number;
  recipeId?: string;
  servings?: number;
  /** For "quick" items: the label + absolute nutrients logged as-is. */
  label?: string;
  nutrients?: Nutrients;
}

/** Foods eaten together, loggable in one tap (a template, not a recipe). */
export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: string;
}

/** One planned slot on the weekly meal plan. */
export interface PlanEntry {
  id: string;
  date: string; // YYYY-MM-DD (local)
  meal: MealType;
  kind: "recipe" | "ingredient";
  recipeId?: string;
  servings?: number;
  ingredientId?: string;
  grams?: number;
  /** Leftover portion of an earlier cook — excluded from grocery aggregation. */
  leftover?: boolean;
}

/** A single weigh-in. Weight is stored in kilograms. */
export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD (local)
  kg: number;
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

/** Local app settings. Persisted; holds the free USDA FoodData Central API key. */
export interface Settings {
  /** Free key from https://fdc.nal.usda.gov/api-key-signup. Empty until set. */
  usdaApiKey: string;
}
