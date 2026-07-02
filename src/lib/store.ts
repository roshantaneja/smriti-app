// Global app state — local-first, persisted to device storage.
//
// The seed ingredient library is NOT persisted; getIngredient reads it, and the
// user's own ingredients are merged in at read time. That keeps storage small
// and lets seed updates flow through on app upgrades.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { uid } from "./id";
import { addDays, weekDays, weekStart } from "./grocery";
import { computeEntryNutrients, scaleNutrientsBy } from "./nutrition";
import { SEED_INGREDIENTS } from "./seed";
import type {
  Goals,
  Ingredient,
  LogEntry,
  MealType,
  NutrientKey,
  PantryItem,
  PlanEntry,
  Recipe,
  SavedMeal,
  SavedMealItem,
  Settings,
  Weekday,
  WeekMenu,
  WeightEntry,
} from "./types";
import { dayKey } from "./date";

const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 120,
  carbs: 220,
  fat: 65,
  fiber: 30,
  waterMl: 2500,
};

const DEFAULT_SETTINGS: Settings = {
  usdaApiKey: "",
};

interface AppState {
  _hydrated: boolean;

  /** False until the user finishes (or skips) the first-launch onboarding. */
  hasOnboarded: boolean;

  userIngredients: Ingredient[];
  recipes: Recipe[];
  log: LogEntry[];
  goals: Goals;
  settings: Settings;
  savedMeals: SavedMeal[];
  plan: PlanEntry[];
  weights: WeightEntry[];
  /** Free-text day journal, keyed by YYYY-MM-DD. */
  notes: Record<string, string>;
  /** Grocery checklist state; keys are defined by src/lib/grocery.ts. */
  groceryChecked: Record<string, boolean>;
  /** Per-weekday goal overrides (calorie cycling / training days). */
  goalOverrides: Partial<Record<Weekday, Partial<Goals>>>;
  /** Extra nutrients pinned as dashboard tiles on Today. */
  pinnedNutrients: NutrientKey[];
  /** Ingredients already at home — subtracted from grocery lists. */
  pantry: PantryItem[];
  /** Reusable week templates for the planner. */
  menus: WeekMenu[];

  // Derived lookups (seed first, then user).
  getIngredient: (id: string) => Ingredient | undefined;
  getRecipe: (id: string) => Recipe | undefined;

  // Ingredients
  addIngredient: (input: Omit<Ingredient, "id"> & { id?: string }) => Ingredient;
  updateIngredient: (id: string, patch: Partial<Ingredient>) => void;
  deleteIngredient: (id: string) => void;

