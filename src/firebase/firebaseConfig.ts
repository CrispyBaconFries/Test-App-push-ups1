import Constants from 'expo-constants';

/**
 * True only once a real google-services.json/GoogleService-Info.plist has been baked
 * into the native build - stamped into app.json's `extra` at prebuild time by
 * plugins/withFirebaseConfig.js (see there for why this can't just be checked by
 * calling into @react-native-firebase directly: doing that when Firebase isn't
 * configured is exactly the failure mode this flag exists to avoid).
 *
 * Every screen/module that touches @react-native-firebase (auth, firestore, ...) must
 * check this first and show a "not set up yet" state instead when it's false - see
 * README "Ranking-System einrichten".
 */
export function isFirebaseConfigured(): boolean {
  return Constants.expoConfig?.extra?.firebaseConfigured === true;
}
