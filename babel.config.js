module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required by react-native-vision-camera's frame processors, used by
    // react-native-mediapipe to run pose detection on the camera thread.
    plugins: ['react-native-worklets-core/plugin'],
  };
};
