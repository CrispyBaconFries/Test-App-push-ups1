import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import type { RepResult } from './formAnalysis';

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

export interface CalibrationEntry extends RepResult {
  /** ISO-Zeitstempel, wann diese Wiederholung erfasst wurde - hilft beim Abgleich mit eigenen Notizen zur Testsitzung. */
  recordedAtIso: string;
  /** 'training' (normaler Workout-Screen) oder 'boss' (Boss-Modus) - aus welchem Modus die Messung stammt. */
  source: 'training' | 'boss';
}

async function loadLog(): Promise<CalibrationEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CalibrationEntry[];
  } catch {
    return [];
  }
}

export async function recordCalibrationRep(rep: RepResult, source: CalibrationEntry['source']): Promise<void> {
  const log = await loadLog();
  log.push({ ...rep, recordedAtIso: new Date().toISOString(), source });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

export async function clearCalibrationLog(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Öffnet das Betriebssystem-Teilen-Menü mit den gesammelten Daten als JSON-Text -
 * schick es dir selbst (Mail, Messenger, ...) und wertet es am PC aus.
 */
export async function shareCalibrationLog(): Promise<void> {
  const log = await loadLog();
  if (log.length === 0) {
    throw new Error('Noch keine Kalibrierungsdaten gesammelt - erst ein paar Liegestütze trainieren.');
  }
  await Share.share({ message: JSON.stringify(log, null, 2) });
}
