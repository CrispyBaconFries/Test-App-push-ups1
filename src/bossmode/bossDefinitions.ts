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

/**
 * Aussehen und Name eines Bosses.
 *
 * `icon` ist ein Ionicons-Name (alle zehn sind gegen die Glyphenliste des Pakets geprüft -
 * ein Tippfehler ergäbe sonst ein leeres Kästchen, und zwar erst auf dem Gerät).
 */
export interface BossLook {
  name: string;
  icon: string;
  /** Farbe des Platzhalter-Symbols und der Lebensanzeige. */
  tint: string;
}

/**
 * Zehn Platzhalter-Bosse.
 *
 * # Warum Platzhalter und nicht gleich Grafiken
 *
 * Die echten Boss-Motive kommen per Bild-KI (Prompt in `docs/grafik-plan.md`) und
 * brauchen eine eigene Runde. Bis dahin war *ein* Totenkopf für alle Bosse das Problem:
 * Man besiegt Boss 3 und steht vor demselben Bild wie bei Boss 1 - der Fortschritt, um
 * den es im ganzen Modus geht, war nicht zu sehen.
 *
 * Zehn unterschiedliche Symbole mit eigenen Namen und Farben kosten nichts und machen
 * genau das sichtbar. Sie sind ausdrücklich als Platzhalter gedacht: Sobald die Motive da
 * sind, wird hier `icon` durch `require('../../assets/bosses/...')` ersetzt und sonst
 * nichts - Namen, Farben, Reihenfolge und die HP-Kurve bleiben, wie sie sind.
 *
 * # Warum die Reihenfolge so ist
 *
 * Von unbelebt über Tier und Mensch zu Naturgewalt und schließlich kosmisch - man soll am
 * Motiv sehen, wie weit man ist, ohne die Nummer zu lesen. Die Farben laufen dazu passend
 * von grau/kühl nach heiß.
 */
export const BOSS_LOOKS: readonly BossLook[] = [
  { name: 'Der Sandsack', icon: 'cube', tint: '#8A93A0' },
  { name: 'Die Ratte', icon: 'bug', tint: '#7FA05A' },
  { name: 'Der Wächter', icon: 'eye', tint: '#4FA3C7' },
  { name: 'Stahlfaust', icon: 'hand-left', tint: '#5AC8E8' },
  { name: 'Der Schildträger', icon: 'shield', tint: '#4C7DF0' },
  { name: 'Frostgeist', icon: 'snow', tint: '#8FD8FF' },
  { name: 'Sturmrufer', icon: 'thunderstorm', tint: '#B23AFF' },
  { name: 'Flammenherz', icon: 'flame', tint: '#FF7A2F' },
  { name: 'Der Koloss', icon: 'skull', tint: '#E8434F' },
  { name: 'Sternenfresser', icon: 'planet', tint: '#FFD34D' },
];

/**
 * Aussehen und Name des Bosses. Über Boss 10 hinaus wird die Reihe von vorn durchlaufen -
 * die HP steigen ja weiter, der Kampf wird also trotzdem härter.
 *
 * Bewusst kein Abbruch und kein "Boss 11": Wer so weit kommt, hat sich etwas Besseres
 * verdient als eine Nummer ohne Gesicht. Sobald es echte Motive gibt, kommen hier weitere
 * dazu.
 */
export function bossLook(bossNumber: number): BossLook {
  if (!Number.isInteger(bossNumber) || bossNumber < 1) {
    throw new Error('bossLook: bossNumber muss eine ganze Zahl >= 1 sein');
  }
  return BOSS_LOOKS[(bossNumber - 1) % BOSS_LOOKS.length];
}

/** Name/Titel des Bosses, mit vorangestellter Nummer - die zeigt den Fortschritt auch jenseits von Boss 10. */
export function bossName(bossNumber: number): string {
  return `${bossNumber}. ${bossLook(bossNumber).name}`;
}
