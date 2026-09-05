import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { ensureGoogleSignInConfigured } from './googleSignInConfig';
import { toAuthProfile } from './mapGoogleUser';
import { saveProfile, loadProfile, clearProfile } from './profileStorage';
import type { AuthProfile } from './types';

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
    try {
      ensureGoogleSignInConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return;
      const nextProfile = toAuthProfile(response.data);
      await saveProfile(nextProfile);
      setProfile(nextProfile);
      setStatus('signedIn');
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
