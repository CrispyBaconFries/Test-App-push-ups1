import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { EffectSettings } from '../../ranking/frameEffects';

/**
 * Das gemeinsame Handwerkszeug aller Rahmen-Effekte.
 *
 * # Warum es ein eigenes Modul ist
 *
 * Diese Helfer lagen ursprünglich modul-privat in `FrameEffectLayer.tsx`, weil es nur
 * sieben Effekte gab. Mit einunddreißig ginge diese Datei auf weit über tausend Zeilen -
 * und vor allem: Jeder neue Effekt, der die Helfer nicht kennt, baut sich seine eigene
 * Kreisbahn. Genau daraus sind beim ersten Anlauf reihenweise Effekte entstanden, deren
 * Teilchen oben links klebten statt auf einem Kreis zu liegen.
 *
 * Deshalb stehen die Regeln hier **einmal**, als benutzbare Bausteine:
 *
 * - `Layer` - die Ebene, auf der ein Effekt liegt.
 * - `Orbit` - etwas kreist um den Avatar.
 * - `Spoke` - etwas sitzt an einer festen Stelle am Rand.
 * - `SpinGroup` - eine ganze Gruppe dreht sich gemeinsam.
 * - `useLoop`, `breathe`, `phases` - Zeit, Pulsieren, Verteilung.
 *
 * # Die drei Fallen, die diese Bausteine abfangen
 *
 * **1. Drehen und Verschieben sind nicht vertauschbar.** In React Native wirkt der
 * *letzte* Eintrag in `transform` zuerst. `[{ translateY }, { rotate }]` dreht das
 * Teilchen also um seinen *eigenen* Mittelpunkt - bei einem runden Punkt sieht man davon
 * gar nichts, und alle Teilchen liegen auf einer Geraden statt auf einem Kreis. Richtig
 * ist ein quadratischer Kasten, der sich dreht, mit dem Teilchen oben mittig; der Radius
 * ist dann die halbe Kastenbreite. `Orbit` und `Spoke` machen genau das.
 *
 * **2. `Layer` zentriert per Flexbox, nicht per Stapel.** Ein Kind ohne
 * `position: 'absolute'` landet *unter* seinen Geschwistern statt über ihnen. Wer direkt
 * in eine `Layer` zeichnet, braucht `effectStyles.stacked`.
 *
 * **3. Eine Eingabe-Kennlinie muss steigen.** `inputRange` mit einer Rechnung wie
 * `(phase + 0.15) % 1` kippt bei hohen Phasen über die 1 und React Native wirft dann
 * beim Rendern. Der Versatz gehört deshalb in `useLoop(dauer, versatz)`, nicht in die
 * Kennlinie.
 */

export interface EffectProps {
  settings: EffectSettings;
  /** Farben des Rang-Rings bzw. des gekauften Themes - der Effekt nimmt sie mit. */
  colors: readonly [string, string, ...string[]];
}

/**
 * Ein Wert, der endlos von 0 nach 1 läuft.
 *
 * `Easing.linear` und nicht die Vorgabe: Bei Drehungen erzeugt jede andere Kennlinie ein
 * sichtbares Stocken an der Stelle, an der der Durchlauf von 1 wieder auf 0 springt.
 *
 * Der Versatz (`delayMs`) läuft über `setTimeout` und **nicht** über `Animated.delay`
 * innerhalb der Schleife: Dort würde er bei *jedem* Durchlauf erneut warten, aus dem
 * gleichmäßigen Kreisen würde ein Stottern. Gewollt ist eine einmalige Phasenverschiebung,
 * damit nicht alle Teilchen im Gleichschritt laufen.
 */
export function useLoop(durationMs: number, delayMs = 0): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    value.setValue(0);
    const timer = setTimeout(() => {
      animation = Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
    }, delayMs);
    return () => {
      clearTimeout(timer);
      animation?.stop();
    };
  }, [durationMs, delayMs, value]);
  return value;
}

/** Ein "Atmen": 0 → 1 → 0 über einen Durchlauf, für Pulsieren. */
export function breathe(loop: Animated.Value, from: number, to: number) {
  return loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [from, to, from] });
}

/**
 * Ein kurzes Aufleuchten einmal pro Durchlauf, sonst dunkel.
 *
 * Wann genau es aufleuchtet, steuert der Versatz von `useLoop` - **nicht** eine
 * verschobene Kennlinie. Der Unterschied ist kein Geschmack: Eine Kennlinie mit
 * `(phase + x) % 1` ist bei hohen Phasen nicht mehr steigend, und React Native wirft
 * dann beim Rendern.
 */
