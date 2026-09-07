/**
 * Beschränkt den Android-Build auf eine einzige CPU-Architektur (`arm64-v8a`).
 *
 * Warum das sinnvoll ist: Expos Vorgabe ist
 * `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`. `expo run:android`
 * überschreibt das beim **Debug**-Build mit der Architektur des angeschlossenen Geräts
 * (`-PreactNativeArchitectures=arm64-v8a`) - beim **Release**-Build nicht. Dort wurde
 * deshalb der komplette native Code viermal übersetzt. Mit dieser Beschränkung baut der
 * Release-Build nur noch ein Viertel davon: deutlich schneller, und die APK wird deutlich
 * kleiner.
 *
 * HISTORIE, damit es niemand noch einmal falsch herum aufrollt: Dieses Plugin entstand als
 * Behebungsversuch für
 *
 *   Execution failed for task ':react-native-vision-camera:buildCMakeRelWithDebInfo[arm64-v8a]'.
 *   > ninja: error: manifest 'build.ninja' still dirty after 100 tries
 *
 * unter der Annahme, die vier parallelen CMake-Läufe würden sich um dieselben
 * Prefab-Dateien von `react-native-worklets-core` streiten. Diese Annahme ist **widerlegt**:
 * Mit nur noch `arm64-v8a` im Log trat exakt derselbe Fehler weiter auf. Die tatsächliche
 * Ursache steht in `plugins/withCmakeSuppressRegeneration.js` und
 * `patches/react-native-worklets-core+1.6.3.patch`. Dieses Plugin bleibt trotzdem
 * bestehen - nicht als Fehlerbehebung, sondern wegen Bauzeit und APK-Größe.
 *
 * ACHTUNG für später: `arm64-v8a` deckt praktisch alle aktuellen Android-Geräte ab, aber
 * **keine Emulatoren** (die sind x86_64) und keine sehr alten 32-Bit-Geräte. Für eine
 * Play-Store-Veröffentlichung muss die Liste wieder verbreitert werden - dann aber als
 * `.aab`, das Google pro Gerät passend ausliefert. Siehe README, "Play-Store-Veröffentlichung".
 */
const { withGradleProperties } = require('@expo/config-plugins');

const KEY = 'reactNativeArchitectures';
const VALUE = 'arm64-v8a';
const COMMENT =
  'Auf eine Architektur beschraenkt durch plugins/withAndroidAbiFilter.js - siehe dort ' +
  'fuer den Grund (Release-Build von react-native-vision-camera bricht sonst ab).';

module.exports = function withAndroidAbiFilter(config) {
  return withGradleProperties(config, (modConfig) => {
    const props = modConfig.modResults;
    const index = props.findIndex((item) => item.type === 'property' && item.key === KEY);
    const property = { type: 'property', key: KEY, value: VALUE };

    if (index >= 0) {
      props[index] = property;
    } else {
      props.push({ type: 'comment', value: COMMENT });
      props.push(property);
    }
    return modConfig;
  });
};
