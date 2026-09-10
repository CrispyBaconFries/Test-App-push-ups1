import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import type { DiscardedRep, RepResult, RepTrace } from './formAnalysis';
import type { PostureBaseline } from './startPosition';

/**
 * TEMPORÄR, NUR FÜR DIE ENTWICKLUNG: sammelt die gemessenen Werte echter Liegestütze
 * (aufgerufen aus WorkoutScreen.tsx/BossFightScreen.tsx, siehe dort die mit
 * "DEV CALIBRATION" markierten Stellen), damit die festen Schwellwerte in
 * formAnalysis.ts (DEFAULT_THRESHOLDS) anhand echter Gerätedaten statt Schätzungen
 * kalibriert werden können.
 *
 * Zum Entfernen, sobald die Kalibrierung abgeschlossen ist:
 *   1. Diese Datei löschen.
 *   2. In WorkoutScreen.tsx und BossFightScreen.tsx die mit "DEV CALIBRATION"
 *      kommentierten Zeilen entfernen.
 *   3. In HomeScreen.tsx den mit "DEV CALIBRATION" markierten Button entfernen.
 * Kein anderer Teil der App hängt von diesem Modul ab.
 */

const STORAGE_KEY = '@pushup/devCalibrationLog';

/** ISO-Zeitstempel, wann erfasst wurde - hilft beim Abgleich mit eigenen Notizen zur Testsitzung. */
interface CalibrationEntryBase {
  recordedAtIso: string;
  /** 'training' (normaler Workout-Screen) oder 'boss' (Boss-Modus) - aus welchem Modus die Messung stammt. */
  source: 'training' | 'boss';
}

/** Eine gezählte und bewertete Wiederholung. */
export interface CalibrationRepEntry extends RepResult, CalibrationEntryBase {
  kind: 'rep';
}

/**
 * Eine Bewegung, die als Wiederholung angefangen, aber verworfen wurde (zu kurz, zu
 * lang, Tracking verloren - siehe `RepDiscardReason`).
 *
 * Warum das mit aufgezeichnet wird: Ohne diese Einträge sieht eine Auswertung nur die
 * Wiederholungen, die durchgekommen sind, und kann nicht unterscheiden, ob jemand wenig
 * trainiert hat oder ob die Erkennung die Hälfte weggeworfen hat. Genau diese Frage war
 * beim Datensatz vom 09.09.2026 nicht beantwortbar.
 */
export interface CalibrationDiscardEntry extends DiscardedRep, CalibrationEntryBase {
  kind: 'discarded';
}

/**
 * Die in der gehaltenen Startposition gemessene Grundhaltung (siehe `startPosition.ts`),
 * einmal je Trainingsbildschirm.
 *
 * Ohne diesen Eintrag ist eine spätere Auswertung nicht deutbar: Eine Hüftgerade von 140°
 * heißt bei einer Person mit 180° Grundhaltung etwas völlig anderes als bei einer mit
 * 150°. Erst der Bezugspunkt macht aus der Zahl eine Aussage - und erst damit lässt sich
 * prüfen, ob die gewählten Abstände (20° Hüfte, 25° Nacken) die richtigen sind.
 */
export interface CalibrationBaselineEntry extends PostureBaseline, CalibrationEntryBase {
  kind: 'baseline';
}

