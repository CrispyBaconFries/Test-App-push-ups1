/**
 * Forces a single, consistent androidx.camera (CameraX) version across the whole native
 * build. android/build.gradle is regenerated from scratch on every `expo prebuild`/
 * `npm run android` (like android/app/build.gradle, see withReleaseSigning.js), so this
 * has to be injected via a config plugin rather than hand-edited.
 *
 * Why this is needed: react-native-vision-camera's own android/build.gradle depends on
 * androidx.camera:*:1.5.0-alpha03, and its compiled Kotlin code (CameraDeviceDetails.kt)
 * reaches into that exact version's internal API (Camera2CameraInfoImpl). expo-camera
 * depends on the newer, stable 1.6.0 - only used by the currently-unreachable
 * CameraScreen/"Camera" route, kept as a fallback for testing via plain Expo Go, see the
 * comment on RootNavigator.tsx's `Camera` route. Without this override, Gradle's default
 * "highest version wins" conflict resolution picks 1.6.0 project-wide, which removed/
 * relocated Camera2CameraInfoImpl - crashing Boss-Modus/Workout/Duell at runtime with
 * `NoClassDefFoundError: Failed resolution of: Landroidx/camera/camera2/internal/
 * Camera2CameraInfoImpl` as soon as react-native-vision-camera enumerates camera devices.
 */
const { withProjectBuildGradle } = require('@expo/config-plugins');

const CAMERAX_VERSION = '1.5.0-alpha03';

const ALLPROJECTS_BLOCK = `allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
  }
}`;

const ALLPROJECTS_BLOCK_WITH_FORCE = `allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
  }

  // See plugins/withCameraXVersionAlignment.js for why this is forced.
  configurations.all {
    resolutionStrategy {
      force 'androidx.camera:camera-core:${CAMERAX_VERSION}'
      force 'androidx.camera:camera-camera2:${CAMERAX_VERSION}'
      force 'androidx.camera:camera-lifecycle:${CAMERAX_VERSION}'
      force 'androidx.camera:camera-video:${CAMERAX_VERSION}'
      force 'androidx.camera:camera-view:${CAMERAX_VERSION}'
      force 'androidx.camera:camera-extensions:${CAMERAX_VERSION}'
    }
  }
}`;

module.exports = function withCameraXVersionAlignment(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;
    const occurrences = contents.split(ALLPROJECTS_BLOCK).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `[withCameraXVersionAlignment] Expected exactly one occurrence of the "allprojects" block in android/build.gradle, found ${occurrences}. ` +
          'The Expo-generated Gradle template likely changed - update plugins/withCameraXVersionAlignment.js to match it.'
      );
    }
    modConfig.modResults.contents = contents.replace(ALLPROJECTS_BLOCK, ALLPROJECTS_BLOCK_WITH_FORCE);
    return modConfig;
  });
};
