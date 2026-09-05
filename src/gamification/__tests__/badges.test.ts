import { computeBadgeStatuses, newlyUnlockedBadges } from '../badges';
import { buildSession, computeStats, type WorkoutSession } from '../../storage/workoutStorage';
import type { RepResult } from '../../pose/formAnalysis';

function rep(formScore = 90, issues: RepResult['issues'] = []): RepResult {
  return {
    index: 0,
    formScore,
    issues,
    minElbowAngleDeg: 90,
    minHipStraightnessDeg: 180,
    maxElbowFlareDeg: 30,
    minNeckAngleDeg: 175,
    durationMs: 900,
  };
}

function sessionWith(repCount: number, opts: { issues?: RepResult['issues'] } = {}): WorkoutSession {
  const reps = Array.from({ length: repCount }, () => rep(90, opts.issues ?? []));
  return buildSession(reps, '2024-01-01T08:00:00.000Z', '2024-01-01T08:00:00.000Z');
}

describe('computeBadgeStatuses', () => {
  it('has every badge locked with no sessions at all', () => {
    const statuses = computeBadgeStatuses(computeStats([]), []);
    expect(statuses.every((s) => !s.unlocked)).toBe(true);
  });

  it('unlocks FIRST_SET once 10 total reps are done, but not CENTURY yet', () => {
    const sessions = [sessionWith(10)];
    const statuses = computeBadgeStatuses(computeStats(sessions), sessions);
    const byId = Object.fromEntries(statuses.map((s) => [s.definition.id, s]));
    expect(byId.FIRST_SET.unlocked).toBe(true);
    expect(byId.CENTURY.unlocked).toBe(false);
    expect(byId.CENTURY.progressLabel).toBe('10 / 100');
  });

  it('unlocks PERFECT_SESSION only for a clean session with enough reps', () => {
    const dirty = computeBadgeStatuses(computeStats([sessionWith(5, { issues: ['HIPS_SAGGING'] })]), [
      sessionWith(5, { issues: ['HIPS_SAGGING'] }),
    ]);
    expect(dirty.find((s) => s.definition.id === 'PERFECT_SESSION')?.unlocked).toBe(false);

    const tooShortButClean = computeBadgeStatuses(computeStats([sessionWith(3)]), [sessionWith(3)]);
    expect(tooShortButClean.find((s) => s.definition.id === 'PERFECT_SESSION')?.unlocked).toBe(false);

    const clean = computeBadgeStatuses(computeStats([sessionWith(5)]), [sessionWith(5)]);
    expect(clean.find((s) => s.definition.id === 'PERFECT_SESSION')?.unlocked).toBe(true);
  });
});

describe('newlyUnlockedBadges', () => {
  it('reports only badges that flipped from locked to unlocked', () => {
    const before = computeBadgeStatuses(computeStats([]), []);
    // Not clean (has an issue on every rep), so this only unlocks FIRST_SET and not
    // PERFECT_SESSION too - keeps this test isolated to one badge flipping.
    const sessions = [sessionWith(10, { issues: ['HIPS_SAGGING'] })];
    const after = computeBadgeStatuses(computeStats(sessions), sessions);

    const newBadges = newlyUnlockedBadges(before, after);
    expect(newBadges.map((b) => b.id)).toEqual(['FIRST_SET']);
  });

  it('reports nothing when nothing newly unlocked', () => {
    const sessions = [sessionWith(10)];
    const stats = computeBadgeStatuses(computeStats(sessions), sessions);
    expect(newlyUnlockedBadges(stats, stats)).toEqual([]);
  });
});
