import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lokale Warteschlange für Rangliste-Syncs, die (meist mangels Internet) fehlgeschlagen
 * sind - ohne das würde `syncLeaderboardProgress` (leaderboardSync.ts) einen
 * Netzwerkfehler einfach verschlucken (`.catch(() => {})`, siehe WorkoutScreen/
 * BossFightScreen), und die Liegestütze dieser Session würden nie in der Online-Rangliste
 * auftauchen. `finishedAtIso` ist bewusst der Zeitpunkt der ursprünglichen Session, nicht
 * des (späteren) Nachhol-Versuchs - sonst würde eine Sonntagabend-Session, die erst
 * Dienstag nachgeholt wird, fälschlich in der falschen Woche gezählt werden (siehe
 * `syncTrainingProgress` in playerProfileStore.ts, das genau diesen Zeitstempel für die
 * Wochen-Zuordnung nutzt).
 */
export interface PendingSyncEntry {
  reps: number;
  points: number;
  finishedAtIso: string;
}

const QUEUE_KEY = '@pushup/pendingLeaderboardSync';
/** Grosszügig genug für Wochen ohne Internet; wer öfter offline trainiert, verliert dann die ältesten Einträge statt den Speicher unbegrenzt wachsen zu lassen. */
const MAX_QUEUE_LENGTH = 200;

export async function loadPendingSyncQueue(): Promise<PendingSyncEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingSyncEntry[];
  } catch {
    return [];
  }
}

export async function enqueuePendingSync(entry: PendingSyncEntry): Promise<void> {
  const queue = await loadPendingSyncQueue();
  queue.push(entry);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_LENGTH)));
}

export async function savePendingSyncQueue(queue: PendingSyncEntry[]): Promise<void> {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
