// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

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

module.exports = config;
