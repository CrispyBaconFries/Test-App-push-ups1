import { collection, getDocs, getFirestore, limit, orderBy, query, where } from '@react-native-firebase/firestore';
import type { RankedPlayerProfile } from './playerProfile';
import type { RankTierDefinition } from './ranks';
import { listMyFriendUids } from './friendsStore';
import { loadPlayerProfile } from './playerProfileStore';

/** Genug für eine überschaubare Bestenliste ohne eigene Paginierung - siehe README "Rangliste" für die bekannte Grenze (kein "meine Platzierung", falls man nicht in den Top 50 steht). */
const LEADERBOARD_LIMIT = 50;

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatar: RankedPlayerProfile['avatar'];
  lp: number;
  frameThemeId: RankedPlayerProfile['frameThemeId'];
  /** Die Kennzahl, nach der *diese* Bestenliste sortiert ist (totalReps/weeklyReps/lp - je nach Tab). */
  value: number;
}

function toEntry(data: RankedPlayerProfile, value: number): LeaderboardEntry {
  return {
    uid: data.uid,
    displayName: data.displayName,
    avatar: data.avatar,
    lp: data.lp,
    frameThemeId: data.frameThemeId ?? 'default',
    value,
  };
}

function playersCollection() {
  return collection(getFirestore(), 'players');
}

export async function loadTotalRepsLeaderboard(): Promise<LeaderboardEntry[]> {
  const q = query(playersCollection(), orderBy('totalReps', 'desc'), limit(LEADERBOARD_LIMIT));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data() as RankedPlayerProfile;
    return toEntry(data, data.totalReps ?? 0);
  });
}

/**
 * `weeklyReps` allein reicht nicht, weil ein Spieler, der diese Woche noch nicht
 * trainiert hat, dort noch den (veralteten) Wert der letzten Woche stehen haben kann -
 * `weeklyReps` wird ja erst beim nächsten Sync "faul" zurückgesetzt (siehe
 * `syncTrainingProgress` in playerProfileStore.ts). Der Gleichheitsfilter auf
 * `weeklyBucketKey` blendet genau diese veralteten Einträge aus.
 */
export async function loadWeeklyLeaderboard(currentWeekKey: string): Promise<LeaderboardEntry[]> {
  const q = query(
    playersCollection(),
    where('weeklyBucketKey', '==', currentWeekKey),
    orderBy('weeklyReps', 'desc'),
    limit(LEADERBOARD_LIMIT)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data() as RankedPlayerProfile;
    return toEntry(data, data.weeklyReps ?? 0);
  });
}

/**
 * Ich selbst + alle, die ich per Freundescode hinzugefügt habe (siehe friendsStore.ts),
 * nach Gesamt-Liegestützen sortiert. Anders als die anderen drei Listen hier keine
 * Firestore-Query mit `limit` - die Freundesliste ist typischerweise klein genug (und
 * jeder Eintrag braucht ohnehin einen eigenen `getDoc`, siehe `loadPlayerProfile`),
 * dass eine eigene Paginierung hier nicht nötig ist.
 */
export async function loadFriendsLeaderboard(myUid: string): Promise<LeaderboardEntry[]> {
  const friendUids = await listMyFriendUids(myUid);
  const uids = [...new Set([myUid, ...friendUids])];
  const profiles = await Promise.all(uids.map((uid) => loadPlayerProfile(uid)));
  const entries = profiles
    .filter((p): p is RankedPlayerProfile => p !== null)
    .map((p) => toEntry(p, p.totalReps ?? 0));
  return entries.sort((a, b) => b.value - a.value);
}

/** Alle Spieler in derselben Rang-Stufe (Bronze/Silber/.../Challenger), nach LP sortiert. */
export async function loadDivisionLeaderboard(tier: RankTierDefinition): Promise<LeaderboardEntry[]> {
  const base = playersCollection();
  const q =
    tier.maxLp === null
      ? query(base, where('lp', '>=', tier.minLp), orderBy('lp', 'desc'), limit(LEADERBOARD_LIMIT))
      : query(base, where('lp', '>=', tier.minLp), where('lp', '<=', tier.maxLp), orderBy('lp', 'desc'), limit(LEADERBOARD_LIMIT));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data() as RankedPlayerProfile;
    return toEntry(data, data.lp);
  });
}
