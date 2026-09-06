import { computeMissions, weekKey, buildDailyReminderBody } from '../missions';
import { buildSession, type WorkoutSession } from '../../storage/workoutStorage';
import type { RepResult } from '../../pose/formAnalysis';
import type { DuelLogEntry } from '../../duel/duelLog';

function rep(formScore = 90, hasIssue = false): RepResult {
  return {
    index: 0,
    formScore,
    issues: hasIssue ? ['ELBOWS_FLARED'] : [],
    minElbowAngleDeg: 90,
    minHipStraightnessDeg: 180,
    maxElbowFlareDeg: 30,
    minNeckAngleDeg: 175,
    durationMs: 900,
  };
}

function sessionWith(iso: string, repCount: number, source: 'training' | 'boss' = 'training', hasIssue = false): WorkoutSession {
  return buildSession(
    Array.from({ length: repCount }, () => rep(90, hasIssue)),
    iso,
    iso,
    source
  );
}

// A Wednesday, so the Monday-based week start is unambiguous.
const NOW = new Date('2024-01-10T12:00:00.000Z');

describe('computeMissions - daily reps mission', () => {
  it('sums only today\'s reps across both modes', () => {
    const sessions = [
      sessionWith('2024-01-10T07:00:00.000Z', 12, 'training'),
      sessionWith('2024-01-10T18:00:00.000Z', 10, 'boss'),
      sessionWith('2024-01-09T07:00:00.000Z', 50, 'training'), // yesterday - excluded
    ];
    const snapshot = computeMissions({ sessions, duelLog: [], appOpenedToday: false, now: NOW });
    const daily = snapshot.daily.find((m) => m.definition.id === 'daily_reps_30')!;
    expect(daily.progress).toBe(22);
    expect(daily.complete).toBe(false);
  });

  it('completes once today\'s reps reach the target', () => {
    const sessions = [sessionWith('2024-01-10T07:00:00.000Z', 30, 'training')];
    const snapshot = computeMissions({ sessions, duelLog: [], appOpenedToday: false, now: NOW });
    expect(snapshot.daily.find((m) => m.definition.id === 'daily_reps_30')!.complete).toBe(true);
  });

  it('caps progress at the target even with far more reps', () => {
    const sessions = [sessionWith('2024-01-10T07:00:00.000Z', 999, 'training')];
    const snapshot = computeMissions({ sessions, duelLog: [], appOpenedToday: false, now: NOW });
    const daily = snapshot.daily.find((m) => m.definition.id === 'daily_reps_30')!;
    expect(daily.progress).toBe(30);
  });
});

describe('computeMissions - perfect Boss-Modus reps', () => {
  it('only counts clean reps from Boss-Modus sessions, not training sessions', () => {
    const sessions = [
      sessionWith('2024-01-10T07:00:00.000Z', 10, 'training', false), // clean, but wrong mode
      sessionWith('2024-01-10T08:00:00.000Z', 5, 'boss', false), // clean, right mode
      sessionWith('2024-01-10T09:00:00.000Z', 5, 'boss', true), // right mode, not clean - doesn't count
    ];
    const snapshot = computeMissions({ sessions, duelLog: [], appOpenedToday: false, now: NOW });
    const mission = snapshot.daily.find((m) => m.definition.id === 'daily_perfect_boss_10')!;
    expect(mission.progress).toBe(5);
    expect(mission.complete).toBe(false);
  });

  it('completes once 10 clean Boss-Modus reps are logged today', () => {
    const sessions = [sessionWith('2024-01-10T07:00:00.000Z', 10, 'boss', false)];
    const snapshot = computeMissions({ sessions, duelLog: [], appOpenedToday: false, now: NOW });
    expect(snapshot.daily.find((m) => m.definition.id === 'daily_perfect_boss_10')!.complete).toBe(true);
  });
});

describe('computeMissions - app open mission', () => {
  it('reflects the appOpenedToday flag directly', () => {
    const withOpen = computeMissions({ sessions: [], duelLog: [], appOpenedToday: true, now: NOW });
    const withoutOpen = computeMissions({ sessions: [], duelLog: [], appOpenedToday: false, now: NOW });
    expect(withOpen.daily.find((m) => m.definition.id === 'daily_app_open')!.complete).toBe(true);
    expect(withoutOpen.daily.find((m) => m.definition.id === 'daily_app_open')!.complete).toBe(false);
  });
});