  // Recipes
  addRecipe: (input: Omit<Recipe, "id" | "createdAt"> & { id?: string }) => Recipe;
  updateRecipe: (id: string, patch: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;

  // Log
  addLogEntry: (input: Omit<LogEntry, "id" | "createdAt">) => void;
  deleteLogEntry: (id: string) => void;
  addWater: (ml: number, date?: string) => void;
  /**
   * Edit a logged entry. When `grams` (ingredient) or `servings` (recipe)
   * changes, the stored snapshot is rescaled linearly — history stays frozen
   * against later source edits, but the portion correction is exact.
   */
  updateLogEntry: (id: string, patch: Partial<Pick<LogEntry, "grams" | "servings" | "meal" | "label">>) => void;
  /** Clone `fromDate`'s entries (optionally one meal) onto `toDate`. */
  copyLogEntries: (fromDate: string, toDate: string, meal?: MealType) => void;

  // Saved meals (log-together templates)
  addSavedMeal: (name: string, items: SavedMealItem[]) => SavedMeal;
  deleteSavedMeal: (id: string) => void;
  /** Expand a saved meal into individual snapshot log entries. */
  logSavedMeal: (id: string, date: string, meal: MealType) => void;

  // Weekly plan
  addPlanEntry: (input: Omit<PlanEntry, "id">) => PlanEntry;
  deletePlanEntry: (id: string) => void;
  /** Log a planned slot to the daily log (does not remove it from the plan). */
  logPlanEntry: (id: string) => void;

  // Weight
  addWeight: (kg: number, date?: string) => void;
  deleteWeight: (id: string) => void;

  /** Set (or clear, with empty text) the free-text note for a day. */
  setNote: (date: string, text: string) => void;

  toggleGroceryChecked: (key: string) => void;
  clearGroceryChecked: (keys: string[]) => void;

  duplicateRecipe: (id: string) => Recipe | undefined;

  /** Set (patch) or clear (null) one weekday's goal override. */
  setGoalOverride: (day: Weekday, patch: Partial<Goals> | null) => void;
  togglePinnedNutrient: (key: NutrientKey) => void;

  // Pantry (upsert by ingredientId)
  setPantryItem: (ingredientId: string, grams?: number) => void;
  removePantryItem: (ingredientId: string) => void;

  // Reusable week menus
  /** Snapshot the given week's plan as a named template. Null if week empty. */
  saveMenu: (name: string, weekStartKey: string) => WeekMenu | null;
  /** Materialize a template onto a week as plan entries. */
  applyMenu: (id: string, weekStartKey: string) => void;
  deleteMenu: (id: string) => void;

  setGoals: (patch: Partial<Goals>) => void;
  /** Replace all goals at once (used when applying a preset). */
  setPreset: (goals: Goals) => void;
  setHasOnboarded: (value: boolean) => void;

  setUsdaApiKey: (key: string) => void;
  /** Wipe all user data (ingredients, recipes, log) and reset goals to default. */
  resetData: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      _hydrated: false,
      hasOnboarded: false,

      userIngredients: [],
      recipes: [],
      log: [],
      goals: DEFAULT_GOALS,
      settings: DEFAULT_SETTINGS,
      savedMeals: [],
      plan: [],
      weights: [],
      notes: {},
      groceryChecked: {},
      goalOverrides: {},
      pinnedNutrients: [],
      pantry: [],
      menus: [],

      getIngredient: (id) =>
        SEED_INGREDIENTS.find((i) => i.id === id) ??
        get().userIngredients.find((i) => i.id === id),
      getRecipe: (id) => get().recipes.find((r) => r.id === id),

      addIngredient: (input) => {
        const ing: Ingredient = { ...input, id: input.id ?? uid("ing-") };
        set((s) => ({ userIngredients: [...s.userIngredients, ing] }));
        return ing;
      },
      updateIngredient: (id, patch) =>
        set((s) => ({
          userIngredients: s.userIngredients.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      deleteIngredient: (id) =>
        set((s) => ({ userIngredients: s.userIngredients.filter((i) => i.id !== id) })),

      addRecipe: (input) => {
        const recipe: Recipe = {
          ...input,
          id: input.id ?? uid("rec-"),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ recipes: [...s.recipes, recipe] }));
        return recipe;
      },
      updateRecipe: (id, patch) =>
        set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRecipe: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),

      addLogEntry: (input) => {
        // Snapshot absolute nutrients + a display label at log time so editing
        // or deleting the source recipe/ingredient never rewrites history.
        let { nutrients, label } = input;
        if (input.kind === "recipe" || input.kind === "ingredient") {
          const { getIngredient, getRecipe } = get();
          nutrients = computeEntryNutrients(input, { getIngredient, getRecipe });
          label =
            label ??
            (input.kind === "recipe"
              ? getRecipe(input.recipeId ?? "")?.name
              : getIngredient(input.ingredientId ?? "")?.name);
        }
        set((s) => ({
          log: [
            ...s.log,
            { ...input, nutrients, label, id: uid("log-"), createdAt: new Date().toISOString() },
          ],
        }));
      },
      deleteLogEntry: (id) => set((s) => ({ log: s.log.filter((e) => e.id !== id) })),
      addWater: (ml, date) =>
        set((s) => ({
          log: [
            ...s.log,
            {
              id: uid("log-"),
              date: date ?? dayKey(),
              kind: "water",
              waterMl: ml,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateLogEntry: (id, patch) =>
        set((s) => ({
          log: s.log.map((e) => {
            if (e.id !== id) return e;
            const next = { ...e, ...patch };
            // Rescale the frozen snapshot when the portion changes.
            if (e.nutrients) {
              if (e.kind === "ingredient" && patch.grams != null && e.grams && e.grams > 0) {
                next.nutrients = scaleNutrientsBy(e.nutrients, patch.grams / e.grams);
              } else if (e.kind === "recipe" && patch.servings != null && e.servings && e.servings > 0) {
                next.nutrients = scaleNutrientsBy(e.nutrients, patch.servings / e.servings);
              }
            }
            return next;
          }),
        })),
      copyLogEntries: (fromDate, toDate, meal) =>
        set((s) => {
          const copies = s.log
            .filter((e) => e.date === fromDate && (meal ? e.meal === meal : true))
            .map((e) => ({
              ...e,
              id: uid("log-"),
              date: toDate,
              createdAt: new Date().toISOString(),
            }));
          return copies.length ? { log: [...s.log, ...copies] } : {};
        }),

      addSavedMeal: (name, items) => {
        const savedMeal: SavedMeal = {
          id: uid("meal-"),
          name,
          items,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ savedMeals: [...s.savedMeals, savedMeal] }));
        return savedMeal;
      },
      deleteSavedMeal: (id) =>
        set((s) => ({ savedMeals: s.savedMeals.filter((m) => m.id !== id) })),
      logSavedMeal: (id, date, meal) => {
        const savedMeal = get().savedMeals.find((m) => m.id === id);
        if (!savedMeal) return;
        for (const item of savedMeal.items) {
          get().addLogEntry({ ...item, date, meal });
        }
      },

      addPlanEntry: (input) => {
        const entry: PlanEntry = { ...input, id: uid("plan-") };
        set((s) => ({ plan: [...s.plan, entry] }));
        return entry;
      },
      deletePlanEntry: (id) => set((s) => ({ plan: s.plan.filter((p) => p.id !== id) })),
      logPlanEntry: (id) => {
        const p = get().plan.find((x) => x.id === id);
        if (!p) return;
        get().addLogEntry({
          date: p.date,
          meal: p.meal,
          kind: p.kind,
          recipeId: p.recipeId,
          servings: p.servings,
          ingredientId: p.ingredientId,
          grams: p.grams,
        });
      },

      addWeight: (kg, date) =>
        set((s) => ({
          weights: [
            ...s.weights,
            { id: uid("wt-"), date: date ?? dayKey(), kg, createdAt: new Date().toISOString() },
          ],
        })),
      deleteWeight: (id) => set((s) => ({ weights: s.weights.filter((w) => w.id !== id) })),

      setNote: (date, text) =>
        set((s) => {
          const notes = { ...s.notes };
          if (text.trim()) notes[date] = text;
          else delete notes[date];
          return { notes };
        }),

      toggleGroceryChecked: (key) =>
        set((s) => ({ groceryChecked: { ...s.groceryChecked, [key]: !s.groceryChecked[key] } })),
      clearGroceryChecked: (keys) =>
        set((s) => {
          const groceryChecked = { ...s.groceryChecked };
          for (const k of keys) delete groceryChecked[k];
          return { groceryChecked };
        }),

      duplicateRecipe: (id) => {
        const source = get().recipes.find((r) => r.id === id);
        if (!source) return undefined;
        const copy: Recipe = {
          ...source,
          id: uid("rec-"),
          name: `${source.name} (copy)`,
          rating: undefined,
          items: source.items.map((it) => ({ ...it })),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ recipes: [...s.recipes, copy] }));
        return copy;
      },

      setGoalOverride: (day, patch) =>
        set((s) => {
          const goalOverrides = { ...s.goalOverrides };
          if (patch && Object.keys(patch).length > 0) goalOverrides[day] = patch;
          else delete goalOverrides[day];
          return { goalOverrides };
        }),
      togglePinnedNutrient: (key) =>
        set((s) => ({
          pinnedNutrients: s.pinnedNutrients.includes(key)
            ? s.pinnedNutrients.filter((k) => k !== key)
            : [...s.pinnedNutrients, key],
        })),

      setPantryItem: (ingredientId, grams) =>
        set((s) => {
          const existing = s.pantry.find((p) => p.ingredientId === ingredientId);
          const item: PantryItem = { ingredientId, ...(grams != null && grams > 0 ? { grams } : {}) };
          return {
            pantry: existing
              ? s.pantry.map((p) => (p.ingredientId === ingredientId ? item : p))
              : [...s.pantry, item],
          };
        }),
      removePantryItem: (ingredientId) =>
        set((s) => ({ pantry: s.pantry.filter((p) => p.ingredientId !== ingredientId) })),

      saveMenu: (name, weekStartKey) => {
        const start = weekStart(weekStartKey);
        const days = weekDays(start);
        const entries = get()
          .plan.filter((p) => days.includes(p.date))
          .map(({ id: _id, date, ...rest }) => ({ ...rest, dayOffset: days.indexOf(date) }));
        if (entries.length === 0) return null;
        const menu: WeekMenu = {
          id: uid("menu-"),
          name,
          entries,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ menus: [...s.menus, menu] }));
        return menu;
      },
      applyMenu: (id, weekStartKey) => {
        const menu = get().menus.find((m) => m.id === id);
        if (!menu) return;
        const start = weekStart(weekStartKey);
        const added: PlanEntry[] = menu.entries.map(({ dayOffset, ...rest }) => ({
          ...rest,
          id: uid("plan-"),
          date: addDays(start, dayOffset),
        }));
        set((s) => ({ plan: [...s.plan, ...added] }));
      },
      deleteMenu: (id) => set((s) => ({ menus: s.menus.filter((m) => m.id !== id) })),