/**
 * Der zeitliche Verlauf einer Bewegung (siehe `RepTrace`) - Frame für Frame statt auf
 * Kennzahlen eingedampft.
 *
 * # Warum das begrenzt wird
 *
 * Ein Verlauf ist rund 40-mal so groß wie die Zusammenfassung derselben Bewegung. Der Log
 * geht über den Teilen-Dialog als Text an eine andere App, und Android deckelt die Größe
 * einer solchen Übergabe - ab etwa einem Megabyte bricht die Übergabe ab, und zwar
 * *stillschweigend*: chris drückt auf Teilen, und es passiert nichts. Ein Log, der sich
 * nicht mehr verschicken lässt, ist wertlos, egal wie gut die Daten darin sind.
 *
 * Deshalb `MAX_TRACES` und `MAX_TRACE_FRAMES`: Nach 30 aufgezeichneten Bewegungen wird
 * keine weitere mehr mitgeschrieben, und eine einzelne Bewegung wird auf 60 Frames
 * ausgedünnt (jeder zweite, jeder dritte, ...). 60 Frames sind bei 30 Bildern/s zwei
 * Sekunden am Stück - für die Form des Verlaufs reicht das mit Abstand, dafür geht es um
 * die grobe Kurve und nicht um einzelne Frames.
 *
 * Die Zusammenfassungen (`kind: 'rep'` / `'discarded'`) laufen davon unberührt weiter: Die
 * kosten fast nichts, und die Auswertung der Schwellwerte hängt an ihnen.
 */
export interface CalibrationTraceEntry extends RepTrace, CalibrationEntryBase {
  kind: 'trace';
}

/**
 * Einträge aus Aufzeichnungen vor dem 09.09.2026 haben kein `kind` - dort gab es nur
 * gezählte Wiederholungen. Beim Auswerten gilt "kein kind" deshalb als `'rep'`.
 */
export type CalibrationEntry =
  | CalibrationRepEntry
  | CalibrationDiscardEntry
  | CalibrationBaselineEntry
  | CalibrationTraceEntry;

/** Wie viele Bewegungsverläufe je Aufzeichnung höchstens mitgeschrieben werden. */
const MAX_TRACES = 30;

/** Auf wie viele Frames ein einzelner Verlauf ausgedünnt wird. */
const MAX_TRACE_FRAMES = 60;

async function loadLog(): Promise<CalibrationEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CalibrationEntry[];
  } catch {
    return [];
  }
}

/**
 * Alle Schreibvorgänge laufen nacheinander durch diese Kette.
 *
 * Ohne das wäre `append` ein klassisches Lese-Ändern-Schreib-Rennen: Die Aufrufer
 * (WorkoutScreen, BossFightScreen) starten es bewusst ohne `await` mitten im
 * Kamera-Pfad. Kämen zwei Einträge dicht genug hintereinander - eine verworfene Bewegung
 * und die nächste gezählte Wiederholung liegen nur Frames auseinander -, läsen beide
 * denselben Stand und der zuerst geschriebene Eintrag ginge verloren. Bei Daten, die sich
 * nur durch ein weiteres Training wiederbeschaffen lassen, ist das die paar Zeilen wert.
 */
let pendingWrite: Promise<unknown> = Promise.resolve();

async function append(entry: CalibrationEntry): Promise<void> {
  const run = pendingWrite.then(async () => {
    const log = await loadLog();
    log.push(entry);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  });
  // Ein gescheiterter Schreibvorgang darf die Kette nicht abreißen lassen - sonst würde
  // ab da nichts mehr aufgezeichnet.
  pendingWrite = run.catch(() => undefined);
  return run;
}

export async function recordCalibrationRep(rep: RepResult, source: CalibrationEntry['source']): Promise<void> {
  await append({ ...rep, kind: 'rep', recordedAtIso: new Date().toISOString(), source });
}

export async function recordCalibrationDiscard(
  discarded: DiscardedRep,
  source: CalibrationEntry['source']
): Promise<void> {
  await append({ ...discarded, kind: 'discarded', recordedAtIso: new Date().toISOString(), source });
}

/**
 * Dünnt einen Verlauf auf höchstens `MAX_TRACE_FRAMES` aus, indem jeder n-te Frame behalten
 * wird.
 *
 * Bewusst gleichmäßig und nicht "die ersten 60": Ein abgeschnittener Verlauf zeigt nur den
 * Weg nach unten, und die Frage, um die es geht - wie sich Hinunter und Hinauf zueinander
 * verhalten -, wäre damit gerade nicht mehr beantwortbar. Der letzte Frame bleibt
 * unabhängig vom Raster erhalten, sonst fehlt der Abschluss der Bewegung.
 */
