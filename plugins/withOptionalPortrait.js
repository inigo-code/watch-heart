// The app is locked to portrait ("orientation" in app.json), and Android reads that as a need for a portrait
// screen: android.hardware.screen.portrait becomes a required feature, and Google Play hides the app from
// devices without one (some tablets, Chromebooks, Android XR) and blocks review over it. Watch Heart runs fine
// on any screen, so this declares the feature as optional.
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = ['android.hardware.screen.portrait'];

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = (manifest['uses-feature'] ?? []).filter((f) => !OPTIONAL.includes(f.$['android:name']));
    for (const name of OPTIONAL) {
      manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