describe('computeMissions - weekly reps mission', () => {
  it('sums the whole Monday-based week, excluding last week, and targets 250', () => {
    const sessions = [
      sessionWith('2024-01-08T07:00:00.000Z', 40, 'training'), // Monday this week
      sessionWith('2024-01-10T07:00:00.000Z', 20, 'boss'), // Wednesday this week
      sessionWith('2024-01-07T07:00:00.000Z', 999, 'training'), // Sunday - last week, excluded
    ];
    const snapshot = computeMissions({ sessions, duelLog: [], appOpenedToday: false, now: NOW });
    const weekly = snapshot.weekly.find((m) => m.definition.id === 'weekly_reps_250')!;
    expect(weekly.progress).toBe(60);
    expect(weekly.definition.target).toBe(250);
    expect(weekly.complete).toBe(false);
  });
});

describe('computeMissions - duel missions', () => {
  const duelLog: DuelLogEntry[] = [
    { finishedAtIso: '2024-01-08T10:00:00.000Z', isRanked: false },
    { finishedAtIso: '2024-01-09T10:00:00.000Z', isRanked: false },
    { finishedAtIso: '2024-01-09T11:00:00.000Z', isRanked: true },
    { finishedAtIso: '2024-01-07T10:00:00.000Z', isRanked: false }, // last week - excluded
  ];

  it('counts friendly and ranked duels separately, within this week only', () => {
    const snapshot = computeMissions({ sessions: [], duelLog, appOpenedToday: false, now: NOW });
    expect(snapshot.weekly.find((m) => m.definition.id === 'weekly_friendly_3')!.progress).toBe(2);
    expect(snapshot.weekly.find((m) => m.definition.id === 'weekly_ranked_3')!.progress).toBe(1);
  });

  it('completes once 3 duels of the right kind are logged this week', () => {
    const threeRanked: DuelLogEntry[] = [
      { finishedAtIso: '2024-01-08T10:00:00.000Z', isRanked: true },
      { finishedAtIso: '2024-01-09T10:00:00.000Z', isRanked: true },
      { finishedAtIso: '2024-01-10T10:00:00.000Z', isRanked: true },
    ];
    const snapshot = computeMissions({ sessions: [], duelLog: threeRanked, appOpenedToday: false, now: NOW });
    expect(snapshot.weekly.find((m) => m.definition.id === 'weekly_ranked_3')!.complete).toBe(true);
  });
});

describe('weekKey', () => {
  it('is stable for any day within the same Monday-based week', () => {
    const monday = weekKey(new Date('2024-01-08T00:00:00.000Z'));
    const wednesday = weekKey(new Date('2024-01-10T23:00:00.000Z'));
    const sunday = weekKey(new Date('2024-01-14T12:00:00.000Z'));
    expect(monday).toBe(wednesday);
    expect(wednesday).toBe(sunday);
  });

  it('differs across a week boundary', () => {
    const thisWeek = weekKey(new Date('2024-01-08T00:00:00.000Z'));
    const nextWeek = weekKey(new Date('2024-01-15T00:00:00.000Z'));
    expect(thisWeek).not.toBe(nextWeek);
  });
});

describe('buildDailyReminderBody', () => {
  it('names the first still-open daily mission', () => {
    const snapshot = computeMissions({ sessions: [], duelLog: [], appOpenedToday: true, now: NOW });
    const body = buildDailyReminderBody(snapshot.daily);
    expect(body).toContain('Tagesziel');
  });

  it('celebrates a clean sweep once every daily mission is complete', () => {
    const sessions = [sessionWith('2024-01-10T07:00:00.000Z', 30, 'boss', false)];
    const snapshot = computeMissions({ sessions, duelLog: [], appOpenedToday: true, now: NOW });
    expect(snapshot.daily.every((m) => m.complete)).toBe(true);
    expect(buildDailyReminderBody(snapshot.daily)).toContain('erledigt');
  });
});

describe('computeMissions - empty state', () => {
  it('is all zero / incomplete with nothing logged', () => {
    const snapshot = computeMissions({ sessions: [], duelLog: [], appOpenedToday: false, now: NOW });
    for (const mission of [...snapshot.daily, ...snapshot.weekly]) {
      if (mission.definition.id === 'daily_app_open') continue;
      expect(mission.progress).toBe(0);
      expect(mission.complete).toBe(false);
    }
  });
});
