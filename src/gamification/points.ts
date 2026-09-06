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
 * Level 1-50, gedeckelt (siehe ProfileScreen.tsx) - Level N zu erreichen kostet
 * `100 + (N-2)*25` Punkte mehr als Level N-1 (Level 2 kostet 100, Level 3 kostet 125,
 * ..., Level 50 kostet 1300) - frühe Level gehen schnell, Level 50 ist ein echtes,
 * mehrmonatiges Fernziel (bei einem durchgehaltenen Tagesziel von 30 Liegestützen/Tag
 * ca. 3-4 Monate). Ersetzt die frühere flache "alle 250 Punkte ein Level"-Kurve, die nie
 * endete und Level 50 nach nur ~1000 Liegestützen erreicht hätte - zu schnell für einen
 * Wert, der sich wie ein echter Deckel anfühlen soll.
 */
export const MAX_LEVEL = 50;

/** LEVEL_THRESHOLDS[i] = Gesamtpunkte, um Level i+1 zu erreichen (Index 0 = Level 1 = 0 Punkte). */
const LEVEL_THRESHOLDS: number[] = (() => {
  const thresholds = [0];
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const costForThisLevel = 100 + (level - 2) * 25;
    thresholds.push(thresholds[thresholds.length - 1]! + costForThisLevel);
  }
  return thresholds;
})();

export interface LevelProgress {
  level: number;
  pointsIntoLevel: number;
  /** 0, sobald `isMaxLevel` - es gibt kein "nächstes Level" mehr. */
  pointsForNextLevel: number;
  isMaxLevel: boolean;
}

export function levelForPoints(totalPoints: number): LevelProgress {
  const capped = Math.max(0, totalPoints);
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (capped >= LEVEL_THRESHOLDS[i]!) {
      level = i + 1;
      break;
    }
  }
  const isMaxLevel = level >= MAX_LEVEL;
  const pointsIntoLevel = capped - LEVEL_THRESHOLDS[level - 1]!;
  const pointsForNextLevel = isMaxLevel ? 0 : LEVEL_THRESHOLDS[level]! - LEVEL_THRESHOLDS[level - 1]!;
  return { level, pointsIntoLevel, pointsForNextLevel, isMaxLevel };
}
