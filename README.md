# Smriti 🌿

A nutrition tracker built for people who **cook their own food**. Most calorie apps
are optimized for barcodes and restaurant menus; Smriti is optimized for home cooks —
log your own recipes and ingredients once, then logging a home-cooked meal is a single tap.

_Smriti_ (स्मृति) means "memory" in Sanskrit: the app remembers your pantry and recipes
so you don't have to re-enter them.

## What's here (MVP)

The core daily loop:

- **Onboarding** — first launch picks a goal preset (Balanced, High-protein, Keto, …) or skips.
- **Today** — dashboard with macro rings for calories/protein/carbs/fat plus fiber and water
  bars vs. your goals; logged food grouped by Breakfast / Lunch / Dinner / Snacks with per-meal
  subtotals; collapsible micronutrient totals; water logged separately. Tap an entry to edit its
  portion, move it to another meal, or delete it; copy yesterday's meal into an empty section;
  keep a daily note; and a streak badge celebrates consecutive logging days.
- **Fast logging** — the add sheet has Foods / Recipes / Meals / Quick add / Water modes, with
  Recent & Frequent one-tap shortcuts (remembering your last-used portions) and saved meal
  templates ("Save as meal…" from Today) that log a whole meal in one tap — and can be
  deleted from the sheet when outgrown.
- **Foods** — an ingredient library seeded with real USDA nutrition data (per 100 g),
  plus your own foods (manual entry with optional price). Tap any food for full per-100 g
  detail including micronutrients; your own foods can be edited or deleted from there
  (the USDA seed stays read-only).
- **Scan a barcode** — point the camera at a packaged food and Smriti imports its nutrition
  from Open Food Facts, prefilled into the new-ingredient form.
- **Search online** — live text search of USDA FoodData Central (needs a free USDA API key,
  entered once in Settings); results also prefill the new-ingredient form.
- **Settings** — goals link, USDA API key, CSV export (food log, day totals, weights — shared
  via the system share sheet), plus a "reset all data" escape hatch.
- **Recipes** — build a recipe from ingredients + amounts; it auto-computes per-serving
  macros and estimated cost when ingredients carry price data. Rate recipes after cooking;
  sort by protein density, speed, or rating; filter by tags, protein, or priced-only; scale
  the batch, duplicate a recipe, or send it straight to the weekly plan.
- **Plan** — assign recipes/foods to the week's meals, see per-day macro totals, log a
  planned meal in one tap, save a week as a reusable **menu** to apply to any other week, and
  generate a **grocery list** (ingredients aggregated across the week, with estimated cost
  where ingredients carry prices — mark items you already have and your pantry is subtracted
  from the list).
- **Trends** — 7/30/90-day daily averages vs. your goals, a calorie chart with goal line
  (daily bars for the past week, weekly buckets beyond), a month history calendar with
  tap-for-day summaries, and a weight log with a smoothed trend line.
- **Goals** — set your daily targets or apply a preset (under Settings → Goals), schedule
  per-weekday overrides (e.g. higher carbs on training days — Today shows that day's adjusted
  targets), and pin micronutrients to track as daily tiles on Today.

Everything is stored **on-device** (no account, no cloud). Barcode scanning and online food
search are the only two features that touch the network (Open Food Facts and USDA FoodData
Central lookups); everything else works fully offline. That leaves a clean seam to add sync +
a community recipe layer later.

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

## Testing

Unit tests (jest + `jest-expo`) cover the domain logic in `src/lib`:

```bash
npm test
```

Tests live under `src/lib/__tests__/*.test.ts`.

## iOS builds & CI

- **CI** — `.github/workflows/ci.yml` runs typecheck, lint, tests, and an `expo export -p ios`
  bundle check on every push/PR.
- **EAS builds** — `.github/workflows/eas-build.yml` runs `eas build -p ios` on manual dispatch
  or a `v*` tag, using the `development` / `preview` / `production` profiles in `eas.json`.
  It needs an `EXPO_TOKEN` repository secret (an Expo access token).

## Project layout

```
src/
  app/                 # expo-router screens (file-based routing)
    (tabs)/            # Today · Plan · Recipes · Foods · Trends
    onboarding.tsx     # first-launch goal preset picker
    log-add.tsx        # add-to-today modal (foods / recipes / meals / quick / water + meal)
    scan.tsx           # barcode scanner modal (expo-camera -> Open Food Facts)
    food-search.tsx    # live USDA FoodData Central search modal
    settings.tsx       # settings modal (goals link, USDA API key, CSV export, reset data)
    goals.tsx          # daily targets + presets (reached from Settings)
    grocery.tsx        # weekly grocery checklist generated from the plan
    recipe/            # recipe create + detail
    food/              # manual ingredient entry + ingredient detail
  lib/                 # domain: types, nutrition math, grocery/week math, goal scheduling, trends + CSV export, presets, units, import mappers, store (zustand)
  services/            # network clients: Open Food Facts + USDA FoodData Central
  components/          # UI kit (Card, Button, Field, Screen, progress, ring, …)
  constants/theme.ts   # palette + per-macro colors
scripts/build-seed.mjs # USDA -> seed-ingredients.json
```

## Roadmap (post-MVP)

1. Nutrition-label scanning (OCR) — barcode scanning via Open Food Facts has shipped.
2. Restaurant/chain nutrition via a food API.
3. Goal-aware AI recommendations that learn from your "didn't like it" feedback.
4. Community recipe sharing.

(Meal planning + grocery lists, trends & analytics, and the logging accelerators —
recents/frequents, saved meals, copy day — have all shipped.)
