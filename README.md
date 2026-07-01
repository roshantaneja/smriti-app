# Smriti 🌿

A nutrition tracker built for people who **cook their own food**. Most calorie apps
are optimized for barcodes and restaurant menus; Smriti is optimized for home cooks —
log your own recipes and ingredients once, then logging a home-cooked meal is a single tap.

_Smriti_ (स्मृति) means "memory" in Sanskrit: the app remembers your pantry and recipes
so you don't have to re-enter them.

## What's here (MVP)

The core daily loop:

- **Onboarding** — first launch picks a goal preset (Balanced, High-protein, Keto, …) or skips.
- **Today** — dashboard of calories, protein/carbs/fat/fiber, and water vs. your goals; logged
  food grouped by Breakfast / Lunch / Dinner / Snacks with per-meal subtotals; collapsible
  micronutrient totals; water logged separately.
- **Foods** — an ingredient library seeded with real USDA nutrition data (per 100 g),
  plus your own foods (manual entry with optional price). Tap any food for full per-100 g
  detail including micronutrients.
- **Recipes** — build a recipe from ingredients + amounts; it auto-computes per-serving
  macros and estimated cost when ingredients carry price data. Rate recipes after cooking;
  sort by protein density, speed, or rating.
- **Goals** — set your daily targets or apply a preset.

Everything is stored **on-device** (no account, no cloud). That leaves a clean seam to
add sync + a community recipe layer later.

## Run it

You'll preview on your phone with **Expo Go** (no Xcode/simulator needed):

```bash
npm install          # if node_modules is missing
npx expo start       # then scan the QR code with Expo Go (iOS/Android)
```

- iOS: install **Expo Go** from the App Store, open the Camera, scan the QR code.
- Requires a modern Node (built and verified on Node 22–25).

## The nutrition seed data

The seed ingredient library is **generated from USDA FoodData Central**, never hand-typed.
`scripts/build-seed.mjs` downloads USDA's SR Legacy dataset (cached, no API key needed),
extracts per-100 g nutrients for a curated set of home-cooking staples, and writes
`assets/data/seed-ingredients.json`.

To regenerate or expand the list (edit the `FOODS` array in the script first):

```bash
node scripts/build-seed.mjs
```

## Project layout

```
src/
  app/                 # expo-router screens (file-based routing)
    (tabs)/            # Today · Recipes · Foods · Goals
    onboarding.tsx     # first-launch goal preset picker
    log-add.tsx        # add-to-today modal (foods / recipes / quick / water + meal)
    recipe/            # recipe create + detail
    food/              # manual ingredient entry + ingredient detail
  lib/                 # domain: types, nutrition math, presets, units, store (zustand)
  components/          # UI kit (Card, Button, Field, Screen, progress, …)
  constants/theme.ts   # palette + per-macro colors
scripts/build-seed.mjs # USDA -> seed-ingredients.json
```

## Roadmap (post-MVP)

1. Barcode + nutrition-label scanning (Open Food Facts / OCR).
2. Meal planning + auto-generated grocery lists; weekly grocery cost roll-ups.
3. Restaurant/chain nutrition via a food API.
4. Goal-aware AI recommendations that learn from your "didn't like it" feedback.
5. Community recipe sharing.
