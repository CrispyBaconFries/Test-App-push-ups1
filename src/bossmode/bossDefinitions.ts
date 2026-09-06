/**
 * Boss-Modus (Offline, Solo): jeder Liegestütz zieht dem aktuellen Boss Lebenspunkte
 * ab, besiegt man ihn, kommt ein stärkerer nach. Boss 1-4 haben exakt die
 * vorgegebenen HP-Werte; ab Boss 5 wächst die für den Sieg nötige Anzahl
 * Wiederholungen abwechselnd um 2 bzw. 3 (im Schnitt "2-3 mehr" wie gewünscht) -
 * dadurch bleiben die HP-Werte ab Boss 5 sinnvollerweise glatte Vielfache von
 * `REP_DAMAGE_HP`, auch wenn die ersten vier Werte das nicht sind.
 */
export const REP_DAMAGE_HP = 15;

/** Boss 1..4, wie vorgegeben. */
const EXPLICIT_BOSS_HP: readonly number[] = [100, 120, 150, 180];

export function bossMaxHp(bossNumber: number): number {
  if (!Number.isInteger(bossNumber) || bossNumber < 1) {
    throw new Error('bossMaxHp: bossNumber muss eine ganze Zahl >= 1 sein');
  }
  if (bossNumber <= EXPLICIT_BOSS_HP.length) {
    return EXPLICIT_BOSS_HP[bossNumber - 1];
  }

  let repsToKill = Math.ceil(EXPLICIT_BOSS_HP[EXPLICIT_BOSS_HP.length - 1] / REP_DAMAGE_HP);
  for (let n = EXPLICIT_BOSS_HP.length + 1; n <= bossNumber; n++) {
    const stepsSinceExplicit = n - EXPLICIT_BOSS_HP.length;
    repsToKill += stepsSinceExplicit % 2 === 1 ? 2 : 3;
  }
  return repsToKill * REP_DAMAGE_HP;
}

/** Name/Titel des Bosses - die eigentliche Grafik/Gestaltung kommt in einem eigenen Schritt. */
export function bossName(bossNumber: number): string {
  return `Boss ${bossNumber}`;
}
