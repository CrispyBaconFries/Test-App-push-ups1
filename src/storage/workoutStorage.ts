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
}

const SESSIONS_KEY = '@pushup/workoutSessions';

/**
 * The user's local calendar day (YYYY-MM-DD), not the UTC day `date.toISOString()`
 * would give. Session timestamps are stored as UTC ISO strings; slicing those directly
 * shifts anything near midnight onto the wrong day for anyone outside UTC (a workout at
 * 23:30 local time in Berlin, for example, is still "today" for the user, but is
 * already "tomorrow" in UTC) - which would silently break the streak count.
 */
function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildSession(reps: RepResult[], startedAtIso: string, finishedAtIso: string): WorkoutSession {
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
  mostCommonIssue: FormIssue | null;
}

export function computeStats(sessions: WorkoutSession[]): WorkoutStats {
  const totalPoints = sessions.reduce((s, session) => s + session.points, 0);
  const totalReps = sessions.reduce((s, session) => s + session.totalReps, 0);

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
    if (!workoutDays.has(localDayKey(cursor))) break;
    currentStreakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { totalPoints, totalReps, totalSessions: sessions.length, currentStreakDays, mostCommonIssue };
}
