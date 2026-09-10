import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AuthProfile } from './types';

// Name/email are PII, so they go through the OS keychain/keystore (expo-secure-store)
// rather than the plain-text AsyncStorage used for workout history.
const PROFILE_KEY = 'auth.profile.v1';

/**
 * `expo-secure-store` gibt es auf dem Web schlicht nicht - jeder Aufruf endet dort in
 * "getValueWithKeyAsync is not a function". Für die Web-Vorschau (siehe
 * `src/web-stubs/README.md`) wird deshalb auf AsyncStorage ausgewichen, das dort auf
 * `localStorage` läuft.
 *
 * Das ist **kein** gleichwertiger Ersatz, sondern bewusst nur für die Vorschau gedacht:
 * `localStorage` ist unverschlüsselt und für jedes Skript auf derselben Seite lesbar. Auf
 * dem Handy - dem einzigen Ort, an dem echte Nutzerdaten anfallen - bleibt es beim
 * Schlüsselbund des Betriebssystems.
 */
const useSecureStore = Platform.OS !== 'web';

export async function saveProfile(profile: AuthProfile): Promise<void> {
  const value = JSON.stringify(profile);
  if (useSecureStore) {
    await SecureStore.setItemAsync(PROFILE_KEY, value);
    return;
  }
  await AsyncStorage.setItem(PROFILE_KEY, value);
}

export async function loadProfile(): Promise<AuthProfile | null> {
  const raw = useSecureStore
    ? await SecureStore.getItemAsync(PROFILE_KEY)
    : await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthProfile;
  } catch {
    return null;
  }
}

export async function clearProfile(): Promise<void> {
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(PROFILE_KEY);
    return;
  }
  await AsyncStorage.removeItem(PROFILE_KEY);
}
