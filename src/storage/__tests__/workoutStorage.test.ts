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

function rep(formScore = 90): RepResult {
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

function sessionAt(iso: string): WorkoutSession {
  return buildSession([rep()], iso, iso);
}

function sessionWith(iso: string, repCount: number, formScore = 90): WorkoutSession {
  return buildSession(
    Array.from({ length: repCount }, () => rep(formScore)),
    iso,
    iso
  );
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

describe('computeStats streak with frozenDayKeys (Streak-Rettung)', () => {
  it('bridges a gap day that has no session but is frozen', () => {
    jest.useFakeTimers({ advanceTimers: false }).setSystemTime(new Date('2024-03-10T12:00:00.000Z'));

    const sessions = [
      sessionAt('2024-03-10T08:00:00.000Z'),
      sessionAt('2024-03-09T08:00:00.000Z'),
      // gap: no session on 2024-03-08, but frozen below
      sessionAt('2024-03-07T08:00:00.000Z'),
    ];
    const frozen = new Set(['2024-03-08']);
    expect(computeStats(sessions, frozen).currentStreakDays).toBe(4);
  });

  it('does not affect longestStreakDays, only the current streak', () => {
    jest.useFakeTimers({ advanceTimers: false }).setSystemTime(new Date('2024-03-10T12:00:00.000Z'));

    const sessions = [sessionAt('2024-03-10T08:00:00.000Z'), sessionAt('2024-03-08T08:00:00.000Z')];
    const frozen = new Set(['2024-03-09']);
    const stats = computeStats(sessions, frozen);
    expect(stats.currentStreakDays).toBe(3);
    expect(stats.longestStreakDays).toBe(3); // max(currentStreakDays, raw longest run) - hier gewinnt die gefrorene current streak
  });

  it('a frozen key that is not actually adjacent to the streak has no effect', () => {
    jest.useFakeTimers({ advanceTimers: false }).setSystemTime(new Date('2024-03-10T12:00:00.000Z'));

    const sessions = [sessionAt('2024-03-10T08:00:00.000Z')];
    const frozen = new Set(['2024-01-01']); // weit weg, keine echte Lücke direkt davor
    expect(computeStats(sessions, frozen).currentStreakDays).toBe(1);
  });
});

describe('computeStats longestStreakDays', () => {
  it('remembers a past streak even after it has ended', () => {
    jest.useFakeTimers({ advanceTimers: false }).setSystemTime(new Date('2024-05-01T12:00:00.000Z'));

    const sessions = [
      // A 4-day streak back in March, long since broken...
      sessionAt('2024-03-05T08:00:00.000Z'),
      sessionAt('2024-03-04T08:00:00.000Z'),
      sessionAt('2024-03-03T08:00:00.000Z'),
      sessionAt('2024-03-02T08:00:00.000Z'),
      // ...and a single, currently-active day.
      sessionAt('2024-05-01T08:00:00.000Z'),
    ];
    const stats = computeStats(sessions);
    expect(stats.currentStreakDays).toBe(1);
    expect(stats.longestStreakDays).toBe(4);
  });

  it('is 0 with no sessions and matches the current streak when it is the longest', () => {
    expect(computeStats([]).longestStreakDays).toBe(0);

    jest.useFakeTimers({ advanceTimers: false }).setSystemTime(new Date('2024-03-10T12:00:00.000Z'));
    const sessions = [sessionAt('2024-03-10T08:00:00.000Z'), sessionAt('2024-03-09T08:00:00.000Z')];
    expect(computeStats(sessions).longestStreakDays).toBe(2);
  });
});

describe('computeStats personal bests', () => {
  it('tracks the most reps done in a single session', () => {
    const sessions = [sessionWith('2024-01-01T08:00:00.000Z', 12), sessionWith('2024-01-02T08:00:00.000Z', 27)];
    expect(computeStats(sessions).bestSessionReps).toBe(27);
  });

  it('tracks the highest average form score, ignoring empty sessions', () => {
    const sessions = [
      sessionWith('2024-01-01T08:00:00.000Z', 5, 60),
      sessionWith('2024-01-02T08:00:00.000Z', 5, 95),
      buildSession([], '2024-01-03T08:00:00.000Z', '2024-01-03T08:00:00.000Z'), // empty session
    ];
    expect(computeStats(sessions).bestAverageFormScore).toBe(95);
  });

  it('is 0 for both when there are no sessions', () => {
    const stats = computeStats([]);
    expect(stats.bestSessionReps).toBe(0);
    expect(stats.bestAverageFormScore).toBe(0);
  });
});
