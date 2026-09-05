import { computeChallengeProgress, DAILY_GOAL_REPS, WEEKLY_GOAL_REPS } from '../challenges';
import { buildSession, type WorkoutSession } from '../../storage/workoutStorage';
import type { RepResult } from '../../pose/formAnalysis';

function rep(): RepResult {
  return {
    index: 0,
    formScore: 90,
    issues: [],
    minElbowAngleDeg: 90,
    minHipStraightnessDeg: 180,
    maxElbowFlareDeg: 30,
    minNeckAngleDeg: 175,
    durationMs: 900,
  };
}

function sessionWith(iso: string, repCount: number): WorkoutSession {
  return buildSession(
    Array.from({ length: repCount }, rep),
    iso,
    iso
  );
}

describe('computeChallengeProgress', () => {
  // A Wednesday, so the Monday-based week start is unambiguous.
  const NOW = new Date('2024-01-10T12:00:00.000Z'); // Wednesday

  it('sums only today for the daily goal', () => {
    const sessions = [
      sessionWith('2024-01-10T07:00:00.000Z', 12),
      sessionWith('2024-01-10T18:00:00.000Z', 10),
      sessionWith('2024-01-09T07:00:00.000Z', 50), // yesterday - not counted
    ];
    const progress = computeChallengeProgress(sessions, NOW);
    expect(progress.dailyReps).toBe(22);
    expect(progress.dailyGoal).toBe(DAILY_GOAL_REPS);
    expect(progress.dailyComplete).toBe(false);
  });

  it('marks the daily goal complete once reps reach it', () => {
    const sessions = [sessionWith('2024-01-10T07:00:00.000Z', DAILY_GOAL_REPS)];
    expect(computeChallengeProgress(sessions, NOW).dailyComplete).toBe(true);
  });

  it('sums the whole Monday-based week for the weekly goal, excluding last week', () => {
    const sessions = [
      sessionWith('2024-01-08T07:00:00.000Z', 40), // Monday this week
      sessionWith('2024-01-10T07:00:00.000Z', 20), // Wednesday this week
      sessionWith('2024-01-07T07:00:00.000Z', 999), // Sunday - last week, excluded
    ];
    const progress = computeChallengeProgress(sessions, NOW);
    expect(progress.weeklyReps).toBe(60);
    expect(progress.weeklyGoal).toBe(WEEKLY_GOAL_REPS);
    expect(progress.weeklyComplete).toBe(false);
  });

  it('is all zero with no sessions', () => {
    const progress = computeChallengeProgress([], NOW);
    expect(progress.dailyReps).toBe(0);
    expect(progress.weeklyReps).toBe(0);
    expect(progress.dailyComplete).toBe(false);
    expect(progress.weeklyComplete).toBe(false);
  });
});
