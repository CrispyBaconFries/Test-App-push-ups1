/**
 * Makes Firebase (used for the Ranked/Freundschaftsspiel-Duell backend, see
 * src/firebase/) entirely optional until a real Firebase project exists - the app must
 * keep building and running normally for anyone who hasn't set that up yet.
 *
 * google-services.json (Android) / GoogleService-Info.plist (iOS) go at the repo root
 * (both gitignored - see README "Ranking-System einrichten"). Deliberately NOT using
 * @react-native-firebase/app's own plugin as-is, because:
 * - its Android path (copyGoogleServices.ts) throws and fails the whole `expo prebuild`
 *   if the file is missing;
 * - its iOS path unconditionally injects `[FIRApp configure]` into AppDelegate, which
 *   *crashes the app at launch* on a real device with no bundled GoogleService-Info.plist
 *   (a well-known Firebase-iOS gotcha - unlike the Android SDK, which just logs a
 *   warning and quietly skips default-app initialization when its config is missing).
 *
 * So each platform's Firebase wiring is only applied when *that* platform's config file
 * actually exists. With neither file present, this plugin is a no-op and the project
 * prebuilds exactly as it did before Firebase was added.
 *
 * Also stamps `expo.extra.firebaseConfigured` so the JS side (src/firebase/*) can check
 * at runtime whether it's safe to call any @react-native-firebase API, instead of
 * finding out by crashing.
 *
 * Reaches into @react-native-firebase/app's compiled plugin internals
 * (plugin/build/android, plugin/build/ios) rather than its public default export,
 * since only those expose the individual per-platform mods needed to apply them
 * conditionally. Not a published/versioned API - if a future @react-native-firebase/app
 * upgrade restructures its plugin folder, this needs a matching update.
 */
const fs = require('fs');
const path = require('path');
const { withPlugins } = require('@expo/config-plugins');

// `@react-native-firebase/app`'s package.json "exports" map only allows requiring
// "./app.plugin.js" (the combined, non-conditional plugin) - not the individual
// per-platform mods this file needs. Resolving the package root via its one exported
// "./package.json" subpath and then requiring an absolute path into `plugin/build/`
// sidesteps that (Node's "exports" encapsulation only restricts bare-specifier
// resolution, not requiring an already-resolved absolute path).
const rnFirebaseAppRoot = path.dirname(require.resolve('@react-native-firebase/app/package.json'));
const androidPlugins = require(path.join(rnFirebaseAppRoot, 'plugin/build/android'));
const iosPlugins = require(path.join(rnFirebaseAppRoot, 'plugin/build/ios'));

const ANDROID_CONFIG_FILENAME = 'google-services.json';
const IOS_CONFIG_FILENAME = 'GoogleService-Info.plist';

module.exports = function withFirebaseConfig(config) {
  const projectRoot = process.cwd();
  const hasAndroidConfig = fs.existsSync(path.join(projectRoot, ANDROID_CONFIG_FILENAME));
  const hasIosConfig = fs.existsSync(path.join(projectRoot, IOS_CONFIG_FILENAME));

  config.extra = config.extra || {};
  config.extra.firebaseConfigured = hasAndroidConfig || hasIosConfig;

  if (!hasAndroidConfig && !hasIosConfig) {
    console.warn(
      '[withFirebaseConfig] Kein google-services.json/GoogleService-Info.plist gefunden - ' +
        'Firebase bleibt deaktiviert (Rangliste/Duelle sind erst nach dem Setup nutzbar, ' +
        'siehe README "Ranking-System einrichten"). Alles andere baut normal weiter.'
    );
    return config;
  }

  const plugins = [];
  if (hasAndroidConfig) {
    config.android = config.android || {};
    config.android.googleServicesFile = `./${ANDROID_CONFIG_FILENAME}`;
    plugins.push(
      androidPlugins.withBuildscriptDependency,
      androidPlugins.withApplyGoogleServicesPlugin,
      androidPlugins.withCopyAndroidGoogleServices
    );
  }
  if (hasIosConfig) {
    config.ios = config.ios || {};
    config.ios.googleServicesFile = `./${IOS_CONFIG_FILENAME}`;
    plugins.push(iosPlugins.withFirebaseAppDelegate, iosPlugins.withIosGoogleServicesFile);
  }

  return withPlugins(config, plugins);
};
