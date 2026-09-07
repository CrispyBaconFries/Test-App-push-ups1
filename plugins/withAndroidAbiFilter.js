/**
 * Beschränkt den Android-Build auf eine einzige CPU-Architektur (`arm64-v8a`).
 *
 * Warum das nötig ist: Expos Vorgabe ist
 * `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`. `expo run:android`
 * überschreibt das beim **Debug**-Build mit der Architektur des angeschlossenen Geräts
 * (`-PreactNativeArchitectures=arm64-v8a`) - beim **Release**-Build nicht. Dort werden
 * deshalb alle vier Architekturen konfiguriert und gebaut, und react-native-vision-camera
 * bricht dabei reproduzierbar ab:
 *
 *   Execution failed for task ':react-native-vision-camera:buildCMakeRelWithDebInfo[arm64-v8a]'.
 *   > ninja: error: manifest 'build.ninja' still dirty after 100 tries
 *
 * Ursache ist ein Wettlauf: Die vier CMake-Konfigurationsläufe greifen parallel auf
 * dieselben Prefab-Dateien von `react-native-worklets-core` zu, die VisionCamera per
 * `find_package` einbindet. Deren Zeitstempel ändert sich dadurch fortlaufend, CMake
 * schreibt `build.ninja` aber inhaltsgleich und damit ohne neuen Zeitstempel zurück - also
 * hält ninja die Datei weiterhin für veraltet, ruft erneut CMake auf und gibt nach 100
 * Runden auf. Genau deshalb lief der Debug-Build durch und nur der Release-Build scheiterte.
 *
 * Nebeneffekt, der hier erwünscht ist: Der Build kompiliert nur noch ein Viertel des
 * nativen Codes und wird dadurch deutlich schneller, die APK deutlich kleiner.
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
