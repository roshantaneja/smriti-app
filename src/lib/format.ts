import type { Ingredient, LogEntry, Recipe } from './types';

interface Ctx {
  getIngredient: (id: string) => Ingredient | undefined;
  getRecipe: (id: string) => Recipe | undefined;
}

export function entryTitle(e: LogEntry, ctx: Ctx): string {
  switch (e.kind) {
    case 'recipe':
      // Prefer the snapshot label; fall back to the live recipe, then a default.
      return e.label || (e.recipeId && ctx.getRecipe(e.recipeId)?.name) || 'Recipe';
    case 'ingredient':
      return e.label || (e.ingredientId && ctx.getIngredient(e.ingredientId)?.name) || 'Food';
    case 'quick':
      return e.label || 'Quick add';
    case 'water':
      return 'Water';
  }
}

export function entrySubtitle(e: LogEntry): string {
  switch (e.kind) {
    case 'recipe': {
      const s = e.servings ?? 1;
      return `${trimNum(s)} serving${s === 1 ? '' : 's'}`;
    }
    case 'ingredient':
      return `${trimNum(e.grams ?? 0)} g`;
    case 'quick':
      return 'Quick add';
    case 'water':
      return `${e.waterMl ?? 0} ml`;
  }
}

/** Drop trailing ".0" for clean display of amounts. */
export function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
