import { doc, getDoc, getFirestore, increment, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { createDefaultPlayerProfile, type RankedPlayerProfile } from './playerProfile';
import { applyLpChange, computeMatchLpChange } from './lp';

function playerDoc(uid: string) {
  return doc(getFirestore(), 'players', uid);
}

/** Lädt das Spielerprofil, legt beim ersten Mal eins mit Start-LP an (siehe `firestore.rules`: nur der Owner darf seinen eigenen Datensatz schreiben). */
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

  await updateDoc(playerDoc(params.myUid), {
    lp: lpAfter,
    wins: increment(params.didIWin ? 1 : 0),
    losses: increment(params.didIWin ? 0 : 1),
    updatedAt: Date.now(),
  });

  return { lpChange, lpAfter };
}
