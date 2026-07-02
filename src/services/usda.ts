// Live text search against USDA FoodData Central. Thin network layer used by
// the online-search screen: it hits the FDC `/foods/search` endpoint and maps
// each result into an Ingredient draft via `usdaFoodToIngredient` — the same
// mapper the barcode/import flows use. No store or UI concerns live here.

import { usdaFoodToIngredient } from '@/lib/import';
import type { Ingredient } from '@/lib/types';

type IngredientDraft = Omit<Ingredient, 'id'>;

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/**
 * Search USDA FoodData Central for foods matching `query` and return them as
 * ingredient drafts (nulls from the mapper are filtered out).
 *
 * Throws `Error('rate_limit')` on 429, `Error('bad_key')` on 401/403, a generic
 * error on other non-ok responses, and lets network errors propagate — callers
 * catch and surface friendly messages.
 */
export async function searchFoods(query: string, apiKey: string): Promise<IngredientDraft[]> {
  const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}&pageSize=25&api_key=${apiKey}`;
  const res = await fetch(url);

  if (res.status === 429) throw new Error('rate_limit');
  if (res.status === 401 || res.status === 403) throw new Error('bad_key');
  if (!res.ok) throw new Error(`usda_error_${res.status}`);

  const json = await res.json();
  const foods: unknown = json?.foods;
  if (!Array.isArray(foods)) return [];

  return foods
    .map((food) => usdaFoodToIngredient(food))
    .filter((draft): draft is IngredientDraft => draft !== null);
}
