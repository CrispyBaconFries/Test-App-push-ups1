import type { WorkoutSession } from '../storage/workoutStorage';
import { localDayKey } from '../storage/workoutStorage';
import type { DuelLogEntry } from '../duel/duelLog';

export type MissionPeriod = 'daily' | 'weekly';

export type MissionMetric =
  /** Total reps in *any* mode (training or Boss-Modus), within the period. */
  | 'REPS_TOTAL'
  /** Reps with perfect form (no `FormIssue`s), but only from Boss-Modus sessions - the offline mode. */
  | 'REPS_PERFECT_BOSS'
  | 'FRIENDLY_DUELS'
  | 'RANKED_MATCHES'
  /** Simply "the app was opened today" - the daily-login reward. */
  | 'APP_OPEN';

export interface MissionDefinition {
  id: string;
  period: MissionPeriod;
  metric: MissionMetric;
  target: number;
  title: string;
  description: string;
  /** Ionicons glyph name, kept as a plain string so this module stays UI-free and unit-testable. */
  icon: string;
  rewardCoins: number;
}

/**
 * Fixed set of missions, always active every day/week - no rotation or randomness (yet;
 * see README "Missionen & Münzen" for that and other ideas noted for later).
 */
export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    id: 'daily_reps_30',
    period: 'daily',
    metric: 'REPS_TOTAL',
    target: 30,
    title: 'Tagesziel',
    description: '30 Liegestütze heute',
    icon: 'barbell',
    rewardCoins: 20,
  },
  {
    id: 'daily_perfect_boss_10',
    period: 'daily',
    metric: 'REPS_PERFECT_BOSS',
    target: 10,
    title: 'Perfekte Form',
    description: '10 makellose Liegestütze im Boss-Modus',
    icon: 'skull-outline',
    rewardCoins: 30,
  },
  {
    id: 'daily_app_open',
    period: 'daily',
    metric: 'APP_OPEN',
    target: 1,
    title: 'Täglich dabei',
    description: 'Einmal am Tag die App öffnen',
    icon: 'log-in-outline',
    rewardCoins: 10,
  },
  {
    id: 'weekly_reps_250',
    period: 'weekly',
    metric: 'REPS_TOTAL',
    target: 250,
    title: 'Wochenziel',
    description: '250 Liegestütze diese Woche',
    icon: 'trending-up',
    rewardCoins: 100,
  },
  {
    id: 'weekly_friendly_3',
    period: 'weekly',
    metric: 'FRIENDLY_DUELS',
    target: 3,
    title: 'Geselligkeit',
    description: '3 Freundschaftsspiele abschließen',
    icon: 'people-circle-outline',
    rewardCoins: 60,
  },
  {
    id: 'weekly_ranked_3',
    period: 'weekly',
    metric: 'RANKED_MATCHES',
    target: 3,
    title: 'Ranglisten-Grind',
    description: '3 Ranglistenspiele abschließen',
    icon: 'trophy',
    rewardCoins: 60,
  },
];

/** Monday-based start of the calendar week containing `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = start.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** Stable per-week identifier (the Monday's day key) - used to key claimed-reward bookkeeping. */
export function weekKey(date: Date): string {
  return localDayKey(startOfWeek(date));
}

export interface MissionProgress {
  definition: MissionDefinition;
  progress: number;
  complete: boolean;
}

export interface MissionsSnapshot {
  daily: MissionProgress[];
  weekly: MissionProgress[];
  dayKey: string;
  weekKey: string;
}

export interface MissionInputs {
  sessions: WorkoutSession[];
  duelLog: DuelLogEntry[];
  /** Whether the app has already been opened today - the caller (a screen that's currently mounted) can simply always pass `true`. */
  appOpenedToday: boolean;
  now?: Date;
}

interface MissionAggregates {
  dailyReps: number;
  dailyPerfectBoss: number;
  weeklyReps: number;
  weeklyFriendly: number;
  weeklyRanked: number;
  appOpenedToday: boolean;
}

function progressFor(definition: MissionDefinition, agg: MissionAggregates): number {
  switch (definition.metric) {
    case 'REPS_TOTAL':
      return definition.period === 'daily' ? agg.dailyReps : agg.weeklyReps;
    case 'REPS_PERFECT_BOSS':
      return agg.dailyPerfectBoss;
    case 'FRIENDLY_DUELS':
      return agg.weeklyFriendly;
    case 'RANKED_MATCHES':
      return agg.weeklyRanked;
    case 'APP_OPEN':
      return agg.appOpenedToday ? 1 : 0;
  }
}

export function computeMissions({ sessions, duelLog, appOpenedToday, now = new Date() }: MissionInputs): MissionsSnapshot {
  const dayKey = localDayKey(now);
  const weekStart = startOfWeek(now);

  let dailyReps = 0;
  let dailyPerfectBoss = 0;
  let weeklyReps = 0;
  for (const session of sessions) {
    const finishedAt = new Date(session.finishedAtIso);
    if (localDayKey(finishedAt) === dayKey) {
      dailyReps += session.totalReps;
      if (session.source === 'boss') {
        dailyPerfectBoss += session.goodReps;
      }
    }
    if (finishedAt >= weekStart) {
      weeklyReps += session.totalReps;
    }
  }

  let weeklyFriendly = 0;
  let weeklyRanked = 0;
  for (const entry of duelLog) {
    if (new Date(entry.finishedAtIso) >= weekStart) {
      if (entry.isRanked) weeklyRanked += 1;
      else weeklyFriendly += 1;
    }
  }

  const agg: MissionAggregates = { dailyReps, dailyPerfectBoss, weeklyReps, weeklyFriendly, weeklyRanked, appOpenedToday };

  const toProgress = (definition: MissionDefinition): MissionProgress => {
    const progress = Math.min(progressFor(definition, agg), definition.target);
    return { definition, progress, complete: progress >= definition.target };
  };

  return {
    daily: MISSION_DEFINITIONS.filter((d) => d.period === 'daily').map(toProgress),
    weekly: MISSION_DEFINITIONS.filter((d) => d.period === 'weekly').map(toProgress),
    dayKey,
    weekKey: weekKey(now),
  };
}

/**
 * Text for the daily local notification (see src/notifications/dailyReminder.ts) -
 * names the next still-open daily mission, or celebrates a clean sweep. Local
 * notifications can't compute this at delivery time, so it's only ever as fresh as the
 * last time the caller refreshed it (see HomeScreen).
 */
export function buildDailyReminderBody(daily: MissionProgress[]): string {
  const incomplete = daily.filter((m) => !m.complete);
  if (incomplete.length === 0) {
    return 'Alle heutigen Missionen erledigt - stark! Morgen warten neue. 💪';
  }
  const next = incomplete[0]!;
  return `Noch offen: „${next.definition.title}" (${next.progress}/${next.definition.target}). Hol dir deine Münzen!`;
}
