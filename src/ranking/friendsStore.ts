import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from '@react-native-firebase/firestore';
import type { RankedPlayerProfile } from './playerProfile';

function playersCollection() {
  return collection(getFirestore(), 'players');
}

function friendsCollection(uid: string) {
  return collection(getFirestore(), 'players', uid, 'friends');
}

export type AddFriendResult = 'added' | 'not_found' | 'is_self' | 'already_friends';

/**
 * Bewusst *einseitig*, kein Freundschaftsanfrage/Bestätigen-Ablauf: ich trage jemanden
 * per Freundescode in MEINE eigene `players/{myUid}/friends`-Subcollection ein - dafür
 * ist keine Cloud Function nötig (siehe firestore.rules: jeder darf nur seine eigene
 * Subcollection schreiben) und keine Zustimmung der anderen Seite. Das heißt aber auch:
 * die andere Person sieht mich dadurch nicht automatisch in ihrer eigenen Liste - ein
 * bewusst einfacher "Folgen statt Anfreunden"-Mechanismus, passend zum Rest dieses
 * Ranking-Systems (auch Duelle laufen komplett ohne Anfrage/Bestätigung-Schritt).
 */
export async function addFriendByCode(myUid: string, code: string): Promise<AddFriendResult> {
  const q = query(playersCollection(), where('friendCode', '==', code.trim().toUpperCase()));
  const snapshot = await getDocs(q);
  const match = snapshot.docs[0];
  if (!match) return 'not_found';

  const friendProfile = match.data() as RankedPlayerProfile;
  if (friendProfile.uid === myUid) return 'is_self';

  const ref = doc(friendsCollection(myUid), friendProfile.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return 'already_friends';

  await setDoc(ref, { uid: friendProfile.uid, addedAt: Date.now() });
  return 'added';
}

export async function listMyFriendUids(myUid: string): Promise<string[]> {
  const snapshot = await getDocs(friendsCollection(myUid));
  return snapshot.docs.map((d) => d.id);
}

export async function removeFriend(myUid: string, friendUid: string): Promise<void> {
  await deleteDoc(doc(friendsCollection(myUid), friendUid));
}
