import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import type { DuelPlayerInfo } from '../duel/duelSession';

const COLLECTION = 'rankedQueue';

export interface QueueEntry extends DuelPlayerInfo {
  status: 'waiting' | 'matched';
  /**
   * Bewusst eine normale Client-Zeit (Date.now()), keine Firestore serverTimestamp():
   * serverTimestamp() liest erst nach einem Server-Roundtrip einen echten Wert (bis
   * dahin `null`), das wäre für die Suchradius-Berechnung (braucht sofort einen Wert)
   * unpraktisch. Ein paar Sekunden Ungenauigkeit hier stören nicht - anders als beim
   * synchronisierten Duell-Start (dafür wird weiterhin echte Serverzeit verwendet,
   * siehe duelSession.ts/clockSync.ts).
   */
  queuedAtMs: number;
  matchedDuelCode: string | null;
}

function queueDoc(uid: string) {
  return doc(getFirestore(), COLLECTION, uid);
}

export async function joinQueue(me: DuelPlayerInfo): Promise<void> {
  const entry: QueueEntry = { ...me, status: 'waiting', queuedAtMs: Date.now(), matchedDuelCode: null };
  await setDoc(queueDoc(me.uid), entry);
}

export async function leaveQueue(uid: string): Promise<void> {
  await deleteDoc(queueDoc(uid));
}

export function listenToMyQueueEntry(uid: string, callback: (entry: QueueEntry | null) => void): Unsubscribe {
  return onSnapshot(queueDoc(uid), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as QueueEntry) : null);
  });
}

/** Andere wartende Spieler innerhalb `radius` LP, älteste Wartezeit zuerst. */
export async function findCandidates(myUid: string, myLp: number, radius: number): Promise<QueueEntry[]> {
  const q = query(
    collection(getFirestore(), COLLECTION),
    where('status', '==', 'waiting'),
    where('lp', '>=', myLp - radius),
    where('lp', '<=', myLp + radius),
    orderBy('lp'),
    orderBy('queuedAtMs'),
    limit(5)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as QueueEntry).filter((entry) => entry.uid !== myUid);
}

/**
 * Versucht, einen wartenden Kandidaten für ein Duell zu "claimen" - per Transaktion,
 * damit nicht zwei Spieler gleichzeitig denselben Kandidaten beanspruchen (nur eine der
 * beiden Transaktionen gewinnt, die andere sieht `status !== 'waiting'` und bricht ab).
 * Gibt `true` zurück, wenn der Aufrufer den Kandidaten für sich gewinnen konnte.
 */
export async function tryClaimCandidate(candidateUid: string, duelCode: string): Promise<boolean> {
  return runTransaction(getFirestore(), async (tx) => {
    const ref = queueDoc(candidateUid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists() || snapshot.data()?.status !== 'waiting') return false;
    tx.update(ref, { status: 'matched', matchedDuelCode: duelCode });
    return true;
  });
}

/** Markiert die eigene Warteschlangen-Position als vergeben, ohne sie zu löschen - der
 * Gegner (der uns claimt) schreibt direkt hierauf; nach dem Beitritt zum Duell räumt
 * `leaveQueue` den Eintrag ganz weg. */
export async function markSelfMatched(uid: string, duelCode: string): Promise<void> {
  await updateDoc(queueDoc(uid), { status: 'matched', matchedDuelCode: duelCode });
}
