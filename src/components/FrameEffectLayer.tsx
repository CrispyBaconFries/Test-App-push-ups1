import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import {
  cycleDurationMs,
  effectOpacity,
  haloRadius,
  particleCount,
  type EffectSettings,
  type FrameEffectId,
} from '../ranking/frameEffects';

/**
 * Zeichnet einen Rahmen-Effekt **hinter** einen Avatar (siehe `RankFrame`).
 *
 * # Wie animiert wird, und warum ausgerechnet so
 *
 * Alle Bewegung entsteht über `Animated` aus React Native mit `useNativeDriver: true` -
 * also ausschließlich über `transform` und `opacity` an gewöhnlichen Views. Die Formen
 * selbst (Flammenzunge, Blitz, Aura-Verlauf) sind **statisches** SVG.
 *
 * Der naheliegendere Weg wäre, die SVG-Pfade selbst zu animieren (Reanimated +
 * `useAnimatedProps`). Dagegen sprechen zwei Dinge: Es läuft nicht auf dem
 * Native-Treiber, hängt also am JS-Thread - ausgerechnet dort, wo bei dieser App schon
 * die Posenerkennung mitrechnet. Und es ist der fehleranfälligere Weg, den ich hier nicht
 * auf einem echten Gerät nachprüfen kann. Transform und Deckkraft auf dem Native-Treiber
 * laufen dagegen im UI-Thread weiter, selbst wenn JS gerade beschäftigt ist.
 *
 * Was das kostet: Eine Flamme kann ihre *Form* nicht verändern, nur Größe, Lage und
 * Deckkraft. Für züngelnde Flammen reicht das (mehrere Zungen mit versetzten Phasen), für
 * eine echte, sich verformende Flamme nicht - dafür wäre Lottie der richtige Weg, siehe
 * `docs/grafik-plan.md`.
 *
 * # Wie die Ebenen liegen
 *
 * Jeder Effekt sitzt in einer `Layer`: absolut positioniert, füllt den Elternknoten
 * (also die Box des Avatars) und zentriert seine Kinder. Damit ist der Mittelpunkt jedes
 * Effekts der Mittelpunkt des Avatars, ohne dass irgendwo Größen doppelt gepflegt werden
 * müssen - und weil die Ebene absolut liegt, verschiebt sie das Layout nicht.
 *
 * Kreisende Teilchen benutzen durchgehend dasselbe Muster: **ein quadratischer Kasten,
 * der sich dreht, mit dem Teilchen oben mittig**. Der Radius ist damit die halbe
 * Kastenbreite. Der naheliegende Weg (Teilchen um `translateY` verschieben und dann
 * drehen) tut nicht dasselbe - gedreht würde um den Mittelpunkt des *Teilchens*, nicht um
 * den des Avatars.
 */

export interface FrameEffectLayerProps {
  effectId: FrameEffectId;
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
function useLoop(durationMs: number, delayMs = 0): Animated.Value {
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
function breathe(loop: Animated.Value, from: number, to: number) {
  return loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [from, to, from] });
}

/** Feste, ungleichmäßig verteilte Phasen (goldener Schnitt) - besser als `Math.random()`, das bei jedem Render neu würfeln und die Teilchen umherspringen lassen würde. */
function phases(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i * 0.618) % 1);
}

/** Absolut liegende Ebene, die den Avatar füllt und ihre Kinder auf dessen Mittelpunkt zentriert. */
function Layer({ children }: { children: React.ReactNode }) {
  return (
    <View pointerEvents="none" style={styles.layer}>
      {children}
    </View>
  );
}

/** Ein Kasten, der sich um den Mittelpunkt dreht, mit seinem Inhalt oben mittig. Der Radius ist `radius`. */
function Orbit({ radius, loop, children }: { radius: number; loop: Animated.Value; children: React.ReactNode }) {
  const rotate = loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stacked,
        { width: radius * 2, height: radius * 2, justifyContent: 'flex-start' },
        { transform: [{ rotate }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function FrameEffectLayer({ effectId, settings, colors }: FrameEffectLayerProps) {
  switch (effectId) {
    case 'none':
      return null;
    case 'glow':
      return <GlowEffect settings={settings} colors={colors} />;
    case 'rotor':
      return <RotorEffect settings={settings} colors={colors} />;
    case 'sparks':
      return <SparksEffect settings={settings} colors={colors} />;
    case 'flames':
      return <FlamesEffect settings={settings} colors={colors} />;
    case 'lightning':
      return <LightningEffect settings={settings} colors={colors} />;
    case 'aura':
      return <AuraEffect settings={settings} colors={colors} />;
  }
}

type EffectProps = Omit<FrameEffectLayerProps, 'effectId'>;

/** Weicher Schein, der größer und kleiner wird. */
function GlowEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 3600, 900));
  const diameter = settings.size + haloRadius(settings.size, settings.intensity) * 2;

  return (
    <Layer>
      <Animated.View
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: colors[colors.length - 1],
          opacity: Animated.multiply(breathe(loop, 0.25, 0.6), effectOpacity(settings.intensity)),
          transform: [{ scale: breathe(loop, 0.94, 1.06) }],
        }}
      />
    </Layer>
  );
}

