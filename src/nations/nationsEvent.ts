/**
 * Zeitfenster und Auswertung des Länderspiels.
 *
 * Bewusst reines TypeScript ohne Firebase-, React- oder Speicher-Abhängigkeiten: Das
 * ist der Teil, der stimmen MUSS (wann läuft ein Event, wer gewinnt) und der sich
 * dadurch vollständig mit Jest prüfen lässt, ohne Gerät und ohne Backend.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** 0 = Sonntag ... 6 = Samstag - dieselbe Zählweise wie `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES_DE = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const;

/**
 * Wann und wie oft ein Länderspiel läuft.
 *
 * Zwei Wiederholungsarten, weil chris beides möchte: aktuell jede Woche von Freitag bis
 * Sonntag, später eventuell "alle drei Tage für drei Tage". Beides ist hier nur eine
 * andere `repeat`-Angabe - die Bildschirme und der Sync rechnen ausschließlich mit dem
 * berechneten Fenster und wissen von der Wiederholung nichts.
 */
export interface NationsEventSchedule {
  /**
   * Zeitzone des Events als Abstand zu UTC in Minuten (Deutschland: 60 im Winter, 120 in
   * der Sommerzeit). Alle Spieler weltweit haben damit dasselbe Fenster, unabhängig
   * davon, wo ihr Handy steht - sonst hätte jemand mit einer anderen Zeitzone länger Zeit.
   *
   * ACHTUNG Sommerzeit: Dieser Wert wird nicht automatisch umgestellt. Zweimal im Jahr
   * beginnt und endet das Event dadurch eine Stunde verschoben, bis der Wert hier
   * angepasst wird. Das bewusst so gelassen statt eine Zeitzonen-Bibliothek einzubauen:
   * Hermes (die JS-Engine der App) liefert `Intl` mit Zeitzonen-Daten nicht zuverlässig
   * mit, und ein 3-Tage-Event verträgt eine Stunde Versatz.
   */
  utcOffsetMinutes: number;
  /** Startstunde in der Ereigniszone, 0-23. */
  startHour: number;
  /** Dauer in vollen Tagen. */
  durationDays: number;
  /**
   * Wie viele Tage vor dem Start die Anmeldung öffnet.
   *
   * `undefined` (Standard) heißt: immer offen - man kann sich für das nächste Event
   * anmelden, sobald das vorherige vorbei ist. Eine Zahl schränkt das ein: `1` öffnet die
   * Anmeldung genau einen Tag vor dem Start, davor zeigt der Bildschirm nur den Termin.
   */
  registrationOpensDaysBefore?: number;
  repeat:
    | { mode: 'weekly'; startWeekday: Weekday }
    | {
        mode: 'everyNDays';
        /** Erster Starttag in der Ereigniszone, `YYYY-MM-DD`. */
        anchorDate: string;
        /** Abstand zwischen zwei Startterminen in Tagen. */
        periodDays: number;
      };
}

/**
 * Aktuelle Einstellung: jede Woche Freitag bis Sonntag, drei volle Tage.
 *
 * Das Fenster beginnt Freitag um 00:00 und endet Montag um 00:00 - "bis Sonntag" also
 * einschließlich des ganzen Sonntags.
 *
 * Für "alle drei Tage für drei Tage" reicht es, `repeat` zu ersetzen:
 *   repeat: { mode: 'everyNDays', anchorDate: '2026-09-11', periodDays: 3 }
 */
export const DEFAULT_NATIONS_SCHEDULE: NationsEventSchedule = {
  utcOffsetMinutes: 120,
  startHour: 0,
  durationDays: 3,
  repeat: { mode: 'weekly', startWeekday: 5 },
};

export interface NationsEventWindow {
  /** Stabile Kennung, abgeleitet aus dem Starttag - z. B. `2026-09-11`. Wird als Firestore-Dokument-ID benutzt. */
  id: string;
  startsAtMs: number;
  endsAtMs: number;
}

/** Tage seit dem 1.1.1970 in der Ereigniszone. */
function zoneDayOf(atMs: number, schedule: NationsEventSchedule): number {
  return Math.floor((atMs + schedule.utcOffsetMinutes * MINUTE_MS) / DAY_MS);
}

/** 1970-01-01 war ein Donnerstag, in dieser Zählweise also Tag 4. */
function weekdayOfZoneDay(zoneDay: number): Weekday {
  return (((zoneDay + 4) % 7) + 7) % 7 as Weekday;
}

function zoneDayOfDateString(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`nationsEvent: anchorDate muss YYYY-MM-DD sein, war "${date}"`);
  }
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function isoDateOfZoneDay(zoneDay: number): string {
  return new Date(zoneDay * DAY_MS).toISOString().slice(0, 10);
}

