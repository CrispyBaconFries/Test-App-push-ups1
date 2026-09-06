/**
 * Käufliche Rahmen-"Skins" (Münz-Shop, siehe gamification/shop.ts): ersetzen nur die
 * Farben des Rang-Rahmens (`RankFrame.tsx`), nicht dessen Struktur (Ringdicke/Glow/
 * Pulsieren bleiben von der Rang-Stufe bestimmt, siehe `rankFrameStyle.ts`) - der Rahmen
 * kommuniziert also weiterhin ehrlich den erreichten Rang, das Theme ist reine
 * Personalisierung obendrauf.
 */
export const FRAME_THEME_IDS = ['default', 'inferno', 'aqua', 'royal', 'toxic', 'monochrome'] as const;

export type FrameThemeId = (typeof FRAME_THEME_IDS)[number];

export interface FrameThemeDefinition {
  id: FrameThemeId;
  label: string;
  /** null = kein Override, es bleibt bei der normalen Rang-Farbe. */
  gradientColors: readonly [string, string, ...string[]] | null;
}

const FRAME_THEMES: Record<FrameThemeId, FrameThemeDefinition> = {
  default: { id: 'default', label: 'Standard (Rang-Farbe)', gradientColors: null },
  inferno: { id: 'inferno', label: 'Inferno', gradientColors: ['#FFD36E', '#FF5A5F', '#8C1A1A'] },
  aqua: { id: 'aqua', label: 'Aqua', gradientColors: ['#D6F6FF', '#2E9FE8', '#1B4E7A'] },
  royal: { id: 'royal', label: 'Royal', gradientColors: ['#F3D9FF', '#B23AFF', '#4B1780'] },
  toxic: { id: 'toxic', label: 'Toxic', gradientColors: ['#EFFF9E', '#7ED321', '#3D6E0F'] },
  monochrome: { id: 'monochrome', label: 'Monochrom', gradientColors: ['#FFFFFF', '#9AA5AD', '#2B2F33'] },
};

export function frameThemeById(id: FrameThemeId): FrameThemeDefinition {
  return FRAME_THEMES[id];
}

export function isPurchasableFrameTheme(id: FrameThemeId): boolean {
  return id !== 'default';
}
