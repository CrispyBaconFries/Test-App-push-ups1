import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import type { DiscardedRep, RepResult } from './formAnalysis';

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
 * Einträge aus Aufzeichnungen vor dem 09.09.2026 haben kein `kind` - dort gab es nur
 * gezählte Wiederholungen. Beim Auswerten gilt "kein kind" deshalb als `'rep'`.
 */
export type CalibrationEntry = CalibrationRepEntry | CalibrationDiscardEntry;

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

export async function clearCalibrationLog(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
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
