// Convert between household measures and grams for a given ingredient.

import type { Ingredient } from "./types";

export interface UnitOption {
  unit: string; // "g" or a portion unit
  grams: number; // grams per 1 of this unit
}

/** Every ingredient supports grams plus whatever named portions it defines. */
export function unitOptions(ing: Ingredient): UnitOption[] {
  return [{ unit: "g", grams: 1 }, ...ing.portions.map((p) => ({ unit: p.unit, grams: p.grams }))];
}

/** amount + unit -> grams. Falls back to treating the amount as grams. */
export function toGrams(ing: Ingredient, amount: number, unit: string): number {
  if (unit === "g") return amount;
  const p = ing.portions.find((x) => x.unit === unit);
  return p ? amount * p.grams : amount;
}

/** Pick a sensible default unit: the first household portion if any, else grams. */
export function defaultUnit(ing: Ingredient): string {
  return ing.portions[0]?.unit ?? "g";
}
