import { frameStyleForTier } from '../rankFrameStyle';
import { RANK_TIERS } from '../ranks';

describe('frameStyleForTier', () => {
  it('defines a style for every rank tier', () => {
    for (const { tier } of RANK_TIERS) {
      expect(frameStyleForTier(tier).tier).toBe(tier);
    }
  });

  it('gets thicker as the tier rises', () => {
    const widths = RANK_TIERS.map((t) => frameStyleForTier(t.tier).borderWidth);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    }
  });

  it('only glows from Diamant upward', () => {
    expect(frameStyleForTier('GOLD').glow).toBe(false);
    expect(frameStyleForTier('DIAMANT').glow).toBe(true);
    expect(frameStyleForTier('CHALLENGER').glow).toBe(true);
  });

  it('only pulses for Challenger', () => {
    for (const { tier } of RANK_TIERS) {
      expect(frameStyleForTier(tier).pulse).toBe(tier === 'CHALLENGER');
    }
  });

  it('gives every tier at least two gradient colors', () => {
    for (const { tier } of RANK_TIERS) {
      expect(frameStyleForTier(tier).gradientColors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
