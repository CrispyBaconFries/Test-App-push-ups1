/**
 * Pins the Gradle Daemon's JVM to whatever JAVA_HOME the developer already has set at
 * `expo prebuild` time, by writing it into android/gradle.properties as
 * `org.gradle.java.home`. That file is regenerated from scratch on every prebuild (see
 * withReleaseSigning.js for the general pattern), so a manual edit there - as opposed to
 * this plugin - gets silently wiped the next time someone runs `expo prebuild --clean`.
 *
 * Why this matters: on Windows, AGP's Prefab packaging step (used by react-native-
 * worklets, react-native-worklets-core, react-native-nitro-modules, react-native-screens,
 * @shopify/react-native-skia) has a bug where it treats ANY line a subprocess prints
 * starting with "WARNING:" as a fatal build error. JDK 22+ prints exactly such a line
 * ("WARNING: A restricted method in java.lang.System has been called") for native-library
 * loading unless `--enable-native-access` is passed - so on a machine whose ambient
 * JAVA_HOME/PATH resolves to a JDK newer than 21 (e.g. the JBR bundled with a recent
 * Android Studio), `configureCMakeDebug[arm64-v8a]` fails for every one of those modules
 * with a useless "WARNING: A restricted method..." error and no real stack trace.
 * Confirmed on a real device: forcing the Gradle daemon onto JDK 17 (Google's own
 * recommended JDK for the current Android Gradle Plugin) makes the failure disappear
 * completely, because JDK 17 predates that warning entirely.
 *
 * This only takes over org.gradle.java.home when JAVA_HOME is actually set in the shell
 * running `expo prebuild` - if it's empty, gradle.properties is left as Expo generates it
 * so this can't break a machine that has no JAVA_HOME at all. It also appends
 * `--enable-native-access=ALL-UNNAMED` to org.gradle.jvmargs as a second line of defense,
 * in case a future dependency bump ever runs on a newer JDK again.
 *
 * See README.md "Native Android-Build" / the JAVA_HOME setup instructions for how to set
 * JAVA_HOME to a JDK 17 install in the first place.
 */
const { withGradleProperties } = require('@expo/config-plugins');

const NATIVE_ACCESS_FLAG = '--enable-native-access=ALL-UNNAMED';
const JAVA_HOME_PIN_COMMENT =
  "Pinned by plugins/withGradleJavaHome.js from this machine's JAVA_HOME env var at " +
  '`expo prebuild` time - see that file for why.';

module.exports = function withGradleJavaHome(config) {
  return withGradleProperties(config, (modConfig) => {
    const props = modConfig.modResults;

    const javaHome = process.env.JAVA_HOME && process.env.JAVA_HOME.trim();
    if (javaHome) {
      // Java .properties files treat backslashes as escape characters - forward slashes
      // are parsed correctly by the JVM on Windows too, so normalize to those.
      const normalizedJavaHome = javaHome.replace(/\\/g, '/');
      const existingIndex = props.findIndex((item) => item.type === 'property' && item.key === 'org.gradle.java.home');
      const propertyItem = { type: 'property', key: 'org.gradle.java.home', value: normalizedJavaHome };
      if (existingIndex >= 0) {
        props[existingIndex] = propertyItem;
      } else {
        props.push({ type: 'comment', value: JAVA_HOME_PIN_COMMENT });
        props.push(propertyItem);
      }
    } else {
      console.warn(
        '[withGradleJavaHome] JAVA_HOME ist in dieser Shell nicht gesetzt - org.gradle.java.home wird nicht gepinnt. ' +
          'Falls der native Build mit "WARNING: A restricted method in java.lang.System has been called" fehlschlägt, ' +
          'JAVA_HOME auf eine JDK-17-Installation setzen und `expo prebuild` erneut ausführen.'
      );
    }

    const jvmargsIndex = props.findIndex((item) => item.type === 'property' && item.key === 'org.gradle.jvmargs');
    if (jvmargsIndex >= 0 && !props[jvmargsIndex].value.includes(NATIVE_ACCESS_FLAG)) {
      props[jvmargsIndex] = {
        ...props[jvmargsIndex],
        value: `${props[jvmargsIndex].value} ${NATIVE_ACCESS_FLAG}`,
      };
    }

    return modConfig;
  });
};
