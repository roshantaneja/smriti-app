// Per-weekday goal scheduling (calorie cycling / training days).
//
// Base goals live in the store; each weekday may carry a *partial* override.
// These helpers resolve a calendar day (YYYY-MM-DD, local) to its weekday and
// merge the override on top of the base — only fields present in the override
// win, so blank override fields inherit the base goal.

import type { Goals, Weekday } from "./types";

const GOAL_KEYS: (keyof Goals)[] = ["calories", "protein", "carbs", "fat", "fiber", "waterMl"];

// Indexed by Date#getDay() (0 = Sunday).
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Weekday for a local YYYY-MM-DD day key. Parses the parts directly (never
 * Date.parse, which would read the string as UTC) and anchors at noon so DST
 * transitions can't shift the date.
 */
export function weekdayOf(dayKeyStr: string): Weekday {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d, 12).getDay()];
}

/**
 * Base goals with the day's weekday override shallow-merged on top. Only
 * fields actually set (as numbers) in the override replace the base values.
 */
export function effectiveGoals(
  goals: Goals,
  overrides: Partial<Record<Weekday, Partial<Goals>>>,
  dayKeyStr: string,
): Goals {
  const override = overrides[weekdayOf(dayKeyStr)];
  if (!override) return goals;
  const out: Goals = { ...goals };
  for (const key of GOAL_KEYS) {
    const v = override[key];
    if (typeof v === "number") out[key] = v;
  }
  return out;
}

/** Whether the given day's weekday carries a non-empty goal override. */
export function hasOverride(
  overrides: Partial<Record<Weekday, Partial<Goals>>>,
  dayKeyStr: string,
): boolean {
  const override = overrides[weekdayOf(dayKeyStr)];
  return override != null && Object.keys(override).length > 0;
}
