import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

/**
 * Ein Schieberegler von 0 bis 1, komplett in JavaScript.
 *
 * Warum selbst gebaut: React Native bringt seit Jahren keinen Slider mehr mit, und
 * `@react-native-community/slider` wäre eine **native** Abhängigkeit - also `npm install`
 * plus `npx expo prebuild --clean` plus das Risiko einer neuen Gradle-Baustelle. Für
 * einen Regler in einem Entwickler-Bildschirm ist das der falsche Preis, und es widerspräche
 * genau der Begründung, mit der die Effekte selbst ohne neue Abhängigkeit auskommen (siehe
 * `docs/grafik-plan.md`).
 *
 * Die Umsetzung braucht nur die Breite der Bahn:
 * - **Antippen** springt an die Stelle (`locationX` liegt bereits relativ zur Bahn vor).
 * - **Ziehen** rechnet ab dem Antippwert weiter (`dx` geteilt durch die Breite). Damit ist
 *   keine Umrechnung von Bildschirm- in Element-Koordinaten nötig, die sonst bei jedem
 *   Scrollen der Seite falsch würde.
 */

export interface SliderProps {
  label: string;
  /** 0..1 */
  value: number;
  onChange: (value: number) => void;
  /** Was rechts neben dem Namen steht, z. B. "70 %" oder "96 px". */
  displayValue: string;
  /** Farbe des zurückgelegten Teils der Bahn. */
  tint?: string;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function Slider({ label, value, onChange, displayValue, tint = colors.primary }: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  // Refs statt State: Der PanResponder wird nur einmal erzeugt, sein Callback sähe sonst
  // dauerhaft die Werte vom ersten Render.
  const widthRef = useRef(0);
  const grantValueRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  widthRef.current = trackWidth;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Die Bahn liegt in einer ScrollView. Ohne das hier würde ein waagerechtes Ziehen
      // als Scrollversuch gedeutet und der Regler ließe sich nur antippen, nicht ziehen.
      onPanResponderTerminationRequest: () => false,
      onStartShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (event) => {
        const width = widthRef.current;
        if (width <= 0) return;
        const next = clamp01(event.nativeEvent.locationX / width);
        grantValueRef.current = next;
        onChangeRef.current(next);
      },
      onPanResponderMove: (_event, gesture) => {
        const width = widthRef.current;
        if (width <= 0) return;
        onChangeRef.current(clamp01(grantValueRef.current + gesture.dx / width));
      },
    })
  ).current;

  const handleLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const ratio = clamp01(value);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{displayValue}</Text>
      </View>
      {/* Der Berührungsbereich ist bewusst deutlich höher als die sichtbare Bahn - eine
          6 px hohe Trefferfläche wäre mit dem Daumen nicht bedienbar. */}
      <View style={styles.touchArea} onLayout={handleLayout} {...responder.panHandlers}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: tint }]} />
        </View>
        <View
          style={[
            styles.knob,
            { left: Math.max(0, trackWidth * ratio - KNOB_SIZE / 2), borderColor: tint },
          ]}
        />
      </View>
    </View>
  );
}

const KNOB_SIZE = 22;

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  value: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  touchArea: {
    height: 36,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  knob: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
  },
});
