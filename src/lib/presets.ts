// Goal presets: full, editable starting points for the daily targets.
//
// Each preset carries a complete set of Goals (calories + protein/carbs/fat/
// fiber/water) with numbers chosen to roughly balance (macro kcal ≈ calorie
// target). Applying one replaces all goals; the user can then tweak any field.

import type { Goals } from "./types";

export interface Preset {
  id: string;
  name: string;
  /** One-line description of who the preset suits. */
  tagline: string;
  goals: Goals;
}

export const PRESETS: Preset[] = [
  {
    id: "balanced",
    name: "Balanced",
    tagline: "Even split of protein, carbs, and fat.",
    goals: { calories: 2000, protein: 120, carbs: 220, fat: 65, fiber: 30, waterMl: 2500 },
  },
  {
    id: "high-protein",
    name: "High-protein",
    tagline: "Extra protein for training and muscle.",
    goals: { calories: 2100, protein: 160, carbs: 200, fat: 70, fiber: 30, waterMl: 3000 },
  },
  {
    id: "keto",
    name: "Keto",
    tagline: "Very low carb, high fat.",
    goals: { calories: 1800, protein: 120, carbs: 30, fat: 133, fiber: 20, waterMl: 3000 },
  },
  {
    id: "low-carb",
    name: "Low-carb",
    tagline: "Reduced carbs, moderate fat.",
    goals: { calories: 1900, protein: 140, carbs: 100, fat: 104, fiber: 25, waterMl: 2500 },
  },
  {
    id: "vegetarian-vegan",
    name: "Vegetarian / Vegan",
    tagline: "Plant-forward, higher fiber.",
    goals: { calories: 2000, protein: 90, carbs: 260, fat: 67, fiber: 40, waterMl: 2500 },
  },
  {
    id: "maintenance",
    name: "Maintenance",
    tagline: "Steady upkeep at a slightly higher intake.",
    goals: { calories: 2200, protein: 110, carbs: 260, fat: 80, fiber: 30, waterMl: 2500 },
  },
];
