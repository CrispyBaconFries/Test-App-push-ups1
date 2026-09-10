/**
 * Wann ein Duell losgehen darf - als reine Rechenregel, ohne Kamera und ohne Netzwerk.
 *
 * # Warum das hier steht und nicht im Bildschirm
 *
 * Die Startfolge eines Matches lässt sich nicht ausprobieren: Sie braucht zwei Geräte,
 * zwei Personen und eine Firebase-Verbindung (siehe `docs/backlog.md`, "zu zweit testen").
 * Genau deshalb darf die Entscheidung nicht in einem `useEffect` zwischen Kamera-Callbacks
 * und RTDB-Zuhörern verstreut liegen, wo sie niemand prüfen kann. Die Reihenfolge, in der
 * die drei Bedingungen zusammenkommen, ist der ganze Kern - und die ist hier prüfbar.
 *
 * # Die Reihenfolge
 *
 * 1. **Gegner gefunden** - im Ranked das Matchup, im Freundschaftsspiel der Beitritt. Ab
 *    hier läuft das Vorbereitungsfenster (`MATCH_PREPARATION_MS`, 10 s).
 * 2. **Eigene Startposition erkannt** - der Stütz steht und wurde ruhig gehalten (siehe
 *    `src/pose/startPosition.ts`). Kann vor oder nach dem Ende des Fensters passieren.
 * 3. **Beides erfüllt** - erst dann wird "bereit" gemeldet. Sind es beide Spieler, setzt
 *    der Server einen gemeinsamen Startzeitpunkt mit `START_LEAD_MS` (3 s) Vorlauf: der
 *    3-2-1-Countdown. Danach laufen die 60 Sekunden.
 */

export interface MatchReadyInput {
  /** Ob die eigene Startposition schon erkannt wurde. */
  positionRecognised: boolean;
  /** Ende des Vorbereitungsfensters in Gerätezeit, `null` solange kein Gegner da ist. */
  prepareUntilMs: number | null;
  nowMs: number;
}

/**
 * Darf jetzt "bereit" gemeldet werden?
 *
 * Beide Bedingungen müssen gelten, und keine ersetzt die andere:
 *
 * - **Ohne Position kein Start**, auch wenn das Fenster längst abgelaufen ist. Ein Match,
 *   das beginnt, während einer noch steht, kostet ihn in der Rangliste echte LP. Wer nicht
 *   in Position kommt, hält das Match auf - dagegen hilft die Notbremse im Bildschirm
 *   (`DUEL_READY_FALLBACK_MS`), nicht ein früherer Start.
 * - **Ohne abgelaufenes Fenster kein Start**, auch wenn die Position längst steht. Sonst
 *   entscheidet der Zufall, wer gerade schon lag: Der eine wäre nach zwei Sekunden bereit,
 *   für den anderen begänne das Match mitten in der Abwärtsbewegung.
 */
export function shouldReportReady({ positionRecognised, prepareUntilMs, nowMs }: MatchReadyInput): boolean {
  if (!positionRecognised) return false;
  if (prepareUntilMs === null) return false;
  return nowMs >= prepareUntilMs;
}

/**
 * Volle Sekunden bis zum Ende des Vorbereitungsfensters, für die Anzeige. Nie negativ.
 *
 * Aufgerundet, damit die Anzeige bei "1" nicht schon verschwindet, während noch eine
 * knappe Sekunde läuft - und `null`, solange kein Fenster läuft, damit der Aufrufer die
 * Anzeige ganz weglassen kann statt eine 0 zu zeigen.
 */
export function prepareSecondsLeft(prepareUntilMs: number | null, nowMs: number): number | null {
  if (prepareUntilMs === null) return null;
  return Math.max(0, Math.ceil((prepareUntilMs - nowMs) / 1000));
}
