import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from '../storage/workoutStorage';

/**
 * "Streak-Rettung" aus dem Münz-Shop (shop.ts): schützt die Trainings-Streak
 * (`computeStats().currentStreakDays`) automatisch vor dem nächsten verpassten Tag,
 * ohne dass man sie manuell "auf einen bestimmten Tag" anwenden muss - genau wie in
 * bekannten Streak-Systemen wird ein gehaltener Freeze beim ersten echten Rückschlag
 * automatisch und endgültig verbraucht.
 */
const HELD_KEY = '@pushup/heldStreakFreezes';
const FROZEN_DAYS_KEY = '@pushup/frozenStreakDayKeys';
/** Sicherheitsgrenze gegen eine pathologisch lange Rückwärts-Suche - in der Praxis bricht die Schleife immer viel früher ab (erste echte Lücke ohne Freeze). */
const MAX_LOOKBACK_DAYS = 400;

export async function getHeldStreakFreezes(): Promise<number> {
  const raw = await AsyncStorage.getItem(HELD_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Beim Kauf im Shop aufgerufen. */
export async function addHeldStreakFreeze(): Promise<number> {
  const next = (await getHeldStreakFreezes()) + 1;
  await AsyncStorage.setItem(HELD_KEY, String(next));
  return next;
}

async function loadFrozenDayKeys(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(FROZEN_DAYS_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export interface StreakFreezeReconciliation {
  /** An computeStats(sessions, frozenDayKeys) weiterzugeben. */
  frozenDayKeys: Set<string>;
  heldFreezesRemaining: number;
  /** Tage, die *in diesem Aufruf* neu eingefroren wurden - für eine "Streak gerettet!"-Meldung. */
  justFrozen: string[];
}

/**
 * Am besten bei jedem Fokussieren des Home-Screens aufgerufen, bevor `computeStats`
 * läuft. Sucht rückwärts ab gestern nach der ersten *neuen* Lücke (kein Training, noch
 * nicht eingefroren) und verbraucht dafür - sofern vorhanden - endgültig einen
 * gehaltenen Freeze; "heute" wird nie eingefroren (siehe computeStats - ein noch
 * laufender Tag ohne Training ist keine Lücke, sondern einfach noch nicht vorbei).
 */
export async function reconcileStreakFreezes(
  workoutDays: ReadonlySet<string>,
  now: Date = new Date()
): Promise<StreakFreezeReconciliation> {
  let heldFreezes = await getHeldStreakFreezes();
  const frozenDayKeys = await loadFrozenDayKeys();
  const justFrozen: string[] = [];

  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - 1); // ab gestern - heute wird nie eingefroren
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const key = localDayKey(cursor);
    if (workoutDays.has(key) || frozenDayKeys.has(key)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (heldFreezes <= 0) break; // echte Lücke, keine Freezes mehr übrig
    frozenDayKeys.add(key);
    justFrozen.push(key);
    heldFreezes -= 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  if (justFrozen.length > 0) {
    await AsyncStorage.setItem(FROZEN_DAYS_KEY, JSON.stringify([...frozenDayKeys]));
    await AsyncStorage.setItem(HELD_KEY, String(heldFreezes));
  }
  return { frozenDayKeys, heldFreezesRemaining: heldFreezes, justFrozen };
}