function thinTrace(trace: RepTrace): RepTrace {
  const count = trace.t.length;
  if (count <= MAX_TRACE_FRAMES) return trace;
  // Geteilt durch `MAX - 1` und nicht durch `MAX`: Der letzte Frame kommt unten
  // unabhaengig vom Raster dazu, und ohne diesen Platz waere das Ergebnis genau einen
  // Frame zu lang.
  const step = Math.ceil(count / (MAX_TRACE_FRAMES - 1));
  const keep = (index: number) => index % step === 0 || index === count - 1;
  const pick = <T,>(values: T[]): T[] => values.filter((_, index) => keep(index));
  return {
    outcome: trace.outcome,
    t: pick(trace.t),
    elbow: pick(trace.elbow),
    hip: pick(trace.hip),
    flare: pick(trace.flare),
    neck: pick(trace.neck),
    horiz: pick(trace.horiz),
    sx: pick(trace.sx),
    sy: pick(trace.sy),
    wx: pick(trace.wx),
    wy: pick(trace.wy),
  };
}

/**
 * Zeichnet den Verlauf einer Bewegung auf - bis `MAX_TRACES` erreicht sind, danach still
 * nicht mehr.
 *
 * Warum ohne Fehler und ohne Hinweis: Der Aufrufer sitzt im Kamerapfad und könnte mit einem
 * Fehler nichts anfangen. Dass die Grenze erreicht wurde, sagt später die Auswertung -
 * `npm run analyze:reps` zählt die Verläufe und nennt die Zahl.
 */
export async function recordCalibrationTrace(
  trace: RepTrace,
  source: CalibrationEntry['source']
): Promise<void> {
  const log = await loadLog();
  if (log.filter((entry) => entry.kind === 'trace').length >= MAX_TRACES) return;
  await append({ ...thinTrace(trace), kind: 'trace', recordedAtIso: new Date().toISOString(), source });
}

export async function recordCalibrationBaseline(
  baseline: PostureBaseline,
  source: CalibrationEntry['source']
): Promise<void> {
  await append({ ...baseline, kind: 'baseline', recordedAtIso: new Date().toISOString(), source });
}

export async function clearCalibrationLog(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Die gesammelten Einträge. Nur für Tests und die Auswertung - die App selbst schreibt
 * hier ausschließlich hinein und liest sie beim Teilen als JSON.
 */
export async function loadCalibrationLog(): Promise<CalibrationEntry[]> {
  return loadLog();
}

/** Wie viele Einträge gerade gesammelt sind - für die Rückfrage vor dem Löschen. */
export async function countCalibrationEntries(): Promise<number> {
  return (await loadLog()).length;
}

/**
 * Öffnet das Betriebssystem-Teilen-Menü mit den gesammelten Daten als JSON-Text -
 * schick es dir selbst (Mail, Messenger, ...) und wertet es am PC aus.
 *
 * Bewusst kompaktes JSON ohne Einrückung: Der Text geht als Intent-Extra an die
 * Ziel-App, und Android deckelt die Größe einer solchen Übergabe. Eingerückt ist die
 * Datei rund ein Drittel größer, ohne dass ein Mensch sie deshalb liest - ausgewertet
 * wird sie am PC mit `npm run analyze:reps`.
 *
 * Gibt die Anzahl der geteilten Einträge zurück, damit der Aufrufer sie anzeigen kann.
 */
export async function shareCalibrationLog(): Promise<number> {
  const log = await loadLog();
  if (log.length === 0) {
    throw new Error('Noch keine Kalibrierungsdaten gesammelt - erst ein paar Liegestütze trainieren.');
  }
  await Share.share({ message: JSON.stringify(log) });
  return log.length;
}
