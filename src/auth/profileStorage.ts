import * as SecureStore from 'expo-secure-store';
import type { AuthProfile } from './types';

// Name/email are PII, so they go through the OS keychain/keystore (expo-secure-store)
// rather than the plain-text AsyncStorage used for workout history.
const PROFILE_KEY = 'auth.profile.v1';

export async function saveProfile(profile: AuthProfile): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<AuthProfile | null> {
  const raw = await SecureStore.getItemAsync(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthProfile;
  } catch {
    return null;
  }
}

export async function clearProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(PROFILE_KEY);
}