function windowFromStartDay(startDay: number, schedule: NationsEventSchedule): NationsEventWindow {
  const startsAtMs =
    startDay * DAY_MS + schedule.startHour * HOUR_MS - schedule.utcOffsetMinutes * MINUTE_MS;
  return {
    id: isoDateOfZoneDay(startDay),
    startsAtMs,
    endsAtMs: startsAtMs + schedule.durationDays * DAY_MS,
  };
}

/**
 * Der letzte Starttermin, der zum Zeitpunkt `atMs` bereits begonnen hat (oder `null`,
 * wenn es davor noch gar keinen gab - nur bei `everyNDays` vor dem Ankertag möglich).
 */
function latestStartDayAt(atMs: number, schedule: NationsEventSchedule): number | null {
  const zoneDay = zoneDayOf(atMs, schedule);
  const { repeat } = schedule;

  const candidate =
    repeat.mode === 'weekly'
      ? zoneDay - (((weekdayOfZoneDay(zoneDay) - repeat.startWeekday + 7) % 7) + 7) % 7
      : (() => {
          const anchorDay = zoneDayOfDateString(repeat.anchorDate);
          if (zoneDay < anchorDay) return null;
          return anchorDay + Math.floor((zoneDay - anchorDay) / repeat.periodDays) * repeat.periodDays;
        })();

  if (candidate === null) return null;

  // Am Starttag selbst kann die Startstunde noch bevorstehen - dann gilt der Termin davor.
  if (windowFromStartDay(candidate, schedule).startsAtMs > atMs) {
    const periodDays = repeat.mode === 'weekly' ? 7 : repeat.periodDays;
    const previous = candidate - periodDays;
    if (repeat.mode === 'everyNDays' && previous < zoneDayOfDateString(repeat.anchorDate)) return null;
    return previous;
  }
  return candidate;
}

/** Das gerade laufende Fenster, oder `null` wenn zwischen zwei Events. */
export function currentEventWindow(
  atMs: number,
  schedule: NationsEventSchedule = DEFAULT_NATIONS_SCHEDULE
): NationsEventWindow | null {
  const startDay = latestStartDayAt(atMs, schedule);
  if (startDay === null) return null;
  const window = windowFromStartDay(startDay, schedule);
  return atMs >= window.startsAtMs && atMs < window.endsAtMs ? window : null;
}

/** Das nächste Fenster, das nach `atMs` *beginnt*. Ein gerade laufendes zählt nicht. */
export function nextEventWindow(
  atMs: number,
  schedule: NationsEventSchedule = DEFAULT_NATIONS_SCHEDULE
): NationsEventWindow {
  const periodDays = schedule.repeat.mode === 'weekly' ? 7 : schedule.repeat.periodDays;
  const startDay = latestStartDayAt(atMs, schedule);
  if (startDay === null) {
    // Vor dem allerersten Termin (nur bei `everyNDays` möglich).
    return windowFromStartDay(zoneDayOfDateString((schedule.repeat as { anchorDate: string }).anchorDate), schedule);
  }
  let next = windowFromStartDay(startDay + periodDays, schedule);
  // Sicherheitsnetz gegen Konfigurationen, bei denen der Termin exakt auf `atMs` fällt.
  while (next.startsAtMs <= atMs) {
    next = windowFromStartDay(zoneDayOf(next.startsAtMs, schedule) + periodDays, schedule);
  }
  return next;
}

/**
 * Das zuletzt *beendete* Fenster, oder `null`, wenn noch keines vorbei ist.
 *
 * Genau das braucht die Ergebnis-Veröffentlichung: Ohne Server finalisiert der erste
 * Client, der nach dem Ende hinschaut (siehe `loadOrFinalizeResult`), und der muss dafür
 * wissen, welches Event gerade zu Ende gegangen ist. Läuft gerade eines, ist das
 * gesuchte das davor.
 */
export function mostRecentFinishedEventWindow(
  atMs: number,
  schedule: NationsEventSchedule = DEFAULT_NATIONS_SCHEDULE
): NationsEventWindow | null {
  const periodDays = schedule.repeat.mode === 'weekly' ? 7 : schedule.repeat.periodDays;
  let startDay = latestStartDayAt(atMs, schedule);
  if (startDay === null) return null;

  // Höchstens ein Schritt zurück nötig: Das zuletzt begonnene Fenster läuft entweder
  // noch (dann zählt das davor) oder ist beendet (dann ist es selbst das gesuchte).
  let window = windowFromStartDay(startDay, schedule);
  if (window.endsAtMs > atMs) {
    startDay -= periodDays;
    if (schedule.repeat.mode === 'everyNDays' && startDay < zoneDayOfDateString(schedule.repeat.anchorDate)) {
      return null;
    }
    window = windowFromStartDay(startDay, schedule);
  }
  return window;
}

