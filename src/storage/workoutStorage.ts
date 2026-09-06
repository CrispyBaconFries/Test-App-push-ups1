import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FormIssue, RepResult } from '../pose/formAnalysis';
import { totalPointsForReps } from '../gamification/points';

export interface WorkoutSession {
  id: string;
  startedAtIso: string;
  finishedAtIso: string;
  reps: RepResult[];
  totalReps: number;
  goodReps: number;
  averageFormScore: number;
  points: number;
  /**
   * Which screen produced this session - 'training' (default) for the normal
   * WorkoutScreen, 'boss' for the Boss-Modus. Older sessions saved before this field
   * existed have neither, and are treated as 'training' wherever this matters (see
   * `src/gamification/missions.ts`), since that was the only mode back then.
   */
  source?: 'training' | 'boss';
}

const SESSIONS_KEY = '@pushup/workoutSessions';

/**
 * The user's local calendar day (YYYY-MM-DD), not the UTC day `date.toISOString()`
 * would give. Session timestamps are stored as UTC ISO strings; slicing those directly
 * shifts anything near midnight onto the wrong day for anyone outside UTC (a workout at
 * 23:30 local time in Berlin, for example, is still "today" for the user, but is
 * already "tomorrow" in UTC) - which would silently break the streak count.
 */
export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The longest run of consecutive calendar days with at least one session, ever - not
 * just the current active streak. Walks the calendar day-by-day (via `setDate`/
 * `localDayKey`, not raw millisecond differences) so a daylight-saving-time transition
 * (where a "day" is 23 or 25 real hours) still counts as exactly one day, same as the
 * current-streak logic below.
 */
function longestConsecutiveRun(dayKeys: Set<string>): number {
  const sortedKeys = [...dayKeys].sort();
  let longest = 0;
  let current = 0;
  let previousDate: Date | null = null;
  for (const key of sortedKeys) {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (previousDate) {
      const expectedNext = new Date(previousDate);
      expectedNext.setDate(expectedNext.getDate() + 1);
      current = localDayKey(expectedNext) === key ? current + 1 : 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    previousDate = date;
  }
  return longest;
}

export function buildSession(
  reps: RepResult[],
  startedAtIso: string,
  finishedAtIso: string,
  source: 'training' | 'boss' = 'training'
): WorkoutSession {
  const totalReps = reps.length;
  const goodReps = reps.filter((r) => r.issues.length === 0).length;
  const averageFormScore = totalReps === 0 ? 0 : Math.round(reps.reduce((s, r) => s + r.formScore, 0) / totalReps);
  return {
    id: `${finishedAtIso}-${Math.random().toString(36).slice(2, 8)}`,
    startedAtIso,
    finishedAtIso,
    reps,
    totalReps,
    goodReps,
    averageFormScore,
    points: totalPointsForReps(reps),
    source,
  };
}

export async function saveSession(session: WorkoutSession): Promise<void> {
  const sessions = await loadSessions();
  sessions.unshift(session);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export async function loadSessions(): Promise<WorkoutSession[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WorkoutSession[];
  } catch {
    return [];
  }
}

export interface WorkoutStats {
  totalPoints: number;
  totalReps: number;
  totalSessions: number;
  currentStreakDays: number;
  /** Longest run of consecutive days ever trained, regardless of whether that streak is still active. */
  longestStreakDays: number;
  /** Most reps done in a single session, ever. */
  bestSessionReps: number;
  /** Highest average form score of any single session, ever (session must have at least one rep). */
  bestAverageFormScore: number;
  mostCommonIssue: FormIssue | null;
}

/**
 * `frozenDayKeys` (aus `src/gamification/streakFreezeStore.ts`, per Münz-Shop
 * "Streak-Rettung" gekauft) lässt einen Tag ohne Training trotzdem als "Streak lief
 * weiter" zählen - nur für die *aktuelle* Streak, nicht für `longestStreakDays`
 * (bewusst: ein Freeze soll die laufende Streak retten, nicht rückwirkend historische
 * Rekorde umschreiben).
 */
export function computeStats(sessions: WorkoutSession[], frozenDayKeys: ReadonlySet<string> = new Set()): WorkoutStats {
  const totalPoints = sessions.reduce((s, session) => s + session.points, 0);
  const totalReps = sessions.reduce((s, session) => s + session.totalReps, 0);
  const bestSessionReps = sessions.reduce((best, session) => Math.max(best, session.totalReps), 0);
  const bestAverageFormScore = sessions.reduce(
    (best, session) => (session.totalReps > 0 ? Math.max(best, session.averageFormScore) : best),
    0
  );

  const issueCounts = new Map<FormIssue, number>();
  for (const session of sessions) {
    for (const rep of session.reps) {
      for (const issue of rep.issues) {
        issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
      }
    }
  }
  let mostCommonIssue: FormIssue | null = null;
  let mostCommonCount = 0;
  for (const [issue, count] of issueCounts) {
    if (count > mostCommonCount) {
      mostCommonIssue = issue;
      mostCommonCount = count;
    }
  }

  const workoutDays = new Set(sessions.map((s) => localDayKey(new Date(s.finishedAtIso))));
  let currentStreakDays = 0;
  const cursor = new Date();
  for (;;) {
    const key = localDayKey(cursor);
    if (!workoutDays.has(key) && !frozenDayKeys.has(key)) break;
    currentStreakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const longestStreakDays = Math.max(currentStreakDays, longestConsecutiveRun(workoutDays));

  return {
    totalPoints,
    totalReps,
    totalSessions: sessions.length,
    currentStreakDays,
    longestStreakDays,
    bestSessionReps,
    bestAverageFormScore,
    mostCommonIssue,
  };
}
