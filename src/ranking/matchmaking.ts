/**
 * Reine Suchradius-Logik fürs Skill-based Matchmaking (Ranked). Der Radius startet eng
 * und wächst mit der Wartezeit, damit auch abseits der Stoßzeiten irgendwann ein Gegner
 * gefunden wird - klassischer Wartezeit-vs-Fairness-Trade-off in Ranked-Systemen.
 */
const INITIAL_RADIUS_LP = 100;
const RADIUS_GROWTH_PER_STEP_LP = 50;
const RADIUS_GROWTH_INTERVAL_MS = 5_000;
const MAX_RADIUS_LP = 600;

export function searchRadiusForWaitTime(waitMs: number): number {
  const steps = Math.floor(Math.max(0, waitMs) / RADIUS_GROWTH_INTERVAL_MS);
  return Math.min(MAX_RADIUS_LP, INITIAL_RADIUS_LP + steps * RADIUS_GROWTH_PER_STEP_LP);
}

export function isWithinRadius(myLp: number, candidateLp: number, radius: number): boolean {
  return Math.abs(myLp - candidateLp) <= radius;
}
