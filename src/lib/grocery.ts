// Weekly meal-plan math: week boundaries, grocery-list aggregation, and
// per-day planned nutrients. Pure functions — no store access, fully tested.
//
// Week-start choice: weeks run MONDAY → SUNDAY. Meal planning is anchored to
// "the week you shop for", and a Mon–Sun week matches how home cooks plan a
// weekend shop for the working week ahead.

import { dayKey } from "./date";
import { recipePerServing, scale, scaleNutrientsBy, sum } from "./nutrition";
import type { Ingredient, Nutrients, PlanEntry, Recipe } from "./types";

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Parse a local YYYY-MM-DD key into a local Date (noon dodges DST edges). */
function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** A day key shifted by `days` on the local calendar. */
export function addDays(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** The Monday of the week containing `key` (Sunday belongs to the week that began the previous Monday). */
export function weekStart(key: string): string {
  const offset = (parseKey(key).getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(key, -offset);
}

/** The 7 day keys of the week beginning at `startKey` (Monday). */
export function weekDays(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
}

/**
 * Checklist key for one grocery line, persisted in `groceryChecked`.
 * Format: `${weekStartKey}:${ingredientId}` — scoping to the week means last
 * week's ticks never bleed into this week's list.
 */
export function groceryKey(weekStartKey: string, ingredientId: string): string {
  return `${weekStartKey}:${ingredientId}`;
}

export interface GroceryLine {
  key: string;
  ingredientId: string;
  name: string;
  category: string;
  totalGrams: number;
  /** Estimated cost from the ingredient's price basis; undefined when unpriced. */
  estCost?: number;
}

/**
 * Aggregate one week's plan into a shopping list: every non-leftover entry in
 * the week (recipe items scaled by planned/recipe servings, plus direct
 * ingredient entries) summed per ingredient, sorted by category then name.
 * Leftover entries are excluded — that food was already bought and cooked.
 */
export function aggregateGroceries(
  plan: PlanEntry[],
  weekStartKey: string,
  getIngredient: (id: string) => Ingredient | undefined,
  getRecipe: (id: string) => Recipe | undefined,
): GroceryLine[] {
  const days = new Set(weekDays(weekStartKey));
  const gramsById = new Map<string, number>();
  const add = (id: string, grams: number) => {
    if (grams > 0) gramsById.set(id, (gramsById.get(id) ?? 0) + grams);
  };

  for (const p of plan) {
    if (!days.has(p.date) || p.leftover) continue;
    if (p.kind === "recipe") {
      const recipe = p.recipeId ? getRecipe(p.recipeId) : undefined;
      if (!recipe) continue;
      const factor = (p.servings ?? 1) / (recipe.servings > 0 ? recipe.servings : 1);
      for (const it of recipe.items) add(it.ingredientId, it.grams * factor);
    } else if (p.ingredientId) {
      add(p.ingredientId, p.grams ?? 0);
    }
  }

  const lines: GroceryLine[] = [];
  for (const [ingredientId, grams] of gramsById) {
    const ing = getIngredient(ingredientId);
    const price = ing?.price;
    const estCost =
      price && price.grams > 0 && price.amount > 0
        ? round2((grams / price.grams) * price.amount)
        : undefined;
    lines.push({
      key: groceryKey(weekStartKey, ingredientId),
      ingredientId,
      name: ing?.name ?? "Unknown ingredient",
      category: ing?.category ?? "Other",
      totalGrams: Math.round(grams * 10) / 10,
      estCost,
    });
  }

  return lines.sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

export interface GroceryTotals {
  /** Sum of priced lines only — a lower bound when pricedLines < totalLines. */
  totalCost: number;
  pricedLines: number;
  totalLines: number;
}

export function groceryTotals(lines: GroceryLine[]): GroceryTotals {
  let totalCost = 0;
  let pricedLines = 0;
  for (const l of lines) {
    if (l.estCost != null) {
      totalCost += l.estCost;
      pricedLines += 1;
    }
  }
  return { totalCost: round2(totalCost), pricedLines, totalLines: lines.length };
}

/**
 * Summed nutrients for one day's planned entries (leftovers included — they
 * are still eaten that day; the exclusion only applies to shopping).
 */
export function planDayNutrients(
  plan: PlanEntry[],
  date: string,
  getIngredient: (id: string) => Ingredient | undefined,
  getRecipe: (id: string) => Recipe | undefined,
): Nutrients {
  return sum(
    plan
      .filter((p) => p.date === date)
      .map((p) => {
        if (p.kind === "recipe") {
          const recipe = p.recipeId ? getRecipe(p.recipeId) : undefined;
          if (!recipe) return {};
          return scaleNutrientsBy(recipePerServing(recipe, getIngredient), p.servings ?? 1);
        }
        const ing = p.ingredientId ? getIngredient(p.ingredientId) : undefined;
        return ing ? scale(ing.per100g, p.grams ?? 0) : {};
      }),
  );
}

/** Friendly weight for the grocery list: "450 g", "1.3 kg". */
export function formatGrams(grams: number): string {
  if (grams >= 1000) return `${Math.round(grams / 100) / 10} kg`;
  return `${Math.round(grams)} g`;
}
