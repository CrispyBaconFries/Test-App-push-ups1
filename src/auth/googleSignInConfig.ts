import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Matches the placeholder values shipped in app.json until a developer swaps in their
// own Google Cloud Console project (see README "Google-Anmeldung einrichten").
const PLACEHOLDER_PREFIX = 'REPLACE_WITH_YOUR_';

let configured = false;

function readWebClientId(): string | undefined {
  const value = Constants.expoConfig?.extra?.googleSignInWebClientId;
  return typeof value === 'string' && value.length > 0 && !value.startsWith(PLACEHOLDER_PREFIX) ? value : undefined;
}

/**
 * False until the placeholder `googleSignInWebClientId` in app.json has been replaced
 * with a real one - lets the UI show a clear "not set up yet" message instead of
 * letting a placeholder ID reach the native module and fail with a cryptic error.
 */
export function isGoogleSignInConfigured(): boolean {
  return readWebClientId() !== undefined;
}

/**
 * `webClientId` comes from app.json's `extra` block (see README "Google-Anmeldung
 * einrichten") rather than being hardcoded here, since it's project-specific and must
 * be created per-developer in Google Cloud Console. It's not a secret (Google's own
 * docs embed it in client apps), just project-identifying - safe to ship in the app
 * config, unlike a private key.
 */
export function ensureGoogleSignInConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: readWebClientId(),
    offlineAccess: false,
  });
  configured = true;
}
