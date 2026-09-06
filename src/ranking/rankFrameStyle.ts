import type { RankTier } from './ranks';

/**
 * Beschreibt, wie der Rang-Rahmen um einen Spieler-Avatar aussieht - pure
 * Konfiguration, getrennt von der Rendering-Komponente (`RankFrame.tsx`), damit sich
 * die "wird mit dem Rang cooler"-Logik ohne React-Test-Setup prüfen lässt.
 *
 * Fortschritt: Bronze (schlichter matter Ring) -> Silber (heller, etwas dicker) ->
 * Gold (Farbverlauf) -> Diamant (Farbverlauf + Glow) -> Challenger (mehrfarbiger
 * Farbverlauf + stärkster Glow + leichtes Pulsieren, siehe RankFrame.tsx).
 */
export interface RankFrameStyle {
  tier: RankTier;
  /** Ringdicke in px - wächst mit dem Rang. */
  borderWidth: number;
  /** Farbverlauf für den Ring (>= 2 Farben). Bei Bronze/Silber eine flache "Verlauf" aus nur einem Farbton. */
  gradientColors: readonly [string, string, ...string[]];
  /** Ab Diamant: zusätzlicher Leucht-Schatten um den Rahmen. */
  glow: boolean;
  /** Nur Challenger: leichtes Pulsieren des Rahmens. */
  pulse: boolean;
}

const FRAME_STYLES: Record<RankTier, RankFrameStyle> = {
  BRONZE: {
    tier: 'BRONZE',
    borderWidth: 3,
    gradientColors: ['#AD7A56', '#8C5E3E'],
    glow: false,
    pulse: false,
  },
  SILBER: {
    tier: 'SILBER',
    borderWidth: 4,
    gradientColors: ['#E4E9ED', '#9AA5AD'],
    glow: false,
    pulse: false,
  },
  GOLD: {
    tier: 'GOLD',
    borderWidth: 4,
    gradientColors: ['#FFE9A8', '#E0B93D', '#B8860B'],
    glow: false,
    pulse: false,
  },
  DIAMANT: {
    tier: 'DIAMANT',
    borderWidth: 5,
    gradientColors: ['#D6F6FF', '#5AC8E8', '#2E7FA6'],
    glow: true,
    pulse: false,
  },
  CHALLENGER: {
    tier: 'CHALLENGER',
    borderWidth: 6,
    gradientColors: ['#FFD36E', '#FF5A5F', '#B23AFF'],
    glow: true,
    pulse: true,
  },
};

export function frameStyleForTier(tier: RankTier): RankFrameStyle {
  return FRAME_STYLES[tier];
}
