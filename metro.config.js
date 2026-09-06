// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-fast-tflite loads .tflite models via `require(...)`, like any other
// static asset (image, font, ...) - Metro just needs to know the extension. See
// src/bossmode/useBossFightCamera.ts / README "Boss-Modus" for how the segmentation
// model is loaded.
config.resolver.assetExts.push('tflite');

module.exports = config;
