import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { ensureGoogleSignInConfigured, isGoogleSignInConfigured } from './googleSignInConfig';
import { toAuthProfile } from './mapGoogleUser';
import { saveProfile, loadProfile, clearProfile } from './profileStorage';
import type { AuthProfile } from './types';
import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import { signInToFirebaseWithGoogleIdToken, signOutOfFirebase } from '../firebase/firebaseAuthBridge';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  profile: AuthProfile | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureGoogleSignInConfigured();
    // No backend to validate a session against, so a locally persisted profile is
    // treated as "signed in" - this only drives optional personalization/UI, not access
    // control. See README "Google-Anmeldung" for the scope/limits of this.
    loadProfile().then((stored) => {
      setProfile(stored);
      setStatus(stored ? 'signedIn' : 'signedOut');
    });
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    if (!isGoogleSignInConfigured()) {
      setError(
        'Google-Anmeldung ist noch nicht eingerichtet (Platzhalter in app.json). Siehe README, Abschnitt „Google-Anmeldung einrichten".'
      );
      return;
    }
    try {
      ensureGoogleSignInConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return;
      const nextProfile = toAuthProfile(response.data);
      await saveProfile(nextProfile);
      setProfile(nextProfile);
      setStatus('signedIn');

      // Bridges into Firebase Auth so Firestore/RTDB security rules see a signed-in
      // user (needed for the ranking system) - best-effort: the Google sign-in above
      // already fully succeeded, so a Firebase-side hiccup here shouldn't be shown as
      // a failed login, it just means ranking features stay unavailable this session.
      if (isFirebaseConfigured() && response.data.idToken) {
        try {
          await signInToFirebaseWithGoogleIdToken(response.data.idToken);
        } catch (firebaseError) {
          console.warn('[AuthContext] Firebase-Anmeldung fehlgeschlagen', firebaseError);
        }
      }
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) {
        return;
      }
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Dienste sind auf diesem Gerät nicht verfügbar.');
        return;
      }
      setError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await GoogleSignin.signOut();
    } catch {
      // Native session may already be gone (e.g. revoked in the Google account
      // settings) - local state below still needs clearing either way.
    }
    if (isFirebaseConfigured()) {
      try {
        await signOutOfFirebase();
      } catch (firebaseError) {
        console.warn('[AuthContext] Firebase-Abmeldung fehlgeschlagen', firebaseError);
      }
    }
    await clearProfile();
    setProfile(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, profile, error, signIn, signOut }),
    [status, profile, error, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
