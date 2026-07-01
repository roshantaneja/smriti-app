#!/usr/bin/env node
// Build Smriti's seeded ingredient library from USDA FoodData Central (FDC).
//
// WHY: Smriti's whole premise is accurate macros for home cooking. Those
// numbers must come from an authoritative source, never hand-typed. This
// script reads USDA's "SR Legacy" bulk dataset (per-100g nutrients for ~7,800
// foods) and writes a small, committed JSON seed so the app is useful on first
// launch with zero setup and no API key.
//
// SOURCE: SR Legacy is a static USDA release (2021-10-28) with a stable URL and
// no rate limits — unlike the FDC search API, which throttles hard on DEMO_KEY.
//
// USAGE:  node scripts/build-seed.mjs
//         (downloads + caches the dataset under scripts/.cache/ on first run;
//          re-runs reparse the cache in ~1s. Delete .cache/ to refresh.)
//
// To add foods: append to FOODS below (match by keywords) and re-run.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const OUT = join(REPO, "assets", "data", "seed-ingredients.json");
const CACHE = join(__dirname, ".cache");
const JSON_PATH = join(CACHE, "sr_legacy.json");
const ZIP_URL =
  "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2021-10-28.zip";

// USDA nutrient IDs -> our per-100g field names.
const NUTRIENTS = {
  1008: "calories",     // kcal
  1003: "protein",      // g
  1004: "fat",          // g
  1005: "carbs",        // g
  1079: "fiber",        // g
  2000: "sugar",        // g
  1258: "saturatedFat", // g
  1093: "sodium",       // mg
  1087: "calcium",      // mg
  1089: "iron",         // mg
  1162: "vitaminC",     // mg
  1114: "vitaminD",     // IU
  1092: "potassium",    // mg
};

