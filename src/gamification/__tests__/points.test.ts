import { levelForPoints, pointsForRep, totalPointsForReps } from '../points';
import type { RepResult } from '../../pose/formAnalysis';

function rep(formScore: number): RepResult {
  return {
    index: 0,
    formScore,
    issues: [],
    minElbowAngleDeg: 90,
    minHipStraightnessDeg: 180,
    maxElbowFlareDeg: 30,
    minNeckAngleDeg: 175,
    durationMs: 900,
  };
}

describe('pointsForRep', () => {
  it('awards full base points plus a bonus for a perfect rep', () => {
    expect(pointsForRep(rep(100))).toBe(15); // 10 base + 5 perfect-form bonus
  });

  it('scales points down for a mediocre rep, no bonus', () => {
    expect(pointsForRep(rep(50))).toBe(5);
  });

  it('never drops below the floor, even for a very bad rep', () => {
    expect(pointsForRep(rep(0))).toBe(2);
  });
});

describe('totalPointsForReps', () => {
  it('sums points across all reps', () => {
    const total = totalPointsForReps([rep(100), rep(50), rep(0)]);
    expect(total).toBe(15 + 5 + 2);
  });

  it('is 0 for an empty set', () => {
    expect(totalPointsForReps([])).toBe(0);
  });
});

describe('levelForPoints', () => {
  it('starts at level 1 with 0 points', () => {
    expect(levelForPoints(0)).toEqual({ level: 1, pointsIntoLevel: 0, pointsForNextLevel: 250 });
  });

  it('advances a level every 250 points', () => {
    expect(levelForPoints(250)).toEqual({ level: 2, pointsIntoLevel: 0, pointsForNextLevel: 250 });
    expect(levelForPoints(499)).toEqual({ level: 2, pointsIntoLevel: 249, pointsForNextLevel: 250 });
  });
});