/**
 * Das Fenster, in das ein Zeitpunkt fällt - oder `null`, wenn damals kein Event lief.
 *
 * Genau das braucht der Nachtrag offline gesammelter Sessions: Eine Session vom
 * Sonntagabend, die erst Dienstag hochgeladen wird, muss dem Event von Sonntag
 * gutgeschrieben werden, nicht dem gerade laufenden oder gar keinem.
 */
export function eventWindowForTimestamp(
  atMs: number,
  schedule: NationsEventSchedule = DEFAULT_NATIONS_SCHEDULE
): NationsEventWindow | null {
  return currentEventWindow(atMs, schedule);
}

/** Ein Spieler-Eintrag eines Events, so wie er in Firestore liegt. */
export interface NationsParticipant {
  uid: string;
  countryCode: string;
  reps: number;
  displayName?: string;
}

export interface CountryStanding {
  countryCode: string;
  /** Liegestütze aller Spieler dieses Landes in diesem Event. */
  reps: number;
  /** Spieler, die mindestens eine Wiederholung beigetragen haben. */
  players: number;
  /** Auf eine Nachkommastelle gerundeter Schnitt je *beitragendem* Spieler. */
  averageReps: number;
  /** Spieler, die dieses Land gewählt haben - auch ohne eine einzige Wiederholung. */
  registeredPlayers: number;
}

/**
 * Wertet die Teilnehmer eines Events zu einer Länder-Tabelle aus, absteigend nach
 * Liegestützen.
 *
 * Gezählt werden für `players` und `averageReps` nur Spieler mit mindestens einer
 * Wiederholung. Sonst würde jede Anmeldung ohne Training den Schnitt eines Landes
 * drücken - und ein Land mit vielen Karteileichen stünde schlechter da als eines mit
 * wenigen aktiven Leuten, obwohl beide gleich viel geleistet haben. Wer sich nur
 * angemeldet hat, steht in `registeredPlayers`.
 *
 * Gleichstand bei den Liegestützen entscheidet der höhere Schnitt je Spieler, danach
 * (nur damit die Reihenfolge überhaupt eindeutig ist) das Länderkürzel.
 */
export function computeStandings(participants: readonly NationsParticipant[]): CountryStanding[] {
  const byCountry = new Map<string, { reps: number; players: number; registeredPlayers: number }>();

  for (const participant of participants) {
    const reps = Number.isFinite(participant.reps) ? Math.max(0, Math.trunc(participant.reps)) : 0;
    const entry = byCountry.get(participant.countryCode) ?? { reps: 0, players: 0, registeredPlayers: 0 };
    entry.reps += reps;
    entry.registeredPlayers += 1;
    if (reps > 0) entry.players += 1;
    byCountry.set(participant.countryCode, entry);
  }

  return [...byCountry.entries()]
    .map(([countryCode, entry]) => ({
      countryCode,
      reps: entry.reps,
      players: entry.players,
      registeredPlayers: entry.registeredPlayers,
      averageReps: entry.players === 0 ? 0 : Math.round((entry.reps / entry.players) * 10) / 10,
    }))
    .sort(
      (a, b) =>
        b.reps - a.reps || b.averageReps - a.averageReps || a.countryCode.localeCompare(b.countryCode)
    );
}

/** Das veröffentlichte Endergebnis eines gelaufenen Events. */
export interface NationsEventResult {
  eventId: string;
  startsAtMs: number;
  endsAtMs: number;
  /** `null`, wenn niemand eine einzige Wiederholung beigetragen hat. */
  winnerCountryCode: string | null;
  winnerReps: number;
  winnerPlayers: number;
  winnerAverageReps: number;
  /** Über alle Länder hinweg. */
  totalReps: number;
  totalPlayers: number;
  standings: CountryStanding[];
}

export function buildEventResult(
  window: NationsEventWindow,
  participants: readonly NationsParticipant[]
): NationsEventResult {
  const standings = computeStandings(participants);
  // Ein Land ohne eine einzige Wiederholung gewinnt nicht, auch wenn es als einziges
  // in der Tabelle steht - sonst "gewänne" ein Event, in dem niemand trainiert hat.
  const winner = standings.find((standing) => standing.reps > 0) ?? null;
  return {
    eventId: window.id,
    startsAtMs: window.startsAtMs,
    endsAtMs: window.endsAtMs,
    winnerCountryCode: winner?.countryCode ?? null,
    winnerReps: winner?.reps ?? 0,
    winnerPlayers: winner?.players ?? 0,
    winnerAverageReps: winner?.averageReps ?? 0,
    totalReps: standings.reduce((sum, standing) => sum + standing.reps, 0),
    totalPlayers: standings.reduce((sum, standing) => sum + standing.players, 0),
    standings,
  };
}

