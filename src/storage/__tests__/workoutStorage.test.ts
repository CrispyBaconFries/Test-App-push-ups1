import { buildSession, computeStats, type WorkoutSession } from '../workoutStorage';
import type { RepResult } from '../../pose/formAnalysis';

// jest.global-setup.js pins process.env.TZ to 'Europe/Berlin' for the whole test run
// (set before Jest's workers spawn, since Date ignores TZ changes made afterwards) so
// these tests actually exercise local-day grouping regardless of the host's own
// timezone - without that, a UTC test runner would make the bug this guards against
// pass either way.

afterEach(() => {
  jest.useRealTimers();
});

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

function sessionAt(iso: string): WorkoutSession {
  return buildSession([rep()], iso, iso);
}

describe('computeStats streak', () => {
  it('groups a session by the local calendar day, not the UTC day', () => {
    // 23:30 in Berlin (UTC+1 in January) is 22:30 UTC the same day - not a boundary
    // case. This one instead is *just after* midnight Berlin time, which is still
    // *before* midnight UTC the previous day: a naive `isoString.slice(0, 10)` would
    // (wrongly) file this under Jan 15, even though the user experienced it on Jan 16.
    const session = sessionAt('2024-01-15T23:30:00.000Z'); // = 2024-01-16T00:30 Berlin

    // Pin "now" to the same Berlin day as the session, so the streak cursor starts there.
    jest.useFakeTimers({ advanceTimers: false }).setSystemTime(new Date('2024-01-16T10:00:00.000Z'));

    const stats = computeStats([session]);
    expect(stats.currentStreakDays).toBe(1);
  });

  it('counts consecutive local days correctly and stops at the first gap', () => {
    jest.useFakeTimers({ advanceTimers: false }).setSystemTime(new Date('2024-03-10T12:00:00.000Z'));

    const sessions = [
      sessionAt('2024-03-10T08:00:00.000Z'),
      sessionAt('2024-03-09T08:00:00.000Z'),
      sessionAt('2024-03-08T08:00:00.000Z'),
      // gap: no session on 2024-03-07
      sessionAt('2024-03-06T08:00:00.000Z'),
    ];
    expect(computeStats(sessions).currentStreakDays).toBe(3);
  });

  it('is 0 when there is no session today', () => {
    expect(computeStats([sessionAt('2020-01-01T08:00:00.000Z')]).currentStreakDays).toBe(0);
  });
});
