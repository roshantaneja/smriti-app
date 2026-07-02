# Smriti — agent notes

Nutrition tracker for home cooks (Expo / React Native, SDK 57). See `README.md` for product context.

## Expo SDK 57 has changed
Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing framework code.
This project uses **standard `expo-router` `Tabs`** (not the template's `unstable-native-tabs`).

## Architecture
- **Routing:** file-based via `expo-router` under `src/app`. Path alias `@/*` → `src/*`, `@/assets/*` → `assets/*`.
 Root `_layout.tsx` is a Stack (tabs group + modal routes `log-add` / `food/new` / `recipe/new` /
 `scan` / `settings` / `food-search` + `food/[id]` / `recipe/[id]` / `goals` / `grocery`); it gates a
 first-launch `onboarding.tsx` behind `Stack.Protected` on the persisted `hasOnboarded` flag (only after
 the store hydrates). `(tabs)/_layout.tsx` is the 5-tab bar (Today / Plan / Recipes / Foods / Trends);
 Goals moved out of the tab bar to a stack screen reached from Settings.
- **State:** single zustand store in `src/lib/store.ts`, persisted to AsyncStorage. Local-first, single user.
 The USDA seed library is **not** persisted — it's combined with user ingredients at read time
 (`getIngredient`, plus the inline seed+user merge in the Foods/Recipe screens). Persisted keys:
 `hasOnboarded`, `userIngredients`, `recipes`, `log`, `goals`, `settings`, `savedMeals`, `plan`,
 `weights`, `notes`, `groceryChecked`, `goalOverrides`, `pinnedNutrients`, `pantry`, `menus`.
 The `settings` slice
 (`Settings { usdaApiKey }`) is edited via `setUsdaApiKey`; `resetData` clears everything except
 `settings` + `hasOnboarded` and resets `goals`.
 New store fields are optional-with-defaults
 (no hard migration of old `smriti-store-v1` data). `addLogEntry` snapshots absolute `nutrients` + a
 display `label` at log time (for recipe/ingredient too), so `resolveEntryNutrients` prefers the stored
 snapshot and only falls back to live computation for pre-snapshot entries.
- **Nutrition math:** all in `src/lib/nutrition.ts`. Canonical unit is **grams**; ingredients store
  nutrients **per 100 g**; household units (cup, egg…) are conversions in `src/lib/units.ts`.
- **Meal planning:** `src/lib/grocery.ts` (pure, tested) owns week math (Monday-start), grocery
  aggregation from the weekly `plan` (leftover entries excluded), cost totals from ingredient
  prices, pantry subtraction (`applyPantry` — an untracked pantry item drops the line, a tracked
  one subtracts its grams + proportional cost, ≤0 dropped; `pantryCoverage` for the caption), and
  the `groceryChecked` key format (`${weekStart}:${ingredientId}`). Screens: `(tabs)/plan.tsx` +
  `grocery.tsx` — Plan saves the visible week as a reusable menu and re-applies menus to other
  weeks (`saveMenu` / `applyMenu` / `deleteMenu`; `menus` holds `WeekMenu` templates with
  `dayOffset`-relative entries); Grocery's per-line "have it" toggle and Pantry section edit the
  `pantry` slice (`PantryItem { ingredientId, grams? }`, grams omitted = untracked) via
  `setPantryItem` / `removePantryItem`.
- **Goal scheduling:** `src/lib/goals.ts` (pure, tested: `weekdayOf`, `effectiveGoals`,
  `hasOverride`) merges the per-weekday `goalOverrides` (`Partial<Goals>`, blank field = inherit
  base) onto `goals`. Edited in `goals.tsx` ("Weekly schedule", Monday-first chips), which also
  toggles `pinnedNutrients` (`togglePinnedNutrient`, one chip per MICROS entry). Today displays
  the weekday's effective targets (with an "adjusted for {day}" hint) and pinned-nutrient
  daily-total tiles.
- **Logging accelerators:** the `log-add` modal has five modes (Foods / Recipes / Meals / Quick
  add / Water) with Recent/Frequent shortcut chips derived from the log (last-used portions);
  `savedMeals` templates are created from Today ("Save as meal…" on a meal section) and logged
  whole via `logSavedMeal`. Today rows expand into an inline editor — `updateLogEntry` rescales
  the frozen nutrient snapshot linearly when grams/servings change — plus "Copy yesterday"
  buttons (`copyLogEntries`), a ≥2-day streak badge, and a per-day note (`notes` via `setNote`).
- **Analytics & export:** `src/lib/trends.ts` (pure, tested: `dayTotals`, `lastNDays`,
  `rangeAverages`, `currentStreak`, `weightTrend` — EWMA, α = 0.3 — and `waterByDay`) backs the
  Trends tab (`(tabs)/trends.tsx`): 7/30/90-day averages vs goals, a calorie bar chart (daily at
  7 days, Monday-start weekly buckets beyond, with goal line), a month history calendar banded by
  calories with tap-for-day summaries, and weight quick-add + trend chart. `src/lib/csv.ts`
  (`logToCsv`, `dayTotalsToCsv`, `weightsToCsv`; RFC 4180 escaping) backs the Settings "Export"
  section, which writes CSVs via the new expo-file-system API (`File`, `Paths`) and hands them to
  the expo-sharing share sheet.
- **External food import (the only two network features — everything else is offline):**
  `src/services/openFoodFacts.ts` (`fetchProduct`) backs the `scan` barcode modal
  (`src/app/scan.tsx`, expo-camera `CameraView`); `src/services/usda.ts` (`searchFoods`) backs the
  `food-search` modal and needs the free USDA API key stored in settings (`src/app/settings.tsx`).
  Both prefill `src/app/food/new.tsx` via its `prefill` route param; the mappers in
  `src/lib/import.ts` (`offProductToIngredient`, `usdaFoodToIngredient`) normalize external data
  to per-100 g nutrients (OFF minerals g→mg) and map serving sizes to a Portion. `Ingredient` has
  an optional `barcode`.
- **Seed data:** `assets/data/seed-ingredients.json` is generated by `scripts/build-seed.mjs` from USDA
  FoodData Central. **Never hand-edit the JSON or invent nutrient numbers** — re-run the script.

## Conventions
- Reuse the UI kit in `src/components/ui` (Card, Button, Field, Segmented, progress, ring) and `Screen`.
- Keep `npx tsc --noEmit`, `npx expo lint`, and `npm test` clean. `reactCompiler` and `typedRoutes`
  are enabled. Tests are jest (`jest-expo` preset, `jest.config.js`, AsyncStorage mocked in
  `jest.setup.js`) and live under `src/lib/__tests__/*.test.ts`.
- No simulator here — verify changes bundle with `npx expo export -p ios`; the user previews via Expo Go.
- CI: `.github/workflows/ci.yml` runs typecheck + lint + test + the iOS export on push/PR;
  `.github/workflows/eas-build.yml` (manual dispatch or `v*` tag) runs `eas build -p ios` using
  the profiles in `eas.json` and requires an `EXPO_TOKEN` repo secret.

## Keeping documentation in sync (do this on every change)

A change isn't done until the docs agree with the code. When you change a file, a
cross-reference, a command, or the project structure, spin up a subagent (`Agent` tool,
`general-purpose` type) whose sole job is to bring the docs back into agreement with the code.

Documentation surface to reconcile:
- `AGENTS.md` (this file) — architecture, invariants, the seed pipeline, the store seam, commands.
- `CLAUDE.md` — a thin pointer that imports this file (`@AGENTS.md`). Claude Code reads it; other
  tools read `AGENTS.md` directly — so **this file is the single source of truth for both**. Keep
  CLAUDE.md's summary pointer accurate; don't fork the checklists into it.
- `README.md` — human-facing overview, run/seed instructions, roadmap.
- `app.json` — identity (`name`/`slug`/`scheme` = `Smriti`/`smriti`/`smriti`), splash color, plugins.
- Inline references inside all of the above — file paths (`src/app/(tabs)/…`, `src/lib/*`,
  `src/services/*`, `scripts/build-seed.mjs`, `jest.config.js`, `eas.json`,
  `.github/workflows/*`), symbol names (`getIngredient` / `resolveEntryNutrients` /
  `recipePerServing` / `fetchProduct` / `searchFoods` / `offProductToIngredient` /
  `usdaFoodToIngredient` / `setUsdaApiKey` / `resetData` / `updateLogEntry` / `copyLogEntries` /
  `logSavedMeal` / `weightTrend` / `logToCsv` / `effectiveGoals` / `applyPantry`), persisted
  store keys (`hasOnboarded`, `userIngredients`, `recipes`, `log`, `goals`, `settings`,
  `savedMeals`, `plan`, `weights`, `notes`, `groceryChecked`, `goalOverrides`,
  `pinnedNutrients`, `pantry`, `menus`), the persisted store name
  (`smriti-store-v1`), commands (`npx expo start`, `npx tsc --noEmit`, `npx expo lint`,
  `npm test`, `npx expo export -p ios`, `node scripts/build-seed.mjs`), and counts like the seed
  ingredient total (**currently 32**).

Trigger it when you: add/rename/move/delete a screen under `src/app` or a module under `src/lib`
or `src/services`; change the store shape or which keys are persisted; touch an invariant (per-100 g basis,
grams-canonical, seed-not-persisted); change the seed pipeline or the `FOODS` list / nutrient-ID
map in `scripts/build-seed.mjs` (which changes the ingredient count); rename a command; or change
`app.json` identity.
Skip it only when every doc claim stays true (an internal refactor with no rename, no behavior
change, no structural shift).

Hand the subagent: a summary of what changed, the files/symbols touched, and the list above.
Have it (1) grep the docs for now-stale paths, symbols, numbers, and commands, (2) update every
match plus any prose that drifted, and (3) report what it changed. Verify its edits before you
finish. (Note: `expo-env.d.ts` and `.expo/` are generated and gitignored — never document them
as source.)

## Preventing code rot (do this on every change too)

A change that adds the new without retiring the old leaves rot behind. After a change, spin up a
second `general-purpose` subagent whose sole job is to find and remove what your change made
redundant. Run it alongside the doc-sync pass, scoped to the files/symbols you touched. This
catches what the `npx tsc --noEmit` + `npx expo lint` + `npm test` gate does NOT: unused
**exports**, orphaned files, and superseded logic. (`expo lint` flags unused *locals and imports*,
and `noUnusedLocals` / `noUnusedParameters` are enabled in `tsconfig.json` — but nothing here
flags unused *exports*.) **There is no `npm run build` in this project** — those three
commands are the gate.

What it hunts for:
- **Orphaned files** — a screen/component/module no longer imported anywhere (e.g. a superseded
  screen after a redesign), or template leftovers once nothing references them (the original
  batch — `scripts/reset-project.js`, unused `assets/images/` — has already been removed).
- **Dead exports** — exported functions/consts/types with zero importers. Watch `src/lib`
  especially: **neither `tsc` nor `expo lint` flags unused *exports*, so store actions with no UI
  caller and unused helpers/constants in `nutrition.ts` accumulate silently.**
- **Superseded logic** — an old code path left when a new one took over (a duplicate nutrition
  helper, an unreachable branch in `resolveEntryNutrients`, a replaced component).
- **Stale config / data** — `package.json` deps no longer imported; dangling references in
  `tsconfig.json` / `eslint.config.js` to paths that moved. The cached USDA dataset lives under
  `scripts/.cache/` and is **gitignored on purpose** — never treat it as source and never leave a
  committed copy behind.

Trigger it when you rename/move/replace/delete code, swap an implementation, or regenerate the
seed. Skip it only for purely additive changes with no predecessor to retire.

Hand the subagent the change summary and touched paths. Have it (1) grep for imports/usages to
prove each candidate is truly unreferenced before deleting — never on a hunch, (2) delete only what
it can prove is dead, (3) run `npx tsc --noEmit`, `npx expo lint`, and `npm test` to confirm nothing broke, and
(4) report each removal with the evidence. Have it flag ambiguous cases rather than delete them.
Review its deletions before you finish.
