// Global app state — local-first, persisted to device storage.
//
// The seed ingredient library is NOT persisted; getIngredient reads it, and the
// user's own ingredients are merged in at read time. That keeps storage small
// and lets seed updates flow through on app upgrades.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { uid } from "./id";
import { computeEntryNutrients } from "./nutrition";
import { SEED_INGREDIENTS } from "./seed";
import type { Goals, Ingredient, LogEntry, Recipe, Settings } from "./types";
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

      setGoals: (patch) => set((s) => ({ goals: { ...s.goals, ...patch } })),
      setPreset: (goals) => set(() => ({ goals })),
      setHasOnboarded: (value) => set(() => ({ hasOnboarded: value })),

      setUsdaApiKey: (key) =>
        set((s) => ({ settings: { ...s.settings, usdaApiKey: key } })),
      resetData: () =>
        set(() => ({ userIngredients: [], recipes: [], log: [], goals: DEFAULT_GOALS })),
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
      }),
      onRehydrateStorage: () => () => {
        // Runs after persisted state is merged back in.
        useStore.setState({ _hydrated: true });
      },
    },
  ),
);
