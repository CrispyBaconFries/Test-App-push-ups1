import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NationsEventWindow } from './nationsEvent';

/**
 * Lokale Warteschlange für Länderspiel-Gutschriften, die (meist mangels Internet)
 * fehlgeschlagen sind - dieselbe Rolle wie `leaderboardSyncQueue.ts` für die Rangliste.
 *
 * Bewusst eine eigene Warteschlange statt die der Rangliste mitzubenutzen: Die beiden
 * können unabhängig voneinander scheitern und nachgeholt werden, und ein
 * Länderspiel-Eintrag trägt Angaben (Land, Event-Fenster), die die Rangliste nichts
 * angehen.
 *
 * Das Event-Fenster wird mitgespeichert und nicht später neu berechnet: Ändert chris
 * zwischenzeitlich den Zeitplan (z. B. von "wöchentlich Freitag" auf "alle drei Tage"),
 * würde eine Neuberechnung die alte Session plötzlich einem anderen oder gar keinem
 * Event zuordnen.
 */
export interface PendingNationsEntry {
  window: NationsEventWindow;
  countryCode: string;
  reps: number;
  finishedAtIso: string;
}

const QUEUE_KEY = '@pushup/pendingNationsSync';
const MAX_QUEUE_LENGTH = 200;

export async function loadPendingNationsQueue(): Promise<PendingNationsEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingNationsEntry[];
  } catch {
    return [];
  }
}

export async function enqueuePendingNations(entry: PendingNationsEntry): Promise<void> {
  const queue = await loadPendingNationsQueue();
  queue.push(entry);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_LENGTH)));
}

export async function savePendingNationsQueue(queue: PendingNationsEntry[]): Promise<void> {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
