/**
 * Expo config plugin that bundles the MediaPipe Pose Landmarker `.task` model file
 * into the native iOS and Android projects at `expo prebuild` time.
 *
 * react-native-mediapipe resolves the model as a *native bundle resource* (not a
 * remote URL): on iOS via `Bundle.main.path(forResource:)`, on Android via an asset
 * path resolved against `android/app/src/main/assets/`. Both need the actual file
 * name passed to `usePoseDetection()` (see POSE_MODEL in WorkoutScreen.tsx) to exist
 * on disk before the native build runs, which is what this plugin does.
 *
 * Run `npm run model:download` once to fetch the model into assets/models/ before
 * running `expo prebuild` (see README.md).
 */
const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODEL_FILENAME = 'pose_landmarker_lite.task';

function resolveModelSourcePath(projectRoot) {
  return path.join(projectRoot, 'assets', 'models', MODEL_FILENAME);
}

function assertModelExists(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `[withPoseLandmarkerModel] Model file not found at ${sourcePath}.\n` +
        `Run "npm run model:download" first to fetch ${MODEL_FILENAME} ` +
        `(see README.md for details), then re-run "expo prebuild".`
    );
  }
}

const withPoseLandmarkerModelAndroid = (config) =>
  withDangerousMod(config, [
    'android',
    (modConfig) => {
      const source = resolveModelSourcePath(modConfig.modRequest.projectRoot);
      assertModelExists(source);
      const assetsDir = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.copyFileSync(source, path.join(assetsDir, MODEL_FILENAME));
      return modConfig;
    },
  ]);

const withPoseLandmarkerModelIOS = (config) =>
  withXcodeProject(config, (modConfig) => {
    const source = resolveModelSourcePath(modConfig.modRequest.projectRoot);
    assertModelExists(source);

    const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
    const targetDir = path.join(modConfig.modRequest.platformProjectRoot, projectName);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, path.join(targetDir, MODEL_FILENAME));

    if (!modConfig.modResults.hasFile(path.join(projectName, MODEL_FILENAME))) {
      modConfig.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.join(projectName, MODEL_FILENAME),
        groupName: projectName,
        project: modConfig.modResults,
        isBuildFile: true,
      });
    }

    return modConfig;
  });

module.exports = function withPoseLandmarkerModel(config) {
  config = withPoseLandmarkerModelAndroid(config);
  config = withPoseLandmarkerModelIOS(config);
  return config;
};
