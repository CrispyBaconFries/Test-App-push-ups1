import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

let configured = false;

/**
 * `webClientId` comes from app.json's `extra` block (see README "Google-Anmeldung
 * einrichten") rather than being hardcoded here, since it's project-specific and must
 * be created per-developer in Google Cloud Console. It's not a secret (Google's own
 * docs embed it in client apps), just project-identifying - safe to ship in the app
 * config, unlike a private key.
 */
export function ensureGoogleSignInConfigured(): void {
  if (configured) return;
  const webClientId = Constants.expoConfig?.extra?.googleSignInWebClientId;
  GoogleSignin.configure({
    webClientId: typeof webClientId === 'string' && webClientId.length > 0 ? webClientId : undefined,
    offlineAccess: false,
  });
  configured = true;
}
