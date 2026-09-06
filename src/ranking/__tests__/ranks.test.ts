import { didChangeTier, progressWithinTier, RANK_TIERS, tierForLp } from '../ranks';

describe('tierForLp', () => {
  it('places 0 LP in Bronze', () => {
    expect(tierForLp(0).tier).toBe('BRONZE');
  });

  it('finds the correct tier at each lower boundary', () => {
    expect(tierForLp(499).tier).toBe('BRONZE');
    expect(tierForLp(500).tier).toBe('SILBER');
    expect(tierForLp(999).tier).toBe('SILBER');
    expect(tierForLp(1000).tier).toBe('GOLD');
    expect(tierForLp(1499).tier).toBe('GOLD');
    expect(tierForLp(1500).tier).toBe('DIAMANT');
    expect(tierForLp(1999).tier).toBe('DIAMANT');
    expect(tierForLp(2000).tier).toBe('CHALLENGER');
  });

  it('keeps Challenger open-ended', () => {
    expect(tierForLp(50000).tier).toBe('CHALLENGER');
  });

  it('covers every LP value with exactly one tier (no gaps/overlaps)', () => {
    for (let lp = 0; lp <= 2500; lp += 1) {
      const matches = RANK_TIERS.filter((t) => lp >= t.minLp && (t.maxLp === null || lp <= t.maxLp));
      expect(matches).toHaveLength(1);
    }
  });
});

describe('progressWithinTier', () => {
  it('reports progress relative to the tier start', () => {
    const progress = progressWithinTier(650);
    expect(progress.tier.tier).toBe('SILBER');
    expect(progress.lpIntoTier).toBe(150);
    expect(progress.lpSpanForTier).toBe(500);
  });

  it('has no span for the open-ended Challenger tier', () => {
    expect(progressWithinTier(2500).lpSpanForTier).toBeNull();
  });
});

describe('didChangeTier', () => {
  it('detects a promotion', () => {
    expect(didChangeTier(490, 510)).toBe(true);
  });

  it('detects a demotion', () => {
    expect(didChangeTier(510, 490)).toBe(true);
  });

  it('is false when staying within the same tier', () => {
    expect(didChangeTier(100, 150)).toBe(false);
  });
});
