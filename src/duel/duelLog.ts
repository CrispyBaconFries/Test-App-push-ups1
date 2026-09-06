import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local record of completed duels (Freundschaftsspiel/Ranked), purely so the weekly
 * missions ("3 Freundschaftsspiele", "3 Ranglistenspiele" - see
 * src/gamification/missions.ts) have something to count. Duel results themselves live
 * in Firebase Realtime Database (see duelSession.ts) and aren't otherwise persisted
 * locally - this is a separate, append-only local log for that one purpose.
 */
export interface DuelLogEntry {
  finishedAtIso: string;
  isRanked: boolean;
}

const DUEL_LOG_KEY = '@pushup/duelLog';
/** Missions only ever look a few weeks back at most - bounding this keeps the stored array from growing forever. */
const MAX_ENTRIES = 200;

export async function loadDuelLog(): Promise<DuelLogEntry[]> {
  const raw = await AsyncStorage.getItem(DUEL_LOG_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DuelLogEntry[];
  } catch {
    return [];
  }
}

export async function recordDuelCompleted(isRanked: boolean, finishedAtIso: string = new Date().toISOString()): Promise<void> {
  const log = await loadDuelLog();
  log.unshift({ finishedAtIso, isRanked });
  await AsyncStorage.setItem(DUEL_LOG_KEY, JSON.stringify(log.slice(0, MAX_ENTRIES)));
}
