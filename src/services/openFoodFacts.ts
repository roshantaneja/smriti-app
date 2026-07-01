// Open Food Facts lookup for the barcode-scan flow. Fetches a product by
// barcode and maps it into our canonical Ingredient draft via `offProductToIngredient`.
// Network errors are thrown to the caller (the scan screen shows a retry overlay).

import { offProductToIngredient } from '@/lib/import';
import type { Ingredient } from '@/lib/types';

type IngredientDraft = Omit<Ingredient, 'id'>;

type OffResponse = {
  status?: number;
  product?: unknown;
};

/**
 * Look up a barcode on Open Food Facts and return an Ingredient draft, or null
 * when the product isn't found or lacks usable data. Throws on network failure.
 */
export async function fetchProduct(barcode: string): Promise<IngredientDraft | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
    headers: { 'User-Agent': 'Smriti/1.0 (nutrition tracker)' },
  });

  // 404 means "no such product" — a normal not-found, not an error.
  if (res.status === 404) return null;
  if (!res.ok) return null;

  const json = (await res.json()) as OffResponse;
  if (json.status === 1 && json.product) {
    return offProductToIngredient(json.product);
  }
  return null;
}
