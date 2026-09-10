import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';
import Constants from 'expo-constants';

/**
 * Aufgezeichnete Abstürze und Fehler — der einzige Weg, aus der Vorzeige-App zu erfahren,
 * was schiefgelaufen ist.
 *
 * # Warum es das gibt
 *
 * chris hat **eine** Installation, und das ist der Release-Build (siehe CLAUDE.md). Kein
 * Metro, kein Kabel, kein Logcat. Wenn dort etwas abstürzt, sieht er einen weißen
 * Bildschirm oder eine App, die sich schließt — und alles, was bei mir ankommt, ist „geht
 * nicht". Damit ist jede Fehlersuche ein Ratespiel, und eine Runde kostet einen kompletten
 * Build.
 *
 * Dieselbe Überlegung wie beim Kalibrier-Log: Was ich zur Diagnose brauche, muss in der
 * App landen und teilbar sein, nicht in einer Konsole, die niemand offen hat.
 *
 * # Was aufgezeichnet wird
 *
 * Fehlermeldung, Aufrufliste, wo er auftrat, Zeitpunkt und App-Version. **Keine
 * Nutzerdaten**: kein Name, keine E-Mail, keine Trainingsdaten. Eine Aufrufliste kann
 * theoretisch Variableninhalte enthalten, deshalb geht der Bericht ausschließlich über den
 * Teilen-Dialog — chris sieht vor dem Abschicken, was drinsteht, und entscheidet an wen.
 * Nichts davon verlässt das Gerät von allein.
 */

const STORAGE_KEY = '@pushup/errorLog';

/**
 * Mehr als das bringt nichts: Bei einem Fehler, der sich bei jedem Frame wiederholt,
 * wären die ältesten Einträge die interessanten — der erste zeigt die Ursache, die
 * folgenden nur noch die Folgen. Deshalb wird beim Überlauf hinten abgeschnitten, nicht
 * vorne.
 */
const MAX_ENTRIES = 25;

export interface ErrorLogEntry {
  recordedAtIso: string;
  /** Wo der Fehler auftrat, z. B. der Name des Bildschirms oder "global". */
  context: string;
  message: string;
  stack: string | null;
  /** `true`, wenn die App danach nicht weiterlaufen konnte. */
  fatal: boolean;
  appVersion: string;
  platform: string;
}

async function loadRaw(): Promise<ErrorLogEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ErrorLogEntry[];
  } catch {
    return [];
  }
}

/**
 * Alle Schreibvorgänge laufen nacheinander durch diese Kette — dieselbe Absicherung wie
 * im Kalibrier-Log. Hier wiegt sie schwerer: Fehler kommen typischerweise in Serie, oft
 * mehrere im selben Frame, und genau dann würde ein Lese-Ändern-Schreib-Rennen
 * ausgerechnet den ersten Eintrag verschlucken — den einzigen, der die Ursache zeigt.
 */
let pendingWrite: Promise<unknown> = Promise.resolve();

/**
 * Zeichnet einen Fehler auf. Wirft **nie** selbst.
 *
 * Das ist keine Kosmetik: Diese Funktion läuft in einem Fehlerbehandler. Würde sie
 * ihrerseits werfen (voller Speicher, kaputter AsyncStorage), entstünde aus einem
 * behandelbaren Fehler ein Absturz — und zwar genau in dem Moment, in dem die App gerade
 * versucht, sich zu fangen.
 */
export async function recordError(
  error: unknown,
  context: string,
  options: { fatal?: boolean } = {}
): Promise<void> {
  const entry: ErrorLogEntry = {
    recordedAtIso: new Date().toISOString(),
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? (error.stack ?? null) : null,
    fatal: options.fatal ?? false,
    appVersion: String(Constants.expoConfig?.version ?? 'unbekannt'),
    platform: `${Platform.OS} ${String(Platform.Version)}`,
  };

  const run = pendingWrite.then(async () => {
    const log = await loadRaw();
    log.push(entry);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log.slice(0, MAX_ENTRIES)));
  });
  pendingWrite = run.catch(() => undefined);
  await run.catch(() => undefined);
}

export async function loadErrorLog(): Promise<ErrorLogEntry[]> {
  return loadRaw();
}

export async function countErrors(): Promise<number> {
  return (await loadRaw()).length;
}

export async function clearErrorLog(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Baut den Bericht als lesbaren Text.
 *
 * Bewusst Text und nicht JSON, anders als beim Kalibrier-Log: Den wertet kein Skript aus,
 * den liest ein Mensch. Und chris soll im Teilen-Dialog auf einen Blick sehen können, was
 * er da verschickt.
 */
export function formatErrorReport(entries: readonly ErrorLogEntry[]): string {
  if (entries.length === 0) return 'Keine Fehler aufgezeichnet.';
  return entries
    .map((entry, index) => {
      const time = entry.recordedAtIso.slice(0, 19).replace('T', ' ');
      const head = `#${index + 1} ${entry.fatal ? '[ABSTURZ]' : '[Fehler]'} ${time} · ${entry.context}`;
      const meta = `App ${entry.appVersion} · ${entry.platform}`;
      // Die Aufrufliste ist das Wertvollste, aber auch das Längste - gekürzt, damit der
      // Bericht in eine Messenger-Nachricht passt. Die ersten Zeilen zeigen die Ursache,
      // die hinteren nur noch den Weg durch React.
      const stack = entry.stack ? entry.stack.split('\n').slice(0, 12).join('\n') : '(keine Aufrufliste)';
      return `${head}\n${meta}\n${entry.message}\n${stack}`;
    })
    .join('\n\n----------------------------------------\n\n')
    // Ehrlich dazusagen, wenn nicht alles drinsteht: Sonst sucht man in einem
    // vollständig aussehenden Bericht nach einem Fehler, der nie aufgezeichnet wurde.
    .concat(
      entries.length >= MAX_ENTRIES
        ? `\n\n(Aufzeichnung voll bei ${MAX_ENTRIES} Einträgen - spätere Fehler wurden nicht mehr ` +
          'festgehalten. Die ältesten sind die aussagekräftigsten: Der erste zeigt die Ursache, ' +
          'die folgenden nur noch deren Folgen.)'
        : ''
    );
}

/** Öffnet den Teilen-Dialog mit dem Bericht. Gibt die Anzahl der enthaltenen Einträge zurück. */
export async function shareErrorLog(): Promise<number> {
  const entries = await loadRaw();
  await Share.share({ message: formatErrorReport(entries) });
  return entries.length;
}
