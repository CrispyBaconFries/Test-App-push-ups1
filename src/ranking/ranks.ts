/**
 * Rang-Stufen für den Ranked-Modus. Der Rang ist bewusst *nur* eine Ableitung der LP
 * (keine getrennte Speicherung) - Auf- und Abstieg passieren also automatisch, sobald
 * die LP eine Stufengrenze über- bzw. unterschreiten. Keine "Abstiegs-Sicherung"; das
 * hält das System einfach und lässt sich später gezielt ergänzen, falls gewünscht.
 */

export type RankTier = 'BRONZE' | 'SILBER' | 'GOLD' | 'DIAMANT' | 'CHALLENGER';

export interface RankTierDefinition {
  tier: RankTier;
  label: string;
  minLp: number;
  /** null = nach oben offen (Challenger - Rang untereinander nach LP sortiert). */
  maxLp: number | null;
  color: string;
}

export const RANK_TIERS: readonly RankTierDefinition[] = [
  { tier: 'BRONZE', label: 'Bronze', minLp: 0, maxLp: 499, color: '#AD7A56' },
  { tier: 'SILBER', label: 'Silber', minLp: 500, maxLp: 999, color: '#B7C0C7' },
  { tier: 'GOLD', label: 'Gold', minLp: 1000, maxLp: 1499, color: '#E0B93D' },
  { tier: 'DIAMANT', label: 'Diamant', minLp: 1500, maxLp: 1999, color: '#5AC8E8' },
  { tier: 'CHALLENGER', label: 'Challenger', minLp: 2000, maxLp: null, color: '#FF5A5F' },
];

export const STARTING_LP = 0;

export function tierForLp(lp: number): RankTierDefinition {
  const match = RANK_TIERS.find((t) => lp >= t.minLp && (t.maxLp === null || lp <= t.maxLp));
  // lp is clamped to >= 0 by applyLpChange, so this only falls through for lp < 0,
  // which shouldn't happen - Bronze is the sane floor either way.
  return match ?? RANK_TIERS[0];
}

export interface TierProgress {
  tier: RankTierDefinition;
  /** LP seit Erreichen dieser Stufe. */
  lpIntoTier: number;
  /** LP-Spanne dieser Stufe, oder null bei der offenen Challenger-Stufe. */
  lpSpanForTier: number | null;
}

export function progressWithinTier(lp: number): TierProgress {
  const tier = tierForLp(lp);
  return {
    tier,
    lpIntoTier: lp - tier.minLp,
    lpSpanForTier: tier.maxLp === null ? null : tier.maxLp - tier.minLp + 1,
  };
}

export function didChangeTier(lpBefore: number, lpAfter: number): boolean {
  return tierForLp(lpBefore).tier !== tierForLp(lpAfter).tier;
}
