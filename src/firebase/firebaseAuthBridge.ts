import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * Bridges the existing Google Sign-In (src/auth/AuthContext.tsx) into Firebase Auth,
 * so Firestore/Realtime Database security rules (which check `request.auth`/`auth`)
 * actually see a signed-in user. Only ever called when isFirebaseConfigured() is true
 * (see src/firebase/firebaseConfig.ts) - callers are responsible for that check, this
 * module assumes it.
 *
 * Important: the resulting Firebase uid is *not* the same string as the Google
 * `user.id` used for the local profile (src/auth/types.ts) - it's Firebase's own
 * internal id for the "signed in via this Google account" identity. Use *this* uid
 * (getFirebaseUid()) as the key for everything ranking-related (players/{uid},
 * duels/{duelId}/players/{uid}, ...), never the Google user id.
 */
export async function signInToFirebaseWithGoogleIdToken(idToken: string): Promise<string> {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(getAuth(), credential);
  return userCredential.user.uid;
}

export function getFirebaseUid(): string | null {
  return getAuth().currentUser?.uid ?? null;
}

export async function signOutOfFirebase(): Promise<void> {
  if (getAuth().currentUser) {
    await signOut(getAuth());
  }
}

/**
 * Returns the current Firebase uid if already bridged, otherwise silently re-fetches a
 * fresh Google idToken (no UI prompt - the user is already signed in to Google, this
 * just refreshes the token) and bridges it. Covers the case where Firebase was set up
 * *after* the user's last interactive Google sign-in (so no Firebase session exists
 * yet even though the local Google sign-in is still valid). Returns null if that
 * fails, e.g. no network - callers should show a "please sign in again" fallback.
 */
export async function ensureFirebaseBridged(): Promise<string | null> {
  const existing = getFirebaseUid();
  if (existing) return existing;
  try {
    const response = await GoogleSignin.signInSilently();
    if (response.type !== 'success' || !response.data.idToken) return null;
    return await signInToFirebaseWithGoogleIdToken(response.data.idToken);
  } catch {
    return null;
  }
}
