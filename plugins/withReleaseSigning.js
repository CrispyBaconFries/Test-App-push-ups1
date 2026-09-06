/**
 * Wires up release signing for the Android build so `./gradlew bundleRelease` produces
 * a Play-Store-ready .aab as soon as you drop in your own keystore - no manual edits to
 * android/app/build.gradle needed (that file is regenerated from scratch on every
 * `expo prebuild`/`npm run android`, so anything hand-edited there would just be wiped).
 *
 * How it works: reads `keystore.properties` from the *repo root* (one level above
 * `android/`, so it survives `expo prebuild` deleting/recreating android/) at Gradle
 * build time. If that file doesn't exist yet, the release build type silently falls
 * back to the debug signing config, same as Expo's own default - so a fresh clone
 * without a keystore still builds fine, it's just not Play-Store-signed.
 *
 * See README.md "Play-Store-Veröffentlichung" for how to create keystore.properties
 * from the committed keystore.properties.example template.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const KEYSTORE_PROPERTIES_LOADER = `
def keystorePropertiesFile = rootProject.file("../keystore.properties")
def keystoreProperties = new Properties()
def hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {`;

const SIGNING_CONFIGS_DEBUG_BLOCK = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const SIGNING_CONFIGS_WITH_RELEASE = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (hasReleaseSigning) {
                storeFile rootProject.file("../" + keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }`;

// `signingConfig signingConfigs.debug` appears verbatim in *both* buildTypes.debug and
// buildTypes.release - the two comment lines above it are only present in the release
// block, so they're included here to target that occurrence specifically.
const RELEASE_SIGNING_CONFIG_BLOCK = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
const RELEASE_SIGNING_CONFIG_BLOCK_REPLACEMENT = `            // Reads android/../keystore.properties if present (see plugins/withReleaseSigning.js).
            signingConfig hasReleaseSigning ? signingConfigs.release : signingConfigs.debug`;

function replaceOnce(contents, search, replacement, label) {
  const occurrences = contents.split(search).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `[withReleaseSigning] Expected exactly one occurrence of "${label}" in android/app/build.gradle, found ${occurrences}. ` +
        'The Expo-generated Gradle template likely changed - update plugins/withReleaseSigning.js to match it.'
    );
  }
  return contents.replace(search, replacement);
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    contents = replaceOnce(contents, '\nandroid {', KEYSTORE_PROPERTIES_LOADER, 'android { block start');
    contents = replaceOnce(contents, SIGNING_CONFIGS_DEBUG_BLOCK, SIGNING_CONFIGS_WITH_RELEASE, 'signingConfigs debug block');
    contents = replaceOnce(
      contents,
      RELEASE_SIGNING_CONFIG_BLOCK,
      RELEASE_SIGNING_CONFIG_BLOCK_REPLACEMENT,
      'release buildType signingConfig line'
    );
    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
