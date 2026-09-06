module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required by react-native-vision-camera's frame processors, used by
      // react-native-mediapipe to run pose detection on the camera thread.
      'react-native-worklets-core/plugin',
      // Required by react-native-reanimated (used by vision-camera's Skia frame
      // processor on-screen rendering, see BossFightScreen's person-segmentation
      // compositing) - must be listed last per Reanimated's own docs. Reanimated
      // 4.x's own babel plugin is just a thin re-export of
      // 'react-native-worklets/plugin' (the new package Reanimated 4 depends on),
      // so this entry still works unchanged after the 3.19.1 -> 4.6.0 upgrade.
      'react-native-reanimated/plugin',
    ],
  };
};
