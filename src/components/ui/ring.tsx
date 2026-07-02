import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A circular macro progress ring, drawn in pure React Native (no SVG).
 *
 * The ring is a filled pie with a punched-out center hole. The pie is swept by
 * two clipped, colored half-discs that rotate about the circle's center:
 *   - the RIGHT half-window renders the arc for 0–180° (rotate `firstDeg`),
 *   - the LEFT half-window renders the arc for 180–360° (rotate `secondDeg`).
 * Each half-disc sits (unrotated) fully outside its clip window, so at 0° it is
 * hidden; rotating it clockwise sweeps a growing wedge into view. A center disc
 * in the card color punches the hole, leaving a ring of width `stroke`.
 *
 * Mirrors the `Bar`/`MacroProgress` semantics: fill is capped at 100% and an
 * over-goal value tints the arc with `theme.danger`; the track uses
 * `theme.backgroundSelected`.
 */
export function Ring({
  label,
  value,
  goal,
  unit,
  color,
  size = 76,
  stroke = 8,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const theme = useTheme();

  const ratio = goal > 0 ? value / goal : 0;
  const over = ratio > 1;
  const pct = Math.max(0, Math.min(1, ratio));
  const deg = pct * 360;
  const firstDeg = Math.min(deg, 180);
  const secondDeg = Math.max(deg - 180, 0);
  const arcColor = over ? theme.danger : color;

  const half = size / 2;
  const hole = size - stroke * 2;

  return (
    <View style={{ alignItems: 'center', gap: Spacing.two, width: size }}>
      <View style={{ width: size, height: size }}>
        {/* Track (base disc) */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: half,
            backgroundColor: theme.backgroundSelected,
          }}
        />

        {/* Right window: arc for 0–180° */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: half,
            width: half,
            height: size,
            overflow: 'hidden',
          }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: -half,
              width: half,
              height: size,
              backgroundColor: arcColor,
              borderTopLeftRadius: half,
              borderBottomLeftRadius: half,
              transformOrigin: 'right center',
              transform: [{ rotate: `${firstDeg}deg` }],
            }}
          />
        </View>

        {/* Left window: arc for 180–360° */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: half,
            height: size,
            overflow: 'hidden',
          }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: half,
              width: half,
              height: size,
              backgroundColor: arcColor,
              borderTopRightRadius: half,
              borderBottomRightRadius: half,
              transformOrigin: 'left center',
              transform: [{ rotate: `${secondDeg}deg` }],
            }}
          />
        </View>

        {/* Center hole */}
        <View
          style={{
            position: 'absolute',
            top: stroke,
            left: stroke,
            width: hole,
            height: hole,
            borderRadius: hole / 2,
            backgroundColor: theme.card,
          }}
        />

        {/* Center content */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ThemedText style={{ fontSize: Math.round(size * 0.26), fontWeight: '800', lineHeight: Math.round(size * 0.3) }}>
            {Math.round(value)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 13 }}>
            {unit}
          </ThemedText>
        </View>
      </View>

      <View style={{ alignItems: 'center' }}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          / {Math.round(goal)} {unit}
        </ThemedText>
      </View>
    </View>
  );
}