// Curated home-cooking staples. `must` keywords must ALL appear in the USDA
// description; `prefer` boosts the right generic entry; `avoid` rejects
// processed/incorrect matches. `portions` are standard household reference
// weights (approximate) so recipes aren't grams-only.
const FOODS = [
  // Grains & starches
  { name: "White rice, cooked", category: "Grains", must: ["rice", "white", "cooked"], prefer: ["long-grain", "unenriched", "without salt"], avoid: ["fried", "wild", "instant", "glutinous"], portions: [{ unit: "cup", grams: 158 }] },
  { name: "Brown rice, cooked", category: "Grains", must: ["rice", "brown", "cooked"], prefer: ["long-grain", "without salt"], avoid: ["instant", "fried"], portions: [{ unit: "cup", grams: 195 }] },
  { name: "Rolled oats, dry", category: "Grains", must: ["oats"], prefer: ["regular and quick", "not fortified", "dry"], avoid: ["cooked", "instant"], portions: [{ unit: "cup", grams: 81 }] },
  { name: "Whole wheat bread", category: "Grains", must: ["bread", "whole-wheat"], prefer: ["commercially prepared"], avoid: ["pita", "crumbs", "toasted"], portions: [{ unit: "slice", grams: 43 }] },
  { name: "Pasta, cooked", category: "Grains", must: ["pasta", "cooked"], prefer: ["enriched", "without added salt"], avoid: ["whole-wheat", "spinach", "corn", "protein", "gluten"], portions: [{ unit: "cup", grams: 124 }] },
  { name: "Whole wheat flour (atta)", category: "Grains", must: ["wheat flour", "whole"], prefer: ["whole-grain"], avoid: ["white", "bread", "durum"], portions: [{ unit: "cup", grams: 120 }] },
  { name: "Potato, cooked", category: "Vegetables", must: ["potatoes", "cooked", "flesh"], prefer: ["boiled", "without skin"], avoid: ["fried", "hash", "canned", "au gratin"], portions: [{ unit: "medium", grams: 167 }] },

  // Proteins
  { name: "Chicken breast, cooked", category: "Protein", must: ["chicken", "breast", "roasted"], prefer: ["meat only"], avoid: ["skin", "fried", "batter", "stewing", "canned"], portions: [{ unit: "breast", grams: 120 }] },
  { name: "Egg, whole, raw", category: "Protein", must: ["egg", "whole", "raw"], prefer: ["fresh"], avoid: ["white", "yolk", "dried", "cooked"], portions: [{ unit: "egg", grams: 50 }] },
  { name: "Salmon, cooked", category: "Protein", must: ["salmon", "cooked"], prefer: ["atlantic", "dry heat", "farmed"], avoid: ["raw", "smoked", "canned"], portions: [{ unit: "fillet", grams: 154 }] },
  { name: "Ground beef, cooked (90% lean)", category: "Protein", must: ["beef", "ground", "90%", "cooked"], prefer: ["pan-broiled", "patty"], avoid: ["raw", "75%", "80%", "85%", "70%"], portions: [{ unit: "patty", grams: 85 }] },
  { name: "Tofu, firm", category: "Protein", must: ["tofu"], prefer: ["raw", "firm", "calcium sulfate"], avoid: ["fried", "silken", "salted", "okara", "dried"], portions: [{ unit: "cup", grams: 126 }] },
  { name: "Shrimp, cooked", category: "Protein", must: ["shrimp", "cooked"], prefer: ["moist heat"], avoid: ["breaded", "imitation", "canned", "raw"], portions: [{ unit: "cup", grams: 145 }] },

  // Legumes
  { name: "Lentils, cooked (dal)", category: "Legumes", must: ["lentils", "cooked"], prefer: ["without salt", "mature seeds"], avoid: ["sprouted", "raw"], portions: [{ unit: "cup", grams: 198 }] },
  { name: "Chickpeas, cooked", category: "Legumes", must: ["chickpeas", "cooked"], prefer: ["without salt", "mature seeds"], avoid: ["canned"], portions: [{ unit: "cup", grams: 164 }] },
  { name: "Black beans, cooked", category: "Legumes", must: ["beans", "black", "cooked"], prefer: ["without salt", "mature seeds"], avoid: ["canned", "turtle"], portions: [{ unit: "cup", grams: 172 }] },
  { name: "Kidney beans, cooked (rajma)", category: "Legumes", must: ["kidney", "cooked"], prefer: ["red", "without salt", "mature seeds"], avoid: ["canned", "sprouted", "royal", "california"], portions: [{ unit: "cup", grams: 177 }] },

  // Dairy
  { name: "Milk, 2% reduced fat", category: "Dairy", must: ["milk", "2%"], prefer: ["reduced fat", "fluid", "added vitamin"], avoid: ["dry", "chocolate", "evaporated", "lactose"], portions: [{ unit: "cup", grams: 244 }] },
  { name: "Greek yogurt, plain, nonfat", category: "Dairy", must: ["yogurt", "greek", "plain", "nonfat"], prefer: [], avoid: ["fruit", "vanilla", "lowfat", "whole milk"], portions: [{ unit: "cup", grams: 245 }] },
  { name: "Cheddar cheese", category: "Dairy", must: ["cheese", "cheddar"], prefer: [], avoid: ["low", "reduced", "nonfat"], portions: [{ unit: "slice", grams: 28 }] },
  { name: "Cottage cheese", category: "Dairy", must: ["cheese", "cottage"], prefer: ["creamed", "large or small curd"], avoid: ["nonfat", "dry curd", "1%", "2%", "lowfat"], portions: [{ unit: "cup", grams: 210 }] },

  // Vegetables
  { name: "Spinach, raw", category: "Vegetables", must: ["spinach", "raw"], prefer: [], avoid: ["cooked", "canned", "frozen"], portions: [{ unit: "cup", grams: 30 }] },
  { name: "Broccoli, cooked", category: "Vegetables", must: ["broccoli", "cooked"], prefer: ["boiled", "drained"], avoid: ["raw", "frozen", "chinese", "leaves", "flower"], portions: [{ unit: "cup", grams: 156 }] },
  { name: "Tomato, raw", category: "Vegetables", must: ["tomatoes", "red", "raw"], prefer: ["year round", "ripe"], avoid: ["cooked", "canned", "paste", "sauce", "sun-dried", "green", "juice", "orange", "yellow"], portions: [{ unit: "medium", grams: 123 }] },
  { name: "Onion, raw", category: "Vegetables", must: ["onions", "raw"], prefer: [], avoid: ["cooked", "dehydrated", "rings", "spring", "welsh", "young green", "canned", "sweet"], portions: [{ unit: "medium", grams: 110 }] },
  { name: "Carrot, raw", category: "Vegetables", must: ["carrots", "raw"], prefer: [], avoid: ["cooked", "canned", "frozen", "baby", "juice"], portions: [{ unit: "medium", grams: 61 }] },

  // Fruit
  { name: "Banana, raw", category: "Fruit", must: ["bananas", "raw"], prefer: [], avoid: ["dried", "dehydrated"], portions: [{ unit: "medium", grams: 118 }] },
  { name: "Apple, raw", category: "Fruit", must: ["apples", "raw", "with skin"], prefer: [], avoid: ["dried", "juice", "canned"], portions: [{ unit: "medium", grams: 182 }] },
  { name: "Blueberries, raw", category: "Fruit", must: ["blueberries", "raw"], prefer: [], avoid: ["frozen", "canned", "wild", "dried"], portions: [{ unit: "cup", grams: 148 }] },

  // Fats & nuts
  { name: "Olive oil", category: "Fats", must: ["oil", "olive"], prefer: ["salad or cooking"], avoid: ["spread"], portions: [{ unit: "tbsp", grams: 14 }] },
  { name: "Almonds", category: "Nuts", must: ["almonds"], prefer: [], avoid: ["dry roasted", "oil roasted", "honey", "blanched", "butter", "milk", "paste", "flour"], portions: [{ unit: "oz (~23 nuts)", grams: 28 }] },
  { name: "Peanut butter", category: "Nuts", must: ["peanut butter", "smooth"], prefer: ["with salt"], avoid: ["reduced fat", "chunk"], portions: [{ unit: "tbsp", grams: 16 }] },
];

