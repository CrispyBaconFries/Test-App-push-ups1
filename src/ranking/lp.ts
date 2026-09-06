/**
 * Ligapunkte(LP)-Vergabe für Ranked-Duelle. Elo-inspiriert: Der erwartete Sieg-
 * Wahrscheinlichkeitswert (0..1) aus der LP-Differenz zwischen beiden Spielern
 * bestimmt sowohl den LP-Gewinn bei einem Sieg als auch - als Bruchteil davon - den
 * LP-Verlust bei einer Niederlage. Bewusst *kein* symmetrischer Verlust (siehe
 * `computeLossLpFactor`): ein Sieg bringt immer mehr LP, als die entsprechende
 * Niederlage kostet, damit der Aufstieg nicht unnötig zäh wird.
 */

const ELO_SCALE = 400;

const WIN_LP_BASE = 10;
const WIN_LP_SCALE = 40;
const WIN_LP_MIN = 12;
const WIN_LP_MAX = 35;

const LOSS_FACTOR_BASE = 0.4;
const LOSS_FACTOR_SCALE = 0.2;
const LOSS_FACTOR_MAX = 0.6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Wahrscheinlichkeit (0..1), dass der Spieler mit `myLp` gegen `opponentLp` gewinnt. */
export function expectedWinProbability(myLp: number, opponentLp: number): number {
  return 1 / (1 + Math.pow(10, (opponentLp - myLp) / ELO_SCALE));
}

/**
 * LP-Gewinn bei einem Sieg: klein (12) wenn ein klarer Favorit gegen einen deutlich
 * schwächeren Gegner gewinnt (erwartet), groß (35) wenn ein Außenseiter überrascht.
 */
export function computeWinLpGain(expectedWinOfWinner: number): number {
  const raw = WIN_LP_BASE + WIN_LP_SCALE * (1 - expectedWinOfWinner);
  return clamp(Math.round(raw), WIN_LP_MIN, WIN_LP_MAX);
}

/**
 * Anteil des (für dieses Match geltenden) Sieg-LP, den man bei einer Niederlage
 * verliert - immer zwischen 40 % und 60 %, wie gewünscht. Ein Favorit, der verliert,
 * zahlt den höheren Anteil (60 %); ein Außenseiter, der erwartungsgemäß verliert, den
 * niedrigeren (40 %).
 */
export function computeLossLpFactor(expectedWinOfWinner: number): number {
  return clamp(LOSS_FACTOR_BASE + LOSS_FACTOR_SCALE * expectedWinOfWinner, LOSS_FACTOR_BASE, LOSS_FACTOR_MAX);
}

export interface MatchLpChange {
  winnerLpChange: number;
  loserLpChange: number;
}

/** LP-Änderung für beide Seiten eines abgeschlossenen Duells. */
export function computeMatchLpChange(winnerLpBefore: number, loserLpBefore: number): MatchLpChange {
  const expectedWinOfWinner = expectedWinProbability(winnerLpBefore, loserLpBefore);
  const winnerLpChange = computeWinLpGain(expectedWinOfWinner);
  const loserLpChange = -Math.round(winnerLpChange * computeLossLpFactor(expectedWinOfWinner));
  return { winnerLpChange, loserLpChange };
}

/** LP ist nach unten bei 0 gedeckelt - keine negativen Werte. */
export function applyLpChange(currentLp: number, change: number): number {
  return Math.max(0, currentLp + change);
}
