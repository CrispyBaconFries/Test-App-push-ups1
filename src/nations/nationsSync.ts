import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import { ensureFirebaseBridged } from '../firebase/firebaseAuthBridge';
import type { AuthProfile } from '../auth/types';
import { eventWindowForTimestamp, type NationsEventSchedule } from './nationsEvent';
import { loadNationsChoice } from './nationsChoiceStore';
import { creditReps } from './nationsStore';
import {
  enqueuePendingNations,
  loadPendingNationsQueue,
  savePendingNationsQueue,
  type PendingNationsEntry,
} from './nationsSyncQueue';

/**
 * Schreibt eine gerade beendete Session dem gewählten Land gut - ein No-op, wenn
 * Firebase nicht eingerichtet ist, der Nutzer nicht angemeldet ist, gerade kein Event
 * läuft, oder er für dieses Event kein Land gewählt hat.
 *
 * Wie `syncLeaderboardProgress` bewusst so geschrieben, dass ein Aufrufer das NICHT
 * abwarten muss (`.catch(() => {})` ohne `await`): Ein Netzwerkproblem darf das Beenden
 * eines Workouts niemals blockieren. Was nicht durchkommt, landet in der Warteschlange.
 *
 * Maßgeblich ist der Zeitpunkt der *Session*, nicht der des Hochladens: Wer Sonntagabend
 * ohne Internet trainiert und erst Dienstag wieder online ist, bekommt die Liegestütze
 * trotzdem dem Sonntags-Event gutgeschrieben und nicht dem nächsten.
 */
export async function syncNationsProgress(
  profile: AuthProfile | null,
  reps: number,
  finishedAtIso: string = new Date().toISOString(),
  schedule?: NationsEventSchedule
): Promise<void> {
  if (reps <= 0 || !profile || !isFirebaseConfigured()) return;

  const window = eventWindowForTimestamp(new Date(finishedAtIso).getTime(), schedule);
  if (!window) return;

  const choice = await loadNationsChoice(window.id);
  if (!choice) return;

  const uid = await ensureFirebaseBridged();
  if (!uid) return;
  const displayName = profile.name ?? profile.email;

  try {
    await creditReps({ window, uid, displayName, countryCode: choice.countryCode, reps });
  } catch {
    await enqueuePendingNations({ window, countryCode: choice.countryCode, reps, finishedAtIso });
    return;
  }

  await flushPendingNationsSync(profile);
}

/**
 * Holt alle wartenden Gutschriften nach. Bricht beim ersten Fehler ab (statt jeden
 * Eintrag einzeln gegen ein vermutlich generelles Netzwerkproblem anrennen zu lassen)
 * und hebt den Rest für den nächsten Versuch auf - genauso wie bei der Rangliste.
 */
/**
 * Verhindert, dass zwei Nachhol-Läufe gleichzeitig laufen.
 *
 * Ohne das würden beide dieselbe Warteschlange laden und beide dieselben Einträge
 * gutschreiben - die Liegestütze zählten doppelt. Auslösen lässt sich das ganz normal:
 * Der Aufruf nach einem beendeten Training läuft bewusst ohne `await` weiter, und wer
 * währenddessen zum Startbildschirm zurückkehrt, stößt dort den nächsten an. Ein
 * laufender Durchlauf wird deshalb einfach mitbenutzt statt ein zweiter gestartet.
 */
let nationsFlushInFlight: Promise<void> | null = null;

export function flushPendingNationsSync(profile: AuthProfile | null): Promise<void> {
  if (nationsFlushInFlight) return nationsFlushInFlight;
  nationsFlushInFlight = runNationsFlush(profile).finally(() => {
    nationsFlushInFlight = null;
  });
  return nationsFlushInFlight;
}

async function runNationsFlush(profile: AuthProfile | null): Promise<void> {
  if (!profile || !isFirebaseConfigured()) return;
  const queue = await loadPendingNationsQueue();
  if (queue.length === 0) return;
  const uid = await ensureFirebaseBridged();
  if (!uid) return;
  const displayName = profile.name ?? profile.email;

  const remaining: PendingNationsEntry[] = [];
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i]!;
    try {
      await creditReps({
        window: entry.window,
        uid,
        displayName,
        countryCode: entry.countryCode,
        reps: entry.reps,
      });
    } catch {
      remaining.push(...queue.slice(i));
      break;
    }
  }
  await savePendingNationsQueue(remaining);
}
