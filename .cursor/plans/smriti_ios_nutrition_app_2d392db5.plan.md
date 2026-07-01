---
name: Smriti iOS Nutrition App
overview: "Build \"Smriti,\" a native iOS (SwiftUI + SwiftData, local-only) nutrition app for a home-cooking college student: scan/search ingredients into a personal library, build recipes that auto-compute macros, log meals/water against preset-based daily goals, and see progress on a warm, ring-based dashboard. AI coaching, restaurant APIs, meal planning/grocery lists, and community sharing are explicitly deferred to later phases."
todos:
  - id: scaffold
    content: Create the Xcode SwiftUI project 'Smriti', configure SwiftData ModelContainer, and build the design system (earthy/green palette, macro progress-ring component, card styles).
    status: pending
  - id: models
    content: "Implement SwiftData models: DailyGoal, Ingredient, Recipe, RecipeItem, LogEntry, with enums and computed per-serving macro helpers (NutritionMath)."
    status: pending
  - id: onboarding
    content: "Build onboarding + Settings goals: diet preset templates (Balanced, High-Protein, Keto, Low-Carb, Vegan, Maintenance) that seed editable calorie/macro/water targets."
    status: pending
  - id: pantry_services
    content: "Build Pantry: ingredient list + editable add/edit form, OpenFoodFactsService (barcode), USDAService (text search, API key in Settings), and VisionKit barcode scanner view; optional price field."
    status: pending
  - id: recipes
    content: "Build Recipes: create/edit with ingredient lines (grams or # servings), yields N servings, diet tags, live per-serving macro readout, and recipe detail."
    status: pending
  - id: today_logging
    content: "Build Today screen: macro rings + calorie/fiber/water progress, Breakfast/Lunch/Dinner/Snacks sections, water quick-add, and the add-entry sheet writing snapshot LogEntries."
    status: pending
  - id: polish_qa
    content: Polish UI, handle offline/error states for lookups, verify macro math and snapshot integrity, and test on-device.
    status: pending
isProject: false
---

# Smriti - Home-Cook Nutrition Tracker (iOS)

## Decisions locked in during grilling
- Platform: native iOS, SwiftUI + SwiftData, local-only (no login, no server).
- V1 = the core loop only: Dashboard + Pantry(ingredient library) + Recipes + Logging (+ Water).
- Tracked metrics: Calories, Protein, Carbs, Fat, Fiber, Water.
- Goals set via diet presets (Balanced, High-Protein, Keto, Low-Carb, Vegan, Maintenance), fully editable.
- Ingredient data: barcode -> Open Food Facts; text search -> USDA FoodData Central; manual fallback. All prefill an editable form.
- Pantry = ingredient library only (no quantity/depletion tracking in V1). Optional price field on ingredients.
- Recipe units: nutrition stored per 100g + optional household serving (label + gram weight); recipe lines in grams or # servings; recipe "yields N servings"; per-serving macros auto-computed.
- Daily log grouped into Breakfast/Lunch/Dinner/Snacks + separate Water tracker.
- Log entries store a frozen macro snapshot (plus a soft reference to the source recipe/ingredient).
- Visual: clean warm modern iOS, macro progress rings, earthy/green "nourishing" palette.

## Tech stack
- Swift 5.9+, SwiftUI, SwiftData (requires recent iOS; target latest 2 iOS versions).
- Barcode scanning: VisionKit `DataScannerViewController` wrapped for SwiftUI.
- Networking: `URLSession` + async/await to two free APIs, called directly from the app:
  - Open Food Facts (barcode lookup, no key needed).
  - USDA FoodData Central (text search, needs a free API key).
- Offline behavior: all logging/recipes/pantry work offline; only barcode/USDA lookups need internet.

## Data model (SwiftData `@Model`)
- `DailyGoal`: presetName, calorieTarget, proteinG, carbG, fatG, fiberG, waterTargetMl. (Single active goal, editable.)
- `Ingredient` (library): name, brand?, source(enum: openFoodFacts/usda/manual), barcode?, per-100g values (kcal, protein, carb, fat, fiber, optional sugar/sodium), householdServingLabel?, householdServingGrams?, pricePerUnit? + priceUnitGrams? (optional).
- `Recipe`: name, notes?, steps?, yieldsServings, prepTimeMinutes?, dietTags[]; relationship -> [`RecipeItem`]. Computed per-serving macros.
- `RecipeItem`: ingredient (ref), amountGrams (servings-count entry converted to grams on save).
- `LogEntry`: date, mealType(enum), sourceType(enum: recipe/ingredient/quick/water), displayName, quantity, snapshot macros (kcal, protein, carb, fat, fiber), sourceRecipeID?/sourceIngredientID?, waterMl?.

## Screens (V1)
1. Onboarding: pick a diet preset -> seeds `DailyGoal` -> review/edit targets.
2. Today (Dashboard + Log): macro rings + calorie/fiber/water progress on top; Breakfast/Lunch/Dinner/Snacks sections; Water quick-add. "+" opens the add sheet.
3. Add-entry sheet: choose Recipe / Pantry ingredient / Quick item; set meal + quantity; writes a snapshot `LogEntry`.
4. Pantry: searchable ingredient list; add via Scan barcode / Search foods / Manual -> editable form.
5. Recipes: list; create/edit (add ingredient lines with grams or servings, set yield, live per-serving macro readout, diet tags); recipe detail.
6. Settings/Goals: edit targets, switch preset, USDA API key field, basic profile.

## Suggested project structure
- `Smriti/App` (entry, ModelContainer)
- `Smriti/Models` (SwiftData models above)
- `Smriti/Features/Today`, `/Pantry`, `/Recipes`, `/Onboarding`, `/Settings`
- `Smriti/Services` (`OpenFoodFactsService`, `USDAService`, `NutritionMath`, `BarcodeScannerView`)
- `Smriti/DesignSystem` (colors, ring component, cards)

## Deferred roadmap (post-V1, in order you prioritized)
- Phase 2: Meal planning + weekly grocery list + inventory/stock ("out of X" filters) + price roll-ups.
- Phase 3: Recipe ranking (time, ease, taste, macro ratios) + dietary/ingredient filters.
- Phase 4: Restaurant/packaged DB integrations + nutrition-label OCR.
- Phase 5: AI coach (goal-based recommendations, "why I disliked this" learning).
- Phase 6: Cloud backend + community recipe sharing/reviews (requires moving off local-only storage + adding auth).

## Prerequisites / setup notes
- A Mac with Xcode; an Apple ID to run on your own iPhone (free personal team works for on-device installs).
- A free USDA FoodData Central API key (data.gov) entered in Settings.
- No cost, no server to maintain in V1.

## Build order (todos below)
Scaffold project + design system -> models -> onboarding/goals -> pantry + data services + scanner -> recipes -> today/dashboard + logging -> polish/QA.