export function blink(loop: Animated.Value, low: number, high: number, widthOfPulse = 0.18) {
  const end = Math.min(0.9, widthOfPulse);
  return loop.interpolate({
    inputRange: [0, end / 2, end, 1],
    outputRange: [low, high, low, low],
  });
}

/** Feste, ungleichmäßig verteilte Phasen (goldener Schnitt) - besser als `Math.random()`, das bei jedem Render neu würfeln und die Teilchen umherspringen lassen würde. */
export function phases(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i * 0.618) % 1);
}

/** Absolut liegende Ebene, die den Avatar füllt und ihre Kinder auf dessen Mittelpunkt zentriert. */
export function Layer({ children }: { children: React.ReactNode }) {
  return (
    <View pointerEvents="none" style={effectStyles.layer}>
      {children}
    </View>
  );
}

/**
 * Ein Kasten, der sich um den Mittelpunkt dreht, mit seinem Inhalt oben mittig. Der
 * Radius ist `radius`.
 *
 * `offsetDeg` verschiebt die Startstelle auf der Bahn, ohne eine zweite Schleife zu
 * brauchen: Mehrere `Orbit`s an derselben `loop` laufen damit exakt im Verband, was für
 * Speichen, Perlenketten und gegenläufige Paare genau richtig ist.
 */
export function Orbit({
  radius,
  loop,
  offsetDeg = 0,
  reverse = false,
  children,
}: {
  radius: number;
  loop: Animated.Value;
  offsetDeg?: number;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  const turn = reverse ? -360 : 360;
  const rotate = loop.interpolate({
    inputRange: [0, 1],
    outputRange: [`${offsetDeg}deg`, `${offsetDeg + turn}deg`],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        effectStyles.stacked,
        { width: radius * 2, height: radius * 2, justifyContent: 'flex-start' },
        { transform: [{ rotate }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Wie `Orbit`, aber unbewegt: Der Inhalt sitzt fest bei `angleDeg` am Rand.
 *
 * Für alles, was *an Ort und Stelle* etwas tut - blinken, wachsen, ein- und ausatmen -
 * statt zu kreisen. Der Inhalt darf sich mit `translateY` nach innen schieben (positiv =
 * Richtung Mittelpunkt), weil er im gedrehten Kasten sitzt.
 */
export function Spoke({
  radius,
  angleDeg,
  children,
}: {
  radius: number;
  angleDeg: number;
  children: React.ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        effectStyles.stacked,
        { width: radius * 2, height: radius * 2, justifyContent: 'flex-start' },
        { transform: [{ rotate: `${angleDeg}deg` }] },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Dreht eine ganze Gruppe gemeinsam.
 *
 * Damit lässt sich ein festes Muster (mehrere `Spoke`s) als Ganzes in Bewegung setzen,
 * ohne dass jede Speiche eine eigene Schleife braucht - eine Animation statt zwölf.
 */
export function SpinGroup({
  size,
  loop,
  reverse = false,
  children,
}: {
  size: number;
  loop: Animated.Value;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  const rotate = loop.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', reverse ? '-360deg' : '360deg'],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[effectStyles.stacked, { width: size, height: size }, { transform: [{ rotate }] }]}
    >
      {children}
    </Animated.View>
  );
}

export const effectStyles = StyleSheet.create({
  /**
   * Füllt den Elternknoten (die Box des Avatars) und zentriert die Kinder darin.
   *
   * Bewusst mit allen vier Kanten auf 0 statt `StyleSheet.absoluteFillObject`: Letzteres
   * kennen die Typen dieses Projekts nicht (`types: ["jest"]` in tsconfig.json).
   */
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    /**
     * Der Effekt gehört HINTER den Avatar - ohne das legt er sich darüber und dämpft
     * Zahl und Foto.
     *
     * Warum es nicht reicht, ihn im JSX vor den Avatar zu schreiben: Auf dem Handy
     * entscheidet die Reihenfolge der Geschwister, im Browser aber nicht - dort malt CSS
     * jedes *positionierte* Element über seine statischen Geschwister, unabhängig von der
     * Reihenfolge. In der Web-Vorschau lag die Aura deshalb quer über der Zahl. `zIndex`
     * gilt auf beiden Plattformen und macht die Absicht außerdem ausdrücklich, statt sie
     * einer Reihenfolge im JSX zu überlassen, die jeder Umbau versehentlich dreht.
     */
    zIndex: -1,
  },
  stacked: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
