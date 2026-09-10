import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Attrappe für `react-native-mediapipe` in der Web-Vorschau (siehe README hier daneben
 * und `metro.config.js`).
 *
 * Exportiert genau das, was die App benutzt - nicht mehr. Alles Weitere würde eine
 * Funktionsfähigkeit vortäuschen, die es im Browser nicht gibt: Hier wird nichts erkannt
 * und nichts gezählt.
 *
 * Die Typen (`PoseDetectionOptions`, `PoseDetectionResultBundle`, ...) kommen weiterhin
 * aus dem echten Paket: TypeScript folgt der Umleitung in `metro.config.js` nicht, und
 * das ist gut so - die Attrappe kann damit nicht unbemerkt von der echten Schnittstelle
 * abweichen.
 */

export enum Delegate {
  CPU = 0,
  GPU = 1,
}

export enum RunningMode {
  IMAGE = 0,
  VIDEO = 1,
  LIVE_STREAM = 2,
}

/**
 * Liefert ein Lösungsobjekt mit den Feldern, die die Bildschirme lesen - aber ohne je
 * einen Frame zu melden. `cameraViewDimensions` bleibt bei 0×0, das Skelett-Overlay
 * zeichnet damit nichts.
 */
export function usePoseDetection(
  _callbacks: unknown,
  _runningMode: RunningMode,
  _model: string,
  _options?: unknown
): { cameraViewDimensions: { width: number; height: number } } {
  return { cameraViewDimensions: { width: 0, height: 0 } };
}

/**
 * Statt eines Kamerabildes eine ruhige dunkle Fläche mit Hinweis.
 *
 * Bewusst kein Standbild und kein Farbverlauf: Die Fläche ist der Hintergrund, vor dem
 * die eigentlich interessanten Anzeigen liegen (Zähler, Form-Hinweis,
 * Startpositions-Overlay). Alles, was hier bunt wäre, würde deren Kontrast verfälschen -
 * und genau den will man in der Vorschau beurteilen.
 */
export function MediapipeCamera({ style }: { style?: StyleProp<ViewStyle>; [key: string]: unknown }) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.text}>Kamera-Vorschau</Text>
      <Text style={styles.hint}>
        Im Browser gibt es keine Posenerkennung. Die Anzeigen darüber sind echt und lassen sich hier
        beurteilen – gezählt wird nur auf dem Handy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#14181D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
    lineHeight: 17,
  },
});
