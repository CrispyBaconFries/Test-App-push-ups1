import type { WorkoutSession } from '../storage/workoutStorage';
import { localDayKey } from '../storage/workoutStorage';

export const DAILY_GOAL_REPS = 30;
export const WEEKLY_GOAL_REPS = 150;

export interface ChallengeProgress {
  dailyReps: number;
  dailyGoal: number;
  dailyComplete: boolean;
  weeklyReps: number;
  weeklyGoal: number;
  weeklyComplete: boolean;
}

/** Monday-based start of the calendar week containing `date`, at local midnight. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = start.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export function computeChallengeProgress(sessions: WorkoutSession[], now: Date = new Date()): ChallengeProgress {
  const todayKey = localDayKey(now);
  const weekStart = startOfWeek(now);

  let dailyReps = 0;
  let weeklyReps = 0;
  for (const session of sessions) {
    const finishedAt = new Date(session.finishedAtIso);
    if (localDayKey(finishedAt) === todayKey) {
      dailyReps += session.totalReps;
    }
    if (finishedAt >= weekStart) {
      weeklyReps += session.totalReps;
    }
  }

  return {
    dailyReps,
    dailyGoal: DAILY_GOAL_REPS,
    dailyComplete: dailyReps >= DAILY_GOAL_REPS,
    weeklyReps,
    weeklyGoal: WEEKLY_GOAL_REPS,
    weeklyComplete: weeklyReps >= WEEKLY_GOAL_REPS,
  };
}
