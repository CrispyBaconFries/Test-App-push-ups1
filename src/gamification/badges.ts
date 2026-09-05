import type { WorkoutSession, WorkoutStats } from '../storage/workoutStorage';

export type BadgeId = 'FIRST_SET' | 'CENTURY' | 'FIVE_HUNDRED' | 'STREAK_3' | 'STREAK_7' | 'PERFECT_SESSION';

/** Minimum reps a session needs to count toward the "Perfekte Session" badge - guards against a 1-rep fluke counting as a milestone. */
const PERFECT_SESSION_MIN_REPS = 5;

export interface BadgeDefinition {
  id: BadgeId;
  title: string;
  description: string;
  /** Ionicons glyph name. Kept as a plain string (not the Ionicons type) so this module stays UI-free and unit-testable, like the rest of src/gamification and src/pose. */
  icon: string;
  isUnlocked: (stats: WorkoutStats, sessions: WorkoutSession[]) => boolean;
  /** Short "x / target" style progress string, shown while locked. */
  progress: (stats: WorkoutStats, sessions: WorkoutSession[]) => string;
}

function hasPerfectSession(sessions: WorkoutSession[]): boolean {
  return sessions.some((s) => s.totalReps >= PERFECT_SESSION_MIN_REPS && s.goodReps === s.totalReps);
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'FIRST_SET',
    title: 'Erster Satz',
    description: 'Insgesamt 10 Liegestütze absolviert',
    icon: 'flag',
    isUnlocked: (stats) => stats.totalReps >= 10,
    progress: (stats) => `${Math.min(stats.totalReps, 10)} / 10`,
  },
  {
    id: 'CENTURY',
    title: 'Erste 100 Liegestütze',
    description: 'Insgesamt 100 Liegestütze absolviert',
    icon: 'barbell',
    isUnlocked: (stats) => stats.totalReps >= 100,
    progress: (stats) => `${Math.min(stats.totalReps, 100)} / 100`,
  },
  {
    id: 'FIVE_HUNDRED',
    title: '500 Liegestütze',
    description: 'Insgesamt 500 Liegestütze absolviert',
    icon: 'medal',
    isUnlocked: (stats) => stats.totalReps >= 500,
    progress: (stats) => `${Math.min(stats.totalReps, 500)} / 500`,
  },
  {
    id: 'STREAK_3',
    title: '3 Tage am Stück',
    description: 'An 3 aufeinanderfolgenden Tagen trainiert',
    icon: 'flame-outline',
    isUnlocked: (stats) => stats.longestStreakDays >= 3,
    progress: (stats) => `${Math.min(stats.longestStreakDays, 3)} / 3 Tage`,
  },
  {
    id: 'STREAK_7',
    title: '7-Tage-Streak',
    description: 'An 7 aufeinanderfolgenden Tagen trainiert',
    icon: 'flame',
    isUnlocked: (stats) => stats.longestStreakDays >= 7,
    progress: (stats) => `${Math.min(stats.longestStreakDays, 7)} / 7 Tage`,
  },
  {
    id: 'PERFECT_SESSION',
    title: 'Perfekte Session',
    description: `Ein Workout mit mindestens ${PERFECT_SESSION_MIN_REPS} Liegestützen ohne einen einzigen Formfehler`,
    icon: 'ribbon',
    isUnlocked: (_stats, sessions) => hasPerfectSession(sessions),
    progress: (_stats, sessions) => (hasPerfectSession(sessions) ? 'geschafft' : 'noch nicht geschafft'),
  },
];

export interface BadgeStatus {
  definition: BadgeDefinition;
  unlocked: boolean;
  progressLabel: string;
}

export function computeBadgeStatuses(stats: WorkoutStats, sessions: WorkoutSession[]): BadgeStatus[] {
  return BADGE_DEFINITIONS.map((definition) => ({
    definition,
    unlocked: definition.isUnlocked(stats, sessions),
    progressLabel: definition.progress(stats, sessions),
  }));
}

/** Badges present in `after` but not in `before` - used to celebrate new unlocks right after a workout. */
export function newlyUnlockedBadges(before: BadgeStatus[], after: BadgeStatus[]): BadgeDefinition[] {
  const beforeUnlocked = new Set(before.filter((b) => b.unlocked).map((b) => b.definition.id));
  return after.filter((b) => b.unlocked && !beforeUnlocked.has(b.definition.id)).map((b) => b.definition);
}
