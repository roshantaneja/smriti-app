// Map external food data (Open Food Facts, USDA FoodData Central) into our
// canonical Ingredient shape (nutrients per 100 g). These are pure functions
// used by the barcode and online-search flows to prefill the add-ingredient
// form — they never touch the network or the store.

import type { Ingredient, Nutrients, NutrientKey, Portion } from "./types";

type IngredientDraft = Omit<Ingredient, "id">;

const round = (v: number, p = 1) => {
  const m = Math.pow(10, p);
  return Math.round(v * m) / m;
};

/** Drop empty/zero nutrients so the form and totals stay tidy. */
function cleanNutrients(raw: Partial<Record<NutrientKey, number>>): Nutrients {
  const out: Nutrients = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && isFinite(v) && v > 0) {
      out[k as NutrientKey] = k === "calories" ? Math.round(v) : round(v);
    }
  }
  return out;
}

// --- Open Food Facts ---------------------------------------------------------
// Product v2 `nutriments` are normalized to per-100 g: energy in kcal, macros
// in grams, minerals/vitamins in grams — so grams→mg needs ×1000.
const OFF_MAP: { off: string; key: NutrientKey; factor: number }[] = [
  { off: "energy-kcal_100g", key: "calories", factor: 1 },
  { off: "proteins_100g", key: "protein", factor: 1 },
  { off: "carbohydrates_100g", key: "carbs", factor: 1 },
  { off: "fat_100g", key: "fat", factor: 1 },
  { off: "fiber_100g", key: "fiber", factor: 1 },
  { off: "sugars_100g", key: "sugar", factor: 1 },
  { off: "saturated-fat_100g", key: "saturatedFat", factor: 1 },
  { off: "sodium_100g", key: "sodium", factor: 1000 },
  { off: "calcium_100g", key: "calcium", factor: 1000 },
  { off: "iron_100g", key: "iron", factor: 1000 },
  { off: "potassium_100g", key: "potassium", factor: 1000 },
  { off: "vitamin-c_100g", key: "vitaminC", factor: 1000 },
];

/**
 * Convert an Open Food Facts product (the `product` object from the v2 API)
 * into an Ingredient draft. Returns null when there isn't enough to be useful
 * (no name or no usable nutrients).
 */
export function offProductToIngredient(product: any): IngredientDraft | null {
  if (!product || typeof product !== "object") return null;
  const n = product.nutriments ?? {};
  const raw: Partial<Record<NutrientKey, number>> = {};
  for (const { off, key, factor } of OFF_MAP) {
    const v = Number(n[off]);
    if (isFinite(v) && v > 0) raw[key] = v * factor;
  }
  const per100g = cleanNutrients(raw);

  const name: string =
    product.product_name?.trim() ||
    product.product_name_en?.trim() ||
    product.generic_name?.trim() ||
    "";
  if (!name || Object.keys(per100g).length === 0) return null;

  const portions: Portion[] = [];
  const servingGrams = Number(product.serving_quantity);
  if (isFinite(servingGrams) && servingGrams > 0) {
    portions.push({ unit: "serving", grams: round(servingGrams) });
  }

  const brand = String(product.brands ?? "").split(",")[0].trim();
  return {
    name: brand ? `${name} (${brand})` : name,
    category: brand || "Packaged",
    per100g,
    portions,
    source: "Open Food Facts",
    barcode: String(product.code ?? product._id ?? "") || undefined,
  };
}

// --- USDA FoodData Central ---------------------------------------------------
// Search results carry `foodNutrients` already per 100 g in their standard
// units (kcal, g, mg, IU) — the same nutrient IDs used by scripts/build-seed.mjs.
const USDA_NUTRIENTS: Record<number, NutrientKey> = {
  1008: "calories",
  1003: "protein",
  1004: "fat",
  1005: "carbs",
  1079: "fiber",
  2000: "sugar",
  1258: "saturatedFat",
  1093: "sodium",
  1087: "calcium",
  1089: "iron",
  1162: "vitaminC",
  1114: "vitaminD",
  1092: "potassium",
};

/**
 * Convert one food from the FDC `/foods/search` response into an Ingredient
 * draft. Returns null when there isn't enough to be useful.
 */
export function usdaFoodToIngredient(food: any): IngredientDraft | null {
  if (!food || typeof food !== "object") return null;
  const raw: Partial<Record<NutrientKey, number>> = {};
  for (const fn of food.foodNutrients ?? []) {
    const id = Number(fn.nutrientId ?? fn.nutrient?.id);
    const key = USDA_NUTRIENTS[id];
    const value = Number(fn.value ?? fn.amount);
    if (key && isFinite(value)) raw[key] = value;
  }
  const per100g = cleanNutrients(raw);

  const name: string = String(food.description ?? "").trim();
  if (!name || Object.keys(per100g).length === 0) return null;

  const portions: Portion[] = [];
  const servingGrams = Number(food.servingSize);
  if (food.servingSizeUnit === "g" && isFinite(servingGrams) && servingGrams > 0) {
    const label = String(food.householdServingFullText ?? "").trim() || "serving";
    portions.push({ unit: label, grams: round(servingGrams) });
  }

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
    category: String(food.foodCategory ?? "USDA").trim() || "USDA",
    per100g,
    portions,
    source: "USDA FoodData Central",
    fdcId: Number(food.fdcId) || undefined,
    fdcDescription: name,
  };
}
