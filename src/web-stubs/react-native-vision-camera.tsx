/**
 * Attrappe für `react-native-vision-camera` in der Web-Vorschau (siehe README hier
 * daneben und `metro.config.js`).
 *
 * Das echte Paket wirft schon **beim Import** einen Fehler, sobald es im Browser landet
 * ("VisionCamera currently does not work on web") - nicht erst beim Benutzen. Die ganze
 * App bleibt dadurch weiß, auch auf Bildschirmen, die mit Kamera nichts zu tun haben.
 *
 * Die App benutzt aus diesem Paket ausschließlich `useCameraPermission`.
 */

/**
 * Meldet die Berechtigung als erteilt.
 *
 * Absicht: Die Kamera-Bildschirme sollen in der Vorschau ihre eigentliche Oberfläche
 * zeigen und nicht den "Bitte Kamerazugriff erlauben"-Zustand - genau die darüber
 * liegenden Anzeigen (Zähler, Form-Hinweis, Startpositions-Overlay) sind ja der Grund,
 * warum man sie sich am PC ansehen will.
 */
export function useCameraPermission(): { hasPermission: boolean; requestPermission: () => Promise<boolean> } {
  return {
    hasPermission: true,
    requestPermission: async () => true,
  };
}
