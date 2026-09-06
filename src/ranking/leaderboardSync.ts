import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import { ensureFirebaseBridged } from '../firebase/firebaseAuthBridge';
import { loadOrCreatePlayerProfile, syncTrainingProgress } from './playerProfileStore';
import type { AuthProfile } from '../auth/types';

/**
 * Best-effort Sync einer gerade abgeschlossenen Session in die Online-Ranglisten
 * (`players/{uid}.totalReps`/`weeklyReps`, siehe LeaderboardScreen) - ein No-op, wenn
 * Firebase nicht eingerichtet ist oder der Nutzer nicht angemeldet ist, da die
 * Ranglisten wie der Rest des Ranking-Systems opt-in per Google-Anmeldung sind. Absichtlich
 * so geschrieben, dass ein Aufrufer das NICHT abwarten muss, um weiterzumachen (siehe
 * WorkoutScreen/BossFightScreen: `syncLeaderboardProgress(...).catch(() => {})`, ohne
 * `await`) - ein Netzwerkproblem hier darf niemals das Beenden eines Workouts blockieren.
 */
export async function syncLeaderboardProgress(profile: AuthProfile | null, repsThisSession: number): Promise<void> {
  if (repsThisSession <= 0 || !profile || !isFirebaseConfigured()) return;
  const uid = await ensureFirebaseBridged();
  if (!uid) return;
  await loadOrCreatePlayerProfile(uid, profile.name ?? profile.email, profile.photoUrl);
  await syncTrainingProgress(uid, repsThisSession);
}
