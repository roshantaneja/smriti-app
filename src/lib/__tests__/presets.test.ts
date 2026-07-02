// Goal presets: every preset must be a complete, internally consistent set of
// Goals — the UI applies them wholesale via setPreset.

import { describe, expect, it } from '@jest/globals';

import { PRESETS } from '../presets';
import type { Goals } from '../types';

const GOAL_FIELDS: (keyof Goals)[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'waterMl'];

describe('PRESETS', () => {
  it('defines at least one preset', () => {
    expect(PRESETS.length).toBeGreaterThan(0);
  });

  it('has unique ids and names', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
  });

  for (const preset of PRESETS) {
    it(`${preset.name} has all six goal fields positive`, () => {
      for (const field of GOAL_FIELDS) {
        expect(preset.goals[field]).toBeGreaterThan(0);
      }
      expect(preset.tagline.length).toBeGreaterThan(0);
    });

    it(`${preset.name} macro kcal roughly matches the calorie target (within 12%)`, () => {
      const { calories, protein, carbs, fat } = preset.goals;
      const macroKcal = protein * 4 + carbs * 4 + fat * 9;
      const deviation = Math.abs(macroKcal - calories) / calories;
      // The shipped presets are actually all within ~3%; 12% is the contract
      // ceiling so a deliberately loose future preset doesn't break the suite.
      expect(deviation).toBeLessThanOrEqual(0.12);
    });
  }
});
