import { doc, getDoc, getFirestore, runTransaction, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { createDefaultPlayerProfile, type RankedPlayerProfile } from './playerProfile';
import { applyLpChange, computeMatchLpChange } from './lp';
import { weekKey } from '../gamification/missions';

function playerDoc(uid: string) {
  return doc(getFirestore(), 'players', uid);
}

/**
 * Lädt das Spielerprofil, legt beim ersten Mal eins mit Start-LP an.
 *
 * Die Schreibzugriffe in dieser Datei bewegen sich in den Bahnen, die
 * `firestore.rules` erzwingt (Abschnitt "Sicherheit" im README): Jeder schreibt nur
 * sein eigenes Dokument, Zähler und Rekorde wachsen nur, und je Schreibzugriff sind
 * höchstens 5000 Liegestütze, 15 Punkte je neuem Liegestütz, ±40 LP sowie +1 Sieg bzw.
 * +1 Niederlage erlaubt. Wer hier größere Sprünge einbaut, muss die Regeln mitziehen -
 * sonst lehnt Firestore den Schreibzugriff ab.
 */
export async function loadOrCreatePlayerProfile(
  uid: string,
  displayName: string,
  googlePhotoUrl: string | null
): Promise<RankedPlayerProfile> {
  const ref = playerDoc(uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    return snapshot.data() as RankedPlayerProfile;
  }
  const profile = createDefaultPlayerProfile(uid, displayName, googlePhotoUrl);
  await setDoc(ref, profile);
  return profile;
}

/**
 * Schreibt das Match-Ergebnis in beide Spielerprofile - jeder Client aktualisiert nur
 * sein *eigenes* Dokument (siehe firestore.rules), berechnet aber deterministisch
 * dieselbe Formel aus den LP-Werten, die beide Seiten beim Duell-Start bereits kennen.
 * Ruft man also von beiden Geräten aus je einmal auf.
 */
export async function applyDuelResult(params: {
  myUid: string;
  myLpBefore: number;
  opponentLpBefore: number;
  didIWin: boolean;
}): Promise<{ lpChange: number; lpAfter: number }> {
  const { winnerLpChange, loserLpChange } = computeMatchLpChange(
    params.didIWin ? params.myLpBefore : params.opponentLpBefore,
    params.didIWin ? params.opponentLpBefore : params.myLpBefore
  );
  const lpChange = params.didIWin ? winnerLpChange : loserLpChange;
  const lpAfter = applyLpChange(params.myLpBefore, lpChange);

  // Bewusst als Transaktion mit ausgerechneten Werten statt mit `increment()`:
  // `firestore.rules` lässt Siege/Niederlagen nur um höchstens 1 je Schreibzugriff
  // wachsen und vergleicht dafür den ankommenden Wert mit dem gespeicherten. Ob
  // Firestore die Regel auf das *Ergebnis* eines increment()-Transforms anwendet oder
  // auf den Transform selbst, ist eine Feinheit der Auswertungsreihenfolge, von der die
  // Wertung eines Duells nicht abhängen soll - mit einem gelesenen Ausgangswert und einer
  // ausgerechneten Summe stellt sich die Frage gar nicht erst.
  await runTransaction(getFirestore(), async (tx) => {
    const ref = playerDoc(params.myUid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return; // Profil legt loadOrCreatePlayerProfile vorher an.
    const data = snapshot.data() as RankedPlayerProfile;
    tx.update(ref, {
      lp: lpAfter,
      wins: (data.wins ?? 0) + (params.didIWin ? 1 : 0),
      losses: (data.losses ?? 0) + (params.didIWin ? 0 : 1),
      updatedAt: Date.now(),
    });
  });

  return { lpChange, lpAfter };
}

/**
 * Trägt gerade absolvierte Liegestütze in `totalReps` (Gesamtrangliste) und `weeklyReps`
 * (Wochen-Rangliste) ein. Ohne Cloud Function gibt es keinen serverseitigen Cron-Job,
 * der `weeklyReps` jede Woche zurücksetzt - stattdessen trägt das Dokument sich selbst
 * die Woche ein, für die `weeklyReps` gerade gilt (`weeklyBucketKey`); sobald ein Sync in
 * einer *anderen* Woche landet, wird `weeklyReps` hier "faul" (also erst beim nächsten
 * Schreibzugriff, nicht exakt zum Wochenwechsel) auf `repsThisSession` zurückgesetzt statt
 * addiert. Läuft als Transaktion, damit ein Gerät, das nach langer Pause zum ersten Mal
 * in einer neuen Woche synct, nicht durch eine zwischenzeitliche zweite Schreib-Anfrage
 * (z. B. ein zweites Gerät desselben Nutzers) einen inkonsistenten Zwischenstand sieht.
 */
export interface PersonalRecords {
  bestDayReps: number;
  bestSessionReps: number;
  longestStreakDays: number;
}

export async function syncTrainingProgress(
  uid: string,
  repsThisSession: number,
  pointsThisSession: number,
  now: number = Date.now(),
  records?: PersonalRecords
): Promise<void> {
  const currentWeekKey = weekKey(new Date(now));
  await runTransaction(getFirestore(), async (tx) => {
    const ref = playerDoc(uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return; // Profil sollte vorher per loadOrCreatePlayerProfile angelegt worden sein.
    const data = snapshot.data() as RankedPlayerProfile;
    const priorWeeklyReps = data.weeklyBucketKey === currentWeekKey ? (data.weeklyReps ?? 0) : 0;
    tx.update(ref, {
      totalReps: (data.totalReps ?? 0) + repsThisSession,
      weeklyReps: priorWeeklyReps + repsThisSession,
      weeklyBucketKey: currentWeekKey,
      totalPoints: (data.totalPoints ?? 0) + pointsThisSession,
      // Rekorde nur nach oben: Wer die App neu installiert und damit seine lokale
      // Historie verliert, würde sonst auch seine Online-Rekorde auf die frische,
      // niedrige Historie zurücksetzen.
      ...(records
        ? {
            bestDayReps: Math.max(data.bestDayReps ?? 0, records.bestDayReps),
            bestSessionReps: Math.max(data.bestSessionReps ?? 0, records.bestSessionReps),
            longestStreakDays: Math.max(data.longestStreakDays ?? 0, records.longestStreakDays),
          }
        : {}),
      updatedAt: now,
    });
  });
}

/** Für den Münz-Shop (shop.ts/inventoryStore.ts): der Nutzer hat gerade ein Avatar-Icon gekauft/ausgerüstet. */
export async function updateEquippedAvatar(uid: string, avatar: RankedPlayerProfile['avatar']): Promise<void> {
  await updateDoc(playerDoc(uid), { avatar, updatedAt: Date.now() });
}

/** Für den Münz-Shop: der Nutzer hat gerade ein Rahmen-Theme gekauft/ausgerüstet. */
export async function updateEquippedFrameTheme(uid: string, frameThemeId: RankedPlayerProfile['frameThemeId']): Promise<void> {
  await updateDoc(playerDoc(uid), { frameThemeId, updatedAt: Date.now() });
}

/** Fürs (fremde) Profil ansehen - siehe ProfileScreen.tsx. Nichts Neues, nur eine benannte Lese-Funktion statt playerDoc()+getDoc() an mehreren Stellen zu wiederholen. */
export async function loadPlayerProfile(uid: string): Promise<RankedPlayerProfile | null> {
  const snapshot = await getDoc(playerDoc(uid));
  return snapshot.exists() ? (snapshot.data() as RankedPlayerProfile) : null;
}
