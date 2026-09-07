/**
 * Schaltet CMakes „Build-System selbst nachgenerieren"-Regel in allen nativen
 * Android-Modulen ab (`-DCMAKE_SUPPRESS_REGENERATION=ON`).
 *
 * Warum das nötig ist: Der Release-Build brach reproduzierbar hier ab -
 *
 *   > Task :react-native-vision-camera:buildCMakeRelWithDebInfo[arm64-v8a] FAILED
 *   C/C++: ninja: error: manifest 'build.ninja' still dirty after 100 tries
 *
 * - während der Debug-Build desselben Codes durchlief.
 *
 * Mechanik dahinter: CMake schreibt in `build.ninja` eine Regel („RERUN_CMAKE"), mit der
 * ninja beim Start prüft, ob das Manifest noch aktuell ist. Ist irgendeine Eingabedatei
 * dieser Regel neuer als `build.ninja` - oder fehlt sie -, ruft ninja CMake erneut auf.
 * CMake schreibt Dateien aber nur, wenn sich ihr *Inhalt* ändert; bleibt der Inhalt
 * gleich, bleibt auch der Zeitstempel von `build.ninja` unverändert. Damit ist das
 * Manifest weiterhin „veraltet", ninja versucht es erneut - und gibt nach 100 Runden auf.
 * Genau das ist im Log an den hunderten Wiederholungen von „VisionCamera: Frame
 * Processors: ON! / VisionCamera: Linking react-native-worklets..." zu erkennen: CMake
 * lief 100-mal vollständig und fehlerfrei durch, ninja war trotzdem nie zufrieden.
 *
 * Auslöser im Release-Fall ist die Prefab-Konfiguration von react-native-worklets-core,
 * die react-native-vision-camera per `find_package` einbindet - siehe dazu
 * `patches/react-native-worklets-core+1.6.3.patch`, der die eigentliche Ursache behebt.
 * Diese Datei hier ist die zweite Verteidigungslinie: Ohne RERUN_CMAKE-Regel *kann*
 * ninja das Manifest gar nicht mehr für veraltet halten, egal welche Zeitstempel die
 * Prefab-Dateien tragen.
 *
 * Ist das gefährlich? Nein. Die Regel ist nur ein Sicherheitsnetz für den Fall, dass
 * jemand eine `CMakeLists.txt` ändert, ohne das Build-System neu zu konfigurieren. Genau
 * das übernimmt beim Android-Build aber ohnehin Gradle: Die Task `configureCMake<Variante>`
 * hat die CMake-Dateien als deklarierte Eingaben und ruft CMake neu auf, sobald sich eine
 * davon ändert. Die ninja-Regel ist hier also doppelt gemoppelt - und der doppelte Boden
 * ist derjenige, der einbricht.
 *
 * Nachgewiesen mit CMake selbst (Ninja-Generator): ohne die Option enthält `build.ninja`
 * eine RERUN_CMAKE-Regel, mit `-DCMAKE_SUPPRESS_REGENERATION=ON` keine mehr. Die Variable
 * gibt es seit CMake 3.12; das Android-NDK liefert 3.22 bzw. 3.31 mit.
 *
 * Warum als `subprojects { }`-Block im Projekt-`build.gradle` und nicht pro Modul: Die
 * betroffenen `build.gradle`-Dateien liegen in `node_modules/` und werden bei jedem
 * `npm install` überschrieben. Der Block hier gilt automatisch für jedes Android-Modul,
 * das CMake benutzt (VisionCamera, worklets-core, reanimated, screens, skia, expo-modules-core,
 * die App selbst) - inklusive später hinzukommender.
 *
 * Wichtig: `arguments(...)` *ergänzt* die Liste, es ersetzt sie nicht. Der Aufruf steht
 * bewusst direkt im `plugins.withId`-Callback (also unmittelbar nachdem das
 * Android-Gradle-Plugin angewandt wurde) und nicht in einem eigenen `afterEvaluate` -
 * AGP legt seine Varianten und damit die CMake-Tasks in seinem *eigenen*, früher
 * registrierten `afterEvaluate` an; ein späterer Block käme zu spät.
 */
const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '-DCMAKE_SUPPRESS_REGENERATION=ON';

const GRADLE_SNIPPET = `
// Added by plugins/withCmakeSuppressRegeneration.js - see that file for why.
// Removes CMake's "re-run myself" rule from the generated build.ninja, which otherwise
// deadlocks the release build with "ninja: error: manifest 'build.ninja' still dirty
// after 100 tries". Gradle's own configureCMake<Variant> task already reconfigures when
// a CMakeLists.txt changes, so nothing is lost.
subprojects { subproject ->
    ["com.android.application", "com.android.library"].each { pluginId ->
        subproject.plugins.withId(pluginId) {
            subproject.android.defaultConfig.externalNativeBuild.cmake.arguments "${MARKER}"
        }
    }
}
`;

module.exports = function withCmakeSuppressRegeneration(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error(
        `[withCmakeSuppressRegeneration] Expected a Groovy android/build.gradle, got "${modConfig.modResults.language}".`
      );
    }
    if (!modConfig.modResults.contents.includes(MARKER)) {
      modConfig.modResults.contents += GRADLE_SNIPPET;
    }
    return modConfig;
  });
};