/**
 * Datum/Uhrzeit eines Zeitpunkts in der Ereigniszone.
 *
 * Bewusst über die UTC-Getter auf einem verschobenen Zeitstempel statt über die lokalen
 * Getter: Letztere würden die Zeitzone des *Handys* verwenden, und dann sähe ein Spieler
 * in Neuseeland ein anderes Startdatum als einer in Deutschland - obwohl das Event für
 * beide im selben Augenblick beginnt.
 */
function zoneParts(atMs: number, schedule: NationsEventSchedule) {
  const shifted = new Date(atMs + schedule.utcOffsetMinutes * MINUTE_MS);
  return {
    weekday: shifted.getUTCDay() as Weekday,
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** z. B. "Fr 11.09., 00:00 Uhr bis So 13.09., 24:00 Uhr". */
export function formatEventRangeDe(
  window: NationsEventWindow,
  schedule: NationsEventSchedule = DEFAULT_NATIONS_SCHEDULE
): string {
  const start = zoneParts(window.startsAtMs, schedule);
  // Das Fenster endet um Mitternacht des Folgetages. "bis Mo 00:00 Uhr" liest sich, als
  // wäre der Sonntag nicht mehr dabei - deshalb wird die letzte Minute des Vortages
  // angezeigt, wenn das Ende genau auf einen Tageswechsel fällt.
  const endsOnMidnight = zoneParts(window.endsAtMs, schedule).hour === 0 && zoneParts(window.endsAtMs, schedule).minute === 0;
  const end = zoneParts(endsOnMidnight ? window.endsAtMs - MINUTE_MS : window.endsAtMs, schedule);
  const endTime = endsOnMidnight ? '24:00' : `${pad2(end.hour)}:${pad2(end.minute)}`;
  const shortDay = (weekday: Weekday) => WEEKDAY_NAMES_DE[weekday].slice(0, 2);
  return (
    `${shortDay(start.weekday)} ${pad2(start.day)}.${pad2(start.month)}., ${pad2(start.hour)}:${pad2(start.minute)} Uhr ` +
    `bis ${shortDay(end.weekday)} ${pad2(end.day)}.${pad2(end.month)}., ${endTime} Uhr`
  );
}

/** z. B. "2 Tage 5 Std." - für "läuft noch" und "startet in". Nie negativ. */
export function formatDurationDe(ms: number): string {
  const total = Math.max(0, ms);
  const days = Math.floor(total / DAY_MS);
  const hours = Math.floor((total % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((total % HOUR_MS) / MINUTE_MS);
  if (days > 0) return `${days} ${days === 1 ? 'Tag' : 'Tage'} ${hours} Std.`;
  if (hours > 0) return `${hours} Std. ${minutes} Min.`;
  return `${minutes} Min.`;
}

/**
 * Um welches Event es *jetzt gerade* geht, und was man damit tun kann.
 *
 * - `running`      - das Event läuft, Liegestütze zählen, wer noch kein Land hat kann
 *                    auch jetzt noch einsteigen.
 * - `registration` - das Event hat noch nicht begonnen, die Anmeldung ist aber offen.
 * - `closed`       - der Termin steht, die Anmeldung öffnet erst später (nur möglich,
 *                    wenn `registrationOpensDaysBefore` gesetzt ist).
 *
 * Bewusst hier und nicht im Bildschirm: Die Entscheidung "welches Fenster ist gemeint"
 * ist die Grundlage für die Länderwahl und damit dafür, welchem Event Liegestütze
 * gutgeschrieben werden - das gehört in den getesteten Teil.
 */
export type NationsEventPhase = 'running' | 'registration' | 'closed';

export interface ActiveNationsEvent {
  window: NationsEventWindow;
  phase: NationsEventPhase;
}

export function activeNationsEvent(
  atMs: number,
  schedule: NationsEventSchedule = DEFAULT_NATIONS_SCHEDULE
): ActiveNationsEvent {
  const running = currentEventWindow(atMs, schedule);
  if (running) return { window: running, phase: 'running' };

  const upcoming = nextEventWindow(atMs, schedule);
  const opensDaysBefore = schedule.registrationOpensDaysBefore;
  if (opensDaysBefore === undefined) return { window: upcoming, phase: 'registration' };

  const opensAtMs = upcoming.startsAtMs - opensDaysBefore * DAY_MS;
  return { window: upcoming, phase: atMs >= opensAtMs ? 'registration' : 'closed' };
}

/** Ab wann die Anmeldung für ein Fenster offen ist - für die Anzeige "Anmeldung ab ...". */
export function registrationOpensAtMs(
  window: NationsEventWindow,
  schedule: NationsEventSchedule = DEFAULT_NATIONS_SCHEDULE
): number | null {
  const opensDaysBefore = schedule.registrationOpensDaysBefore;
  return opensDaysBefore === undefined ? null : window.startsAtMs - opensDaysBefore * DAY_MS;
}
