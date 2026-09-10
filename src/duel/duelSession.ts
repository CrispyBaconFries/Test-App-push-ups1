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

/**
 * Wie viel Vorlauf zwischen "beide bereit" und dem tatsächlichen Start.
 *
 * Zwei Aufgaben in einer Zahl: Beide Geräte müssen das RTDB-Update sicher empfangen
 * haben, bevor die Zeit läuft - und beide Spieler brauchen ein hörbares "gleich geht es
 * los", während sie schon im Stütz liegen und nicht mehr auf den Bildschirm sehen. Das ist
 * der 3-2-1-Countdown, den `DuelScreen` daraus anzeigt.
 */
export const START_LEAD_MS = 3000;

/**
 * Wie lange nach dem Finden des Gegners mindestens Zeit ist, sich in Position zu bringen -
 * bevor "bereit" überhaupt gemeldet werden darf.
 *
 * Warum es ein *Mindest*fenster ist und keine Frist: Ohne es startet ein Match, sobald
 * beide zufällig gleichzeitig im Stütz erkannt werden - beim einen nach zwei Sekunden,
 * weil er schon lag, beim anderen mitten in der Bewegung. Mit ihm hat jeder denselben
 * Vorlauf, und der 3-2-1-Countdown kommt für beide an derselben Stelle.
 *
 * Es ist ausdrücklich **keine Frist**: Wer nach zehn Sekunden noch nicht liegt, hält das
 * Match auf, statt dass es ohne ihn losgeht. In der Rangliste stehen LP auf dem Spiel -
 * ein Match, das startet, während einer noch steht, ist verlorener Fortschritt für ihn und
 * ein geschenkter Sieg für den anderen. Gegen ein Hängenbleiben schützt stattdessen
 * `DUEL_READY_FALLBACK_MS` in `DuelScreen`.
 */
export const MATCH_PREPARATION_MS = 10_000;
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