      setGoals: (patch) => set((s) => ({ goals: { ...s.goals, ...patch } })),
      setPreset: (goals) => set(() => ({ goals })),
      setHasOnboarded: (value) => set(() => ({ hasOnboarded: value })),

      setUsdaApiKey: (key) =>
        set((s) => ({ settings: { ...s.settings, usdaApiKey: key } })),
      resetData: () =>
        set(() => ({
          userIngredients: [],
          recipes: [],
          log: [],
          goals: DEFAULT_GOALS,
          savedMeals: [],
          plan: [],
          weights: [],
          notes: {},
          groceryChecked: {},
          goalOverrides: {},
          pinnedNutrients: [],
          pantry: [],
          menus: [],
        })),
    }),
    {
      name: "smriti-store-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        hasOnboarded: s.hasOnboarded,
        userIngredients: s.userIngredients,
        recipes: s.recipes,
        log: s.log,
        goals: s.goals,
        settings: s.settings,
        savedMeals: s.savedMeals,
        plan: s.plan,
        weights: s.weights,
        notes: s.notes,
        groceryChecked: s.groceryChecked,
        goalOverrides: s.goalOverrides,
        pinnedNutrients: s.pinnedNutrients,
        pantry: s.pantry,
        menus: s.menus,
      }),
      onRehydrateStorage: () => () => {
        // Runs after persisted state is merged back in.
        useStore.setState({ _hydrated: true });
      },
    },
  ),
);
