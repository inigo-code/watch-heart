// Android 11+ hides other apps unless you declare them. Where to watch opens these streaming apps by package
// name (src/lib/watchLinks.ts), so it declares exactly these, and nothing broader like QUERY_ALL_PACKAGES.
// Keep in sync with the list in src/lib/watchLinks.ts. The same approach as Prompt Heart's withAiAppQueries.
const { withAndroidManifest } = require('expo/config-plugins');

const PACKAGES = [
  'com.netflix.mediaclient',
  'com.amazon.avod.thirdpartyclient',
  'in.startv.hotstar',
  'com.graymatrix.did',
  'com.sonyliv',
  'com.apple.atve.androidtv.appletv',
  'com.google.android.youtube',
  'com.suntv.sunnxt',
  'ahaflix.tv',
  'com.viewlift.hoichoi',
  'com.crunchyroll.crunchyroid',
  'com.mubi',
  'com.erosnow',
  'com.mmtv.manoramamax.android',
  'com.mxtech.videoplayer.ad',
];

module.exports = function withStreamingQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.package = queries.package ?? [];
    for (const name of PACKAGES) {
      if (!queries.package.some((p) => p.$?.['android:name'] === name)) queries.package.push({ $: { 'android:name': name } });
    }
    return cfg;
  });
};
