/**
 * Uhrzeit-Abgleich zwischen zwei Handys für den synchronisierten 60-Sekunden-Start
 * eines Duells. Trotz der Formulierung "Zeitzonenunterschiede" ist die eigentliche
 * Fehlerquelle nicht die Zeitzone (`Date.now()` liefert immer UTC-Millisekunden,
 * unabhängig von der Zeitzonen-Einstellung des Geräts) - sondern schlicht ungenau
 * gehende Handy-Uhren plus Netzwerklaufzeit zu einem Server. Klassischer NTP-Ansatz:
 * einmal (oder mehrfach) Anfrage->Server-Zeit->Antwort messen, daraus einen Zeit-
 * Offset zum Server schätzen, und darüber den exakt gleichen Startzeitpunkt auf
 * beiden Geräten in deren jeweils *eigener* Lokalzeit berechnen.
 *
 * Backend-unabhängig (nimmt nur eine "Serverzeit" als Zahl entgegen) - passt zu
 * Firestore-Serverzeit genauso wie zu Firebase Realtime Databases eingebautem
 * `.info/serverTimeOffset` (dort entfällt dieser manuelle Round-Trip sogar komplett,
 * siehe README "Ranking-System einrichten").
 */

export interface ClockOffsetSample {
  /** `Date.now()` auf dem Gerät, unmittelbar vor dem Senden der Zeit-Anfrage. */
  clientSentAtMs: number;
  /** Vom Server zurückgemeldete Zeit (ms seit Epoch). */
  serverTimeMs: number;
  /** `Date.now()` auf dem Gerät, unmittelbar nach Erhalt der Server-Antwort. */
  clientReceivedAtMs: number;
}

export interface ClockOffsetEstimate {
  /** Zu `Date.now()` addieren, um die geschätzte Serverzeit zu erhalten. */
  offsetMs: number;
  /** Für die Güte-Auswahl in `bestClockOffset` - kleiner ist besser. */
  roundTripMs: number;
}

export function estimateClockOffset(sample: ClockOffsetSample): ClockOffsetEstimate {
  const roundTripMs = sample.clientReceivedAtMs - sample.clientSentAtMs;
  // Annahme: Hin- und Rückweg dauern etwa gleich lang, daher traf die Server-Antwort
  // in der Mitte der Anfrage ein - Standard-NTP-Näherung.
  const assumedRequestArrivalMs = sample.clientSentAtMs + roundTripMs / 2;
  const offsetMs = sample.serverTimeMs - assumedRequestArrivalMs;
  return { offsetMs, roundTripMs };
}

/**
 * Aus mehreren Messungen die mit der kürzesten Laufzeit wählen (am wenigsten durch
 * Netzwerk-Jitter verfälscht) - genau wie bei echten NTP-Clients üblich.
 */
export function bestClockOffset(samples: ClockOffsetSample[]): number {
  if (samples.length === 0) {
    throw new Error('bestClockOffset: mindestens eine Messung nötig');
  }
  const estimates = samples.map(estimateClockOffset);
  return estimates.reduce((best, current) => (current.roundTripMs < best.roundTripMs ? current : best)).offsetMs;
}

export function toServerTime(localTimeMs: number, offsetMs: number): number {
  return localTimeMs + offsetMs;
}

export function toLocalTime(serverTimeMs: number, offsetMs: number): number {
  return serverTimeMs - offsetMs;
}
