import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import { ensureFirebaseBridged } from '../firebase/firebaseAuthBridge';
import { loadOrCreatePlayerProfile, syncTrainingProgress } from './playerProfileStore';
import { enqueuePendingSync, loadPendingSyncQueue, savePendingSyncQueue, type PendingSyncEntry } from './leaderboardSyncQueue';
import type { AuthProfile } from '../auth/types';

/**
 * Best-effort Sync einer gerade abgeschlossenen Session in die Online-Ranglisten
 * (`players/{uid}.totalReps`/`weeklyReps`, siehe LeaderboardScreen) - ein No-op, wenn
 * Firebase nicht eingerichtet ist oder der Nutzer nicht angemeldet ist, da die
 * Ranglisten wie der Rest des Ranking-Systems opt-in per Google-Anmeldung sind. Absichtlich
 * so geschrieben, dass ein Aufrufer das NICHT abwarten muss, um weiterzumachen (siehe
 * WorkoutScreen/BossFightScreen: `syncLeaderboardProgress(...).catch(() => {})`, ohne
 * `await`) - ein Netzwerkproblem hier darf niemals das Beenden eines Workouts blockieren.
 *
 * Schlägt der eigentliche Firestore-Schreibzugriff fehl (typischerweise: kein Internet),
 * landet die Session in `leaderboardSyncQueue.ts` statt verloren zu gehen - und wird bei
 * jedem folgenden erfolgreichen Sync (oder explizit über `flushPendingLeaderboardSync`,
 * siehe HomeScreen/LeaderboardScreen bei jedem Fokussieren) automatisch nachgeholt.
 */
export async function syncLeaderboardProgress(
  profile: AuthProfile | null,
  repsThisSession: number,
  pointsThisSession: number,
  finishedAtIso: string = new Date().toISOString()
): Promise<void> {
  if (repsThisSession <= 0 || !profile || !isFirebaseConfigured()) return;
  const uid = await ensureFirebaseBridged();
  if (!uid) return;

  try {
    await loadOrCreatePlayerProfile(uid, profile.name ?? profile.email, profile.photoUrl);
    await syncTrainingProgress(uid, repsThisSession, pointsThisSession, new Date(finishedAtIso).getTime());
  } catch {
    await enqueuePendingSync({ reps: repsThisSession, points: pointsThisSession, finishedAtIso });
    return;
  }

  // Erfolgreich durchgekommen - gute Gelegenheit, auch ältere, bisher gescheiterte
  // Syncs nachzuholen (z. B. eine Boss-Fight-Session von letzter Woche ohne Internet).
  await flushPendingLeaderboardSync(profile);
}

/**
 * Versucht alle wartenden Einträge nachzuholen. Bricht beim ersten Fehler innerhalb
 * dieses Durchlaufs ab (statt jeden einzelnen Eintrag erneut gegen ein vermutlich
 * generelles Netzwerkproblem anzurennen) und hebt den Rest für den nächsten Versuch auf.
 */
export async function flushPendingLeaderboardSync(profile: AuthProfile | null): Promise<void> {
  if (!profile || !isFirebaseConfigured()) return;
  const queue = await loadPendingSyncQueue();
  if (queue.length === 0) return;
  const uid = await ensureFirebaseBridged();
  if (!uid) return;

  await loadOrCreatePlayerProfile(uid, profile.name ?? profile.email, profile.photoUrl);

  const remaining: PendingSyncEntry[] = [];
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i]!;
    try {
      await syncTrainingProgress(uid, entry.reps, entry.points, new Date(entry.finishedAtIso).getTime());
    } catch {
      remaining.push(...queue.slice(i));
      break;
    }
  }
  await savePendingSyncQueue(remaining);
}
