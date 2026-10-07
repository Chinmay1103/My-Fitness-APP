const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * Lets live heart rate keep running with the app in the background (the home-screen widget needs
 * that). react-native-background-actions runs a foreground service, and Android 14+ only allows one
 * for a Bluetooth device when the service says so in the manifest ("connectedDevice") and the app
 * holds the matching permission. The library's own manifest doesn't declare a type, so we add it.
 */
const SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
  'android.permission.POST_NOTIFICATIONS',
];

module.exports = function withLiveHeartRateService(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    AndroidConfig.Permissions.ensurePermissions(manifest, PERMISSIONS);
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== SERVICE);
    app.service.push({
      $: { 'android:name': SERVICE, 'android:exported': 'false', 'android:foregroundServiceType': 'connectedDevice' },
    });
    return mod;
  });
};
