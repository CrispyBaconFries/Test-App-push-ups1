import {
  getDatabase,
  getServerTime,
  onValue,
  ref,
  runTransaction,
  set,
  update,
  type Unsubscribe,
} from '@react-native-firebase/database';
import { toLocalTime } from '../ranking/clockSync';
import type { PlayerAvatar } from '../ranking/avatar';
import type { RankTier } from '../ranking/ranks';

/** Wie viel Vorlauf zwischen "beide bereit" und dem tatsächlichen Start, damit beide
 * Geräte das RTDB-Update sicher empfangen und den Countdown anzeigen können. */
export const START_LEAD_MS = 4000;
export const DUEL_DURATION_MS = 60_000;

export type DuelStatus = 'waiting' | 'joined' | 'starting' | 'running' | 'finished';

export interface DuelPlayerInfo {
  uid: string;
  displayName: string;
  avatar: PlayerAvatar;
  tier: RankTier;
  /** LP zu Beginn des Duells - für die spätere LP-Berechnung (nur Ranked, siehe lp.ts). */
  lp: number;
}

export interface DuelPlayerState extends DuelPlayerInfo {
  ready: boolean;
  reps: number;
  finished: boolean;
  finishedReps: number | null;
}

export interface DuelState {
  status: DuelStatus;
  startsAtServerTime: number | null;
  players: Record<string, DuelPlayerState>;
}

function duelRef(code: string) {
  return ref(getDatabase(), `duels/${code}`);
}

/** Geschätzter Offset (ms) zwischen der eigenen Gerätezeit und der Serverzeit - für
 * `toLocalTime()`, um `startsAtServerTime` in die eigene Lokalzeit umzurechnen. */
export function estimateServerOffsetMs(): number {
  return getServerTime(getDatabase()).getTime() - Date.now();
}

export async function createDuel(code: string, me: DuelPlayerInfo): Promise<void> {
  const state: DuelState = {
    status: 'waiting',
    startsAtServerTime: null,
    players: {
      [me.uid]: { ...me, ready: false, reps: 0, finished: false, finishedReps: null },
    },
  };
  await set(duelRef(code), state);
}

export type JoinDuelResult = 'joined' | 'not_found' | 'full';

export async function joinDuel(code: string, me: DuelPlayerInfo): Promise<JoinDuelResult> {
  const result = await runTransaction(duelRef(code), (current: DuelState | null) => {
    if (!current) return current; // aborts - not_found, handled below
    const playerIds = Object.keys(current.players);
    if (playerIds.includes(me.uid)) return current; // rejoin (e.g. after a reload)
    if (playerIds.length >= 2) return undefined; // aborts - full
    return {
      ...current,
      status: 'joined',
      players: {
        ...current.players,
        [me.uid]: { ...me, ready: false, reps: 0, finished: false, finishedReps: null },
      },
    };
  });

  if (!result.committed) {
    return result.snapshot.exists() ? 'full' : 'not_found';
  }
  return 'joined';
}

/**
 * Markiert den eigenen Spieler als bereit. Sobald *beide* Spieler bereit sind, setzt
 * genau eine der beiden Transaktionen (RTDB garantiert das) `startsAtServerTime` und
 * `status: 'starting'` - unabhängig davon, wessen Gerät das zuerst bemerkt.
 *
 * `startsAtServerTime` wird bewusst *vor* der Transaktion aus der geschätzten
 * Serverzeit berechnet (nicht aus `Date.now()` des schreibenden Geräts): sonst würde
 * der Startzeitpunkt die Ungenauigkeit von dessen Uhr übernehmen - genau das, was
 * `clockSync.ts`/`estimateServerOffsetMs()` eigentlich korrigieren sollen. RTDB-
 * Transaktionsfunktionen müssen synchron sein, daher kann der Offset nicht *innerhalb*
 * der Transaktion neu abgefragt werden.
 */
export async function setPlayerReady(code: string, uid: string): Promise<void> {
  const estimatedStartsAtServerTime = Date.now() + estimateServerOffsetMs() + START_LEAD_MS;

  await runTransaction(duelRef(code), (current: DuelState | null) => {
    if (!current?.players[uid]) return current;
    const players = { ...current.players, [uid]: { ...current.players[uid], ready: true } };
    const bothReady = Object.values(players).length === 2 && Object.values(players).every((p) => p.ready);
    if (bothReady && current.status !== 'starting' && current.status !== 'running') {
      return {
        ...current,
        players,
        status: 'starting' as const,
        startsAtServerTime: estimatedStartsAtServerTime,
      };
    }
    return { ...current, players };
  });
}

export async function submitLiveRepCount(code: string, uid: string, reps: number): Promise<void> {
  await update(duelRef(code), { [`players/${uid}/reps`]: reps });
}

export async function submitFinalResult(code: string, uid: string, finalReps: number): Promise<void> {
  await update(duelRef(code), {
    [`players/${uid}/reps`]: finalReps,
    [`players/${uid}/finished`]: true,
    [`players/${uid}/finishedReps`]: finalReps,
  });
}

export function listenToDuel(code: string, callback: (state: DuelState | null) => void): Unsubscribe {
  return onValue(duelRef(code), (snapshot) => callback(snapshot.val()));
}

export async function leaveDuel(code: string, uid: string): Promise<void> {
  await update(duelRef(code), { [`players/${uid}`]: null });
}

/** `startsAtServerTime` (Serverzeit) in die eigene Gerätezeit umrechnen - siehe `clockSync.ts`. */
export function duelStartInLocalTime(startsAtServerTime: number, serverOffsetMs: number): number {
  return toLocalTime(startsAtServerTime, serverOffsetMs);
}
