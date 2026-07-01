// The seeded ingredient library, generated from USDA FoodData Central by
// scripts/build-seed.mjs. Ships with the app so it's useful on first launch
// with zero setup. Do not hand-edit assets/data/seed-ingredients.json — re-run
// the script to regenerate it.

import seedData from "@/assets/data/seed-ingredients.json";
import type { Ingredient } from "./types";

export const SEED_INGREDIENTS: Ingredient[] = seedData as Ingredient[];
