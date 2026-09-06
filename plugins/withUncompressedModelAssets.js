/**
 * Expo config plugin that stops AAPT from compressing the MediaPipe `.task` model when
 * it packages the APK.
 *
 * Why this is needed: MediaPipe's `BaseOptions.setModelAssetPath()` (used by
 * react-native-mediapipe, see its PoseDetectorHelper.setupPoseLandmarker) loads the
 * model from the APK's asset directory via a file descriptor / memory mapping. That
 * only works for assets stored *uncompressed* in the APK. AAPT deflate-compresses any
 * asset extension it doesn't know, and `.task` is not on its built-in exempt list -
 * neither react-native-mediapipe's own build.gradle nor Expo's Android template sets
 * `noCompress` for it, so without this plugin the model ships compressed and
 * `PoseLandmarker.createFromOptions()` fails at startup.
 *
 * That failure is completely silent on the JS side (which is why it went undiagnosed
 * for so long): react-native-mediapipe calls `setupPoseLandmarker()` from the
 * PoseDetectorHelper *constructor*, i.e. before `createDetector`'s promise resolves and
 * therefore before the JS side has registered that handle in its `detectorMap`. The
 * resulting "onError" event is looked up by handle, finds nothing, and is dropped
 * without a trace. `poseLandmarker` then stays null forever and every subsequent
 * `poseLandmarker?.detectAsync(...)` is a no-op - no results, no errors, no onEmpty,
 * just permanent silence. (The patch in patches/react-native-mediapipe+0.6.0.patch now
 * logs those dropped errors so this can never hide again.)
 *
 * A second top-level `android { }` block is valid Gradle - it just configures the same
 * extension again - so this appends rather than editing the generated block in place,
 * which is far less fragile across Expo template changes.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

// Also covers .tflite in case a future feature bundles a raw TFLite model again.
const MARKER = 'noCompress "task"';

const GRADLE_SNIPPET = `
// Added by plugins/withUncompressedModelAssets.js - see that file for why.
// MediaPipe loads its .task model by memory-mapping the packaged asset, which only
// works if AAPT stored it uncompressed.
android {
    androidResources {
        ${MARKER}
        noCompress "tflite"
    }
}
`;

module.exports = function withUncompressedModelAssets(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error(
        `[withUncompressedModelAssets] Expected a Groovy app/build.gradle, got "${modConfig.modResults.language}".`
      );
    }
    if (!modConfig.modResults.contents.includes(MARKER)) {
      modConfig.modResults.contents += GRADLE_SNIPPET;
    }
    return modConfig;
  });
};
