// Global app state — local-first, persisted to device storage.
//
// The seed ingredient library is NOT persisted; it's combined with the user's
// own ingredients at read time (getAllIngredients). That keeps storage small
// and lets seed updates flow through on app upgrades.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { uid } from "./id";
import { SEED_INGREDIENTS } from "./seed";
import type { Goals, Ingredient, LogEntry, Recipe } from "./types";
import { dayKey } from "./date";

const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 120,
  carbs: 220,
  fat: 65,
  fiber: 30,
  waterMl: 2500,
};

interface AppState {
  _hydrated: boolean;

  userIngredients: Ingredient[];
  recipes: Recipe[];
  log: LogEntry[];
  goals: Goals;

  // Derived lookups (combine seed + user).
  getAllIngredients: () => Ingredient[];
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
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      _hydrated: false,

      userIngredients: [],
      recipes: [],
      log: [],
      goals: DEFAULT_GOALS,

      getAllIngredients: () => [...SEED_INGREDIENTS, ...get().userIngredients],
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

      addLogEntry: (input) =>
        set((s) => ({
          log: [...s.log, { ...input, id: uid("log-"), createdAt: new Date().toISOString() }],
        })),
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
    }),
    {
      name: "smriti-store-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        userIngredients: s.userIngredients,
        recipes: s.recipes,
        log: s.log,
        goals: s.goals,
      }),
      onRehydrateStorage: () => () => {
        // Runs after persisted state is merged back in.
        useStore.setState({ _hydrated: true });
      },
    },
  ),
);
