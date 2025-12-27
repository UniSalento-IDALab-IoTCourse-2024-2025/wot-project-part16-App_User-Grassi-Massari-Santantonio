const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Configurazione per i polyfill di MQTT (Buffer, URL, Stream)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  url: require.resolve("url"),
};

module.exports = withNativeWind(config, { input: "./global.css" });