function ensureDataset() {
  if (existsSync(JSON_PATH)) return;
  mkdirSync(CACHE, { recursive: true });
  const zip = join(CACHE, "sr_legacy.zip");
  console.log("Downloading USDA SR Legacy dataset (~12.5MB)...");
  execSync(`curl -sS -L -m 180 -o "${zip}" "${ZIP_URL}"`, { stdio: "inherit" });
  console.log("Unzipping...");
  execSync(`unzip -o -q "${zip}" -d "${CACHE}"`, { stdio: "inherit" });
  // The archive extracts one large JSON; normalize its name.
  const extracted = execSync(`ls "${CACHE}"/*.json`, { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .find((p) => !p.endsWith("sr_legacy.json"));
  if (extracted) execSync(`mv "${extracted}" "${JSON_PATH}"`);
}

function scoreMatch(desc, spec) {
  const d = desc.toLowerCase();
  for (const kw of spec.must) if (!d.includes(kw.toLowerCase())) return null; // hard requirement
  let score = 100;
  for (const kw of spec.prefer) if (d.includes(kw.toLowerCase())) score += 10;
  for (const kw of spec.avoid) if (d.includes(kw.toLowerCase())) score -= 40;
  score -= d.length / 20; // prefer shorter, more generic descriptions
  return score;
}

function round(v, p = 2) {
  const m = Math.pow(10, p);
  return Math.round(v * m) / m;
}

function extract(food) {
  const per100g = {};
  for (const fn of food.foodNutrients || []) {
    const id = fn.nutrient && fn.nutrient.id;
    const key = NUTRIENTS[id];
    if (key && typeof fn.amount === "number") {
      per100g[key] = key === "calories" ? Math.round(fn.amount) : round(fn.amount);
    }
  }
  return per100g;
}

function main() {
  ensureDataset();
  console.log("Parsing dataset...");
  const foods = JSON.parse(readFileSync(JSON_PATH, "utf8")).SRLegacyFoods;

  const results = [];
  const misses = [];
  for (const spec of FOODS) {
    let best = null;
    let bestScore = -Infinity;
    for (const f of foods) {
      const s = scoreMatch(f.description, spec);
      if (s != null && s > bestScore) {
        bestScore = s;
        best = f;
      }
    }
    if (!best) {
      misses.push(spec.name);
      continue;
    }
    const per100g = extract(best);
    if (per100g.calories == null || per100g.protein == null) {
      misses.push(`${spec.name} (matched "${best.description}" but missing core macros)`);
      continue;
    }
    results.push({
      id: `usda-${best.fdcId}`,
      name: spec.name,
      category: spec.category,
      per100g,
      portions: spec.portions || [],
      source: "USDA FoodData Central (SR Legacy)",
      fdcId: best.fdcId,
      fdcDescription: best.description,
    });
    console.log(`  ✓ ${spec.name.padEnd(34)} ← ${best.description}`);
  }

  results.sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n");
  console.log(`\nWrote ${results.length}/${FOODS.length} ingredients to assets/data/seed-ingredients.json`);
  if (misses.length) console.log("Unmatched:\n  - " + misses.join("\n  - "));
}

main();
