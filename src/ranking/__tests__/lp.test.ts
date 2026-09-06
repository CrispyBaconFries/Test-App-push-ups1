import {
  applyLpChange,
  computeLossLpFactor,
  computeMatchLpChange,
  computeWinLpGain,
  expectedWinProbability,
} from '../lp';

describe('expectedWinProbability', () => {
  it('is 0.5 for equal LP', () => {
    expect(expectedWinProbability(1000, 1000)).toBeCloseTo(0.5);
  });

  it('favors the higher-LP player', () => {
    expect(expectedWinProbability(1400, 1000)).toBeGreaterThan(0.5);
    expect(expectedWinProbability(1000, 1400)).toBeLessThan(0.5);
  });

  it('is symmetric', () => {
    const a = expectedWinProbability(1200, 900);
    const b = expectedWinProbability(900, 1200);
    expect(a + b).toBeCloseTo(1);
  });
});

describe('computeWinLpGain', () => {
  it('stays within the documented 12-35 band', () => {
    for (let expected = 0; expected <= 1; expected += 0.05) {
      const gain = computeWinLpGain(expected);
      expect(gain).toBeGreaterThanOrEqual(12);
      expect(gain).toBeLessThanOrEqual(35);
    }
  });

  it('gives an underdog win more LP than a favorite win', () => {
    const underdogWin = computeWinLpGain(0.1); // won despite being unlikely to
    const favoriteWin = computeWinLpGain(0.9); // won as expected
    expect(underdogWin).toBeGreaterThan(favoriteWin);
  });
});

describe('computeLossLpFactor', () => {
  it('stays within the requested 40%-60% band', () => {
    for (let expected = 0; expected <= 1; expected += 0.05) {
      const factor = computeLossLpFactor(expected);
      expect(factor).toBeGreaterThanOrEqual(0.4);
      expect(factor).toBeLessThanOrEqual(0.6);
    }
  });

  it('never reaches the full win amount, so ranking up stays reachable', () => {
    expect(computeLossLpFactor(1)).toBeLessThan(1);
  });
});

describe('computeMatchLpChange', () => {
  it('always gains the winner more than it costs an equivalent loser', () => {
    const { winnerLpChange, loserLpChange } = computeMatchLpChange(1000, 1000);
    expect(winnerLpChange).toBeGreaterThan(0);
    expect(loserLpChange).toBeLessThan(0);
    expect(Math.abs(loserLpChange)).toBeLessThan(winnerLpChange);
  });

  it('rewards an upset (underdog beats a much higher-LP favorite) heavily', () => {
    const { winnerLpChange } = computeMatchLpChange(800, 1600);
    expect(winnerLpChange).toBe(35);
  });

  it('barely rewards a heavy favorite for beating a much weaker opponent', () => {
    const { winnerLpChange } = computeMatchLpChange(1600, 800);
    expect(winnerLpChange).toBe(12);
  });
});

describe('applyLpChange', () => {
  it('adds the change normally', () => {
    expect(applyLpChange(1000, 20)).toBe(1020);
  });

  it('floors at 0 instead of going negative', () => {
    expect(applyLpChange(10, -25)).toBe(0);
  });
});
