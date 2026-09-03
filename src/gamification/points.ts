import type { RepResult } from '../pose/formAnalysis';

/**
 * Points awarded for a single rep, scaled by how clean the form was. A perfect rep
 * (formScore 100) is worth BASE_POINTS_PER_REP; a rep with score 0 is still worth a
 * small floor amount so the counter never feels like it's punishing effort to zero.
 */
const BASE_POINTS_PER_REP = 10;
const MIN_POINTS_PER_REP = 2;

/** Bonus multiplier applied once formScore crosses this bar, to reward clean streaks. */
const PERFECT_FORM_THRESHOLD = 90;
const PERFECT_FORM_BONUS = 5;

export function pointsForRep(rep: RepResult): number {
  const scaled = Math.round((rep.formScore / 100) * BASE_POINTS_PER_REP);
  const base = Math.max(MIN_POINTS_PER_REP, scaled);
  return rep.formScore >= PERFECT_FORM_THRESHOLD ? base + PERFECT_FORM_BONUS : base;
}

export function totalPointsForReps(reps: RepResult[]): number {
  return reps.reduce((sum, rep) => sum + pointsForRep(rep), 0);
}

/**
 * Simple level curve: level N requires N * LEVEL_STEP total points to reach.
 * Kept intentionally simple for the MVP; the roadmap (weekly challenges, PvP
 * matches, badges) will likely replace this with a proper XP/season system, but
 * this is enough to give users a sense of progression today.
 */
const LEVEL_STEP = 250;

export function levelForPoints(totalPoints: number): { level: number; pointsIntoLevel: number; pointsForNextLevel: number } {
  const level = Math.floor(totalPoints / LEVEL_STEP) + 1;
  const pointsIntoLevel = totalPoints % LEVEL_STEP;
  return { level, pointsIntoLevel, pointsForNextLevel: LEVEL_STEP };
}