/** Ein heller Punkt, der einmal um den Ring wandert. */
function RotorEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 5000, 1200));
  const ring = settings.size + 16;
  const rotate = loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Layer>
      <Animated.View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          overflow: 'hidden',
          opacity: effectOpacity(settings.intensity),
          transform: [{ rotate }],
        }}
      >
        {/* Ein Verlauf von durchsichtig nach hell, der mitgedreht wird: Der helle Rand
            wandert damit um den Ring, ohne dass ein echter Kegelverlauf nötig wäre - den
            beherrscht react-native-svg auf Android nicht zuverlässig. */}
        <LinearGradient
          colors={['transparent', 'transparent', colors[0], '#FFFFFF']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Layer>
  );
}

/** Funken, die auf einer Kreisbahn um den Rahmen laufen. */
function SparksEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 3, 9);
  const radius = settings.size / 2 + 10;
  const baseDuration = cycleDurationMs(settings.speed, 6000, 1600);
  const dotSize = 4 + Math.round(settings.size / 24);
  const spread = useMemo(() => phases(count), [count]);
  const opacity = effectOpacity(settings.intensity);

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Spark
          key={i}
          durationMs={Math.round(baseDuration * (0.8 + phase * 0.5))}
          delayMs={Math.round(baseDuration * phase)}
          radius={radius}
          size={dotSize}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Spark({
  durationMs,
  delayMs,
  radius,
  size,
  color,
  opacity,
}: {
  durationMs: number;
  delayMs: number;
  radius: number;
  size: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  return (
    <Orbit radius={radius} loop={loop}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />
    </Orbit>
  );
}

/** Züngelnde Flammen rund um den Rahmen. */
function FlamesEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 3, 7);
  const baseDuration = cycleDurationMs(settings.speed, 1800, 500);
  const length = settings.size * 0.42;
  const radius = settings.size / 2 + length;
  const spread = useMemo(() => phases(count), [count]);
  const opacity = effectOpacity(settings.intensity);

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Flame
          key={i}
          // Gleichmäßig über den ganzen Kreis verteilt: Flammen nur unten sähen aus, als
          // stünde der Avatar auf einem Lagerfeuer - gemeint ist eine Aura aus Feuer.
          angleDeg={(360 * i) / count}
          durationMs={Math.round(baseDuration * (0.75 + phase * 0.6))}
          delayMs={Math.round(baseDuration * phase)}
          radius={radius}
          length={length}
          width={settings.size * 0.2}
          colors={colors}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Flame({
  angleDeg,
  durationMs,
  delayMs,
  radius,
  length,
  width,
  colors,
  opacity,
}: {
  angleDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
  length: number;
  width: number;
  colors: readonly string[];
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  const gradientId = `flame-${Math.round(radius)}-${Math.round(angleDeg)}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stacked,
        { width: radius * 2, height: radius * 2, alignItems: 'center' },
        { transform: [{ rotate: `${angleDeg}deg` }] },
      ]}
    >
      <Animated.View
        style={{
          opacity: Animated.multiply(breathe(loop, 0.35, 1), opacity),
          // Die Zunge wächst aus dem Ring heraus: Nur die Länge schwankt, nicht die
          // Breite - eine Flamme, die auch breiter wird, sieht nach Ballon aus. Der
          // Ursprung liegt unten, damit sie am Ring festgewachsen bleibt statt zu wandern.
          transform: [{ scaleY: breathe(loop, 0.55, 1.15) }],
          transformOrigin: 'center bottom',
        }}
      >
        <Svg width={width} height={length} viewBox="0 0 20 44">
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="80%" r="70%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="45%" stopColor={colors[0]} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={colors[colors.length - 1]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Tropfenform: unten breit und rund, oben zu einer Spitze auslaufend. */}
          <Path d="M10 0 C 15 14, 20 22, 20 30 A 10 10 0 0 1 0 30 C 0 22, 5 14, 10 0 Z" fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** Blitze, die kurz aufblitzen. */
function LightningEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 2, 5);
  const baseDuration = cycleDurationMs(settings.speed, 2600, 900);
  const length = settings.size * 0.5;
  const radius = settings.size / 2 + length;
  const spread = useMemo(() => phases(count), [count]);
  const opacity = effectOpacity(settings.intensity);

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Bolt
          key={i}
          angleDeg={(360 * i) / count + 18}
          durationMs={Math.round(baseDuration * (0.7 + phase * 0.8))}
          delayMs={Math.round(baseDuration * phase)}
          radius={radius}
          length={length}
          width={settings.size * 0.22}
          color={colors[0]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Bolt({
  angleDeg,
  durationMs,
  delayMs,
  radius,
  length,
  width,
  color,
  opacity,
}: {
  angleDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
  length: number;
  width: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  // Ein Blitz ist fast immer aus und nur ganz kurz an - deshalb kein "Atmen", sondern
  // eine Kennlinie, die nur in einem schmalen Fenster des Durchlaufs hochgeht, dort aber
  // zweimal: Ein einzelnes Aufleuchten wirkt wie ein Anzeigefehler, ein Doppelblitz wie
  // ein Blitz.
  const flash = loop.interpolate({
    inputRange: [0, 0.04, 0.08, 0.12, 0.2, 1],
    outputRange: [0, 1, 0.2, 0.9, 0, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stacked,
        { width: radius * 2, height: radius * 2, alignItems: 'center' },
        { transform: [{ rotate: `${angleDeg}deg` }] },
      ]}
    >
      <Animated.View style={{ opacity: Animated.multiply(flash, opacity) }}>
        <Svg width={width} height={length} viewBox="0 0 12 40">
          <Path
            d="M7 0 L1 18 L5 18 L3 40 L11 16 L6 16 Z"
            fill={color}
            stroke="#FFFFFF"
            strokeOpacity={0.7}
            strokeWidth={1}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** Große pulsierende Aura mit aufsteigenden Funken. */
function AuraEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 3200, 1100));
  const halo = haloRadius(settings.size, settings.intensity, 0.9);
  const box = settings.size + halo * 2;
  const count = particleCount(settings.intensity, 4, 10);
  const spread = useMemo(() => phases(count), [count]);
  const riseDuration = cycleDurationMs(settings.speed, 2400, 900);
  const opacity = effectOpacity(settings.intensity);

  return (
    <Layer>
      <Animated.View
        style={[
          styles.stacked,
          {
            opacity: Animated.multiply(breathe(loop, 0.45, 1), opacity),
            transform: [{ scale: breathe(loop, 0.9, 1.08) }],
          },
        ]}
      >
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id="auraFill" cx="50%" cy="50%" r="50%">
              <Stop offset="55%" stopColor={colors[0]} stopOpacity={0} />
              <Stop offset="72%" stopColor={colors[0]} stopOpacity={0.55} />
              <Stop offset="100%" stopColor={colors[colors.length - 1]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={box / 2} cy={box / 2} r={box / 2} fill="url(#auraFill)" />
        </Svg>
      </Animated.View>

      {spread.map((phase, i) => (
        <Riser
          key={i}
          durationMs={Math.round(riseDuration * (0.8 + phase * 0.5))}
          delayMs={Math.round(riseDuration * phase)}
          offsetX={(phase - 0.5) * settings.size * 0.8}
          travel={halo + settings.size * 0.5}
          size={3 + Math.round(settings.size / 30)}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Riser({
  durationMs,
  delayMs,
  offsetX,
  travel,
  size,
  color,
  opacity,
}: {
  durationMs: number;
  delayMs: number;
  offsetX: number;
  travel: number;
  size: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  const translateY = loop.interpolate({ inputRange: [0, 1], outputRange: [travel * 0.4, -travel] });
  // Am Anfang und am Ende unsichtbar: Ein Funke, der mitten in der Luft erscheint oder
  // verschwindet, verrät die Schleife sofort.
  const fade = loop.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.7, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stacked,
        {
          opacity: Animated.multiply(fade, opacity),
          transform: [{ translateX: offsetX }, { translateY }],
        },
      ]}
    >
      <View style={{ width: size, height: size * 2, borderRadius: size, backgroundColor: color }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  },
  /**
   * Mehrere Teilchen sollen übereinander in der Mitte liegen, nicht nebeneinander.
   * Ohne das würde die Ebene sie als Spalte untereinander setzen und der Mittelpunkt
   * jedes einzelnen läge woanders.
   */
  stacked: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
