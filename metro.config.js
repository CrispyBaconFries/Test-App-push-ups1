// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-svg imports the Node core module "buffer" (src/utils/fetchData.ts,
// used to decode base64 data-URI SVGs) without declaring it as its own dependency.
// Metro treats bare "buffer" imports as a Node-builtin and refuses to resolve them
// unless explicitly aliased here to the installed browserify/buffer polyfill package.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Trailing slash forces resolution to the node_modules package instead of
  // Node's own built-in "buffer" core module (require.resolve('buffer') without
  // the slash would just return the core module id "buffer" again, unresolved).
  buffer: require.resolve('buffer/'),
};

/**
 * Native Pakete, die es im Browser nicht gibt - für die Web-Vorschau durch Attrappen
 * ersetzt (siehe `src/web-stubs/README.md`).
 *
 * Warum das nötig ist: `react-native-vision-camera` wirft schon **beim Import** einen
 * Fehler, sobald es im Browser landet ("VisionCamera currently does not work on web") -
 * nicht erst beim Benutzen. Ohne diese Umleitung bleibt die ganze Vorschau weiß, auch auf
 * Bildschirmen, die mit Kamera nichts zu tun haben.
 *
 * Betrifft ausschließlich `platform === 'web'`. Der Android- und iOS-Build sieht davon
 * nichts und benutzt weiterhin die echten Pakete.
 */
const WEB_STUBS = {
  'react-native-vision-camera': path.resolve(__dirname, 'src/web-stubs/react-native-vision-camera.tsx'),
  'react-native-mediapipe': path.resolve(__dirname, 'src/web-stubs/react-native-mediapipe.tsx'),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stub = platform === 'web' ? WEB_STUBS[moduleName] : undefined;
  if (stub) {
    return { type: 'sourceFile', filePath: stub };
  }
  // `context.resolveRequest` ist Metros eigener Auflöser. Ihn durchzureichen statt
  // `undefined` zurückzugeben ist wichtig: Sonst geht die weiter oben gesetzte
  // `buffer`-Umleitung verloren.
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
