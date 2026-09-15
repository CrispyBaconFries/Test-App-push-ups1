import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';
import { cycleDurationMs, effectOpacity, particleCount } from '../../ranking/frameEffects';
import { Layer, Orbit, Spoke, breathe, effectStyles, phases, useLoop, type EffectProps } from './kit';

/**
 * Effekte, bei denen sich etwas **um den Avatar herum bewegt**.
 *
 * Gemeinsam ist ihnen der Baustein `Orbit` bzw. `Spoke` aus `kit.tsx` - nie eine selbst
 * zusammengesetzte Kreisbahn. Warum das keine Stilfrage ist, steht dort.
 *
 * Unterschieden werden sie bewusst über die *Art* der Bewegung, nicht über Farbe oder
 * Tempo: ein Schweif, zwei gegenläufige Paare, mehrere Bahnen, ein dichtes Band, Böen,
 * ein Sog nach innen, ein stilles Funkeln, ein Fall nach unten. Zwei Effekte, die man im
 * Standbild verwechseln kann, sind ein Effekt zu viel.
 */

/* ------------------------------------------------------------------ Komet */

/** Ein heller Kopf mit Schweif, der um den Rahmen jagt. */
export function CometEffect({ settings, colors }: EffectProps) {
  const durationMs = cycleDurationMs(settings.speed, 5200, 1500);
  const radius = settings.size / 2 + 10;
  const headSize = 5 + Math.round(settings.size / 20);
  const opacity = effectOpacity(settings.intensity);
  const parts = 5;

  return (
    <Layer>
      {Array.from({ length: parts }, (_, i) => (
        <CometPart
          key={i}
          durationMs={durationMs}
          // Kein eigener Takt, nur ein kleiner Rückstand: Dadurch bleibt der Schweif am
          // Kopf hängen, statt sich über die ganze Bahn zu verteilen.
          delayMs={Math.round(durationMs * 0.032 * i)}
          radius={radius}
          size={Math.max(2, Math.round(headSize * (1 - i * 0.15)))}
          color={i === 0 ? '#FFFFFF' : colors[0]}
          // Bleibt auch beim letzten Glied positiv - eine negative Deckkraft wäre still
          // kaputt: Man sähe nichts und suchte den Fehler woanders.
          opacity={opacity * (1 - i * 0.17)}
        />
      ))}
    </Layer>
  );
}

function CometPart({
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

/* ------------------------------------------------------------- Doppelrotor */

/** Zwei gegenläufige Paare, die sich auf unterschiedlichen Bahnen drehen. */
export function DoubleRotorEffect({ settings, colors }: EffectProps) {
  const outer = useLoop(cycleDurationMs(settings.speed, 4800, 1300));
  const inner = useLoop(cycleDurationMs(settings.speed, 6400, 1900));
  const opacity = effectOpacity(settings.intensity);
  const blade = Math.max(8, Math.round(settings.size * 0.22));
  const thick = Math.max(2, Math.round(settings.size * 0.035));

  // Beide Paare hängen an je einer Schleife und sind über `offsetDeg` gegenüber gesetzt -
  // zwei Animationen für vier Flügel, statt vier Schleifen, die auseinanderlaufen könnten.
  return (
    <Layer>
      {[0, 180].map((offsetDeg) => (
        <Orbit key={`aussen-${offsetDeg}`} radius={settings.size / 2 + 12} loop={outer} offsetDeg={offsetDeg}>
          <View
            style={{ width: blade, height: thick, borderRadius: thick / 2, backgroundColor: colors[0], opacity }}
          />
        </Orbit>
      ))}
      {[90, 270].map((offsetDeg) => (
        <Orbit key={`innen-${offsetDeg}`} radius={settings.size / 2 + 3} loop={inner} offsetDeg={offsetDeg} reverse>
          <View
            style={{
              width: Math.round(blade * 0.7),
              height: thick,
              borderRadius: thick / 2,
              backgroundColor: colors[colors.length - 1],
              opacity: opacity * 0.8,
            }}
          />
        </Orbit>
      ))}
    </Layer>
  );
}

/* ------------------------------------------------------------- Umlaufbahnen */

/** Drei Bahnen mit je einem Trabanten, jede in eigenem Tempo. */
export function OrbitRingsEffect({ settings, colors }: EffectProps) {
  const opacity = effectOpacity(settings.intensity);
  const base = cycleDurationMs(settings.speed, 7000, 2000);
  const gap = Math.max(5, Math.round(settings.size * 0.09));
  const dot = Math.max(3, Math.round(settings.size * 0.05));

  return (
    <Layer>
      {[0, 1, 2].map((i) => {
        const radius = settings.size / 2 + 6 + i * gap;
        return (
          <React.Fragment key={i}>
            {/* Die Bahn selbst, ganz schwach: Ohne sie sieht man drei Punkte, die
                zufällig herumirren - mit ihr sieht man ein System. Sie ist unbewegt und
                kostet deshalb keine Animation. */}
            <View
              style={[
                effectStyles.stacked,
                {
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                  borderWidth: 1,
                  borderColor: colors[i % colors.length],
                  opacity: opacity * 0.18,
                },
              ]}
            />
            <Satellite
              durationMs={Math.round(base * (0.7 + i * 0.35))}
              radius={radius}
              size={dot}
              color={colors[i % colors.length]}
              opacity={opacity}
              reverse={i === 1}
            />
          </React.Fragment>
        );
      })}
    </Layer>
  );
}

function Satellite({
  durationMs,
  radius,
  size,
  color,
  opacity,
  reverse,
}: {
  durationMs: number;
  radius: number;
  size: number;
  color: string;
  opacity: number;
  reverse: boolean;
}) {
  const loop = useLoop(durationMs);
  return (
    <Orbit radius={radius} loop={loop} reverse={reverse}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />
    </Orbit>
  );
}

/* -------------------------------------------------------------------- Helix */

/** Zwei gegenläufige Perlenbänder, deren Perlen vorn größer wirken als hinten. */
export function HelixEffect({ settings, colors }: EffectProps) {
  const durationMs = cycleDurationMs(settings.speed, 6500, 2200);
  const radius = settings.size / 2 + 9;
  const size = Math.max(3, Math.round(settings.size * 0.055));
  const opacity = effectOpacity(settings.intensity);
  const perBand = 4;

  return (
    <Layer>
      {[0, 1].map((band) =>
        Array.from({ length: perBand }, (_, i) => (
          <HelixBead
            key={`${band}-${i}`}
            durationMs={durationMs}
            // Gleichmäßig über die Bahn verteilt; das zweite Band um eine halbe Lücke
            // versetzt, damit sich die Bänder kreuzen statt zu überlagern.
            delayMs={Math.round((durationMs / perBand) * (i + (band === 1 ? 0.5 : 0)))}
            radius={radius}
            size={size}
            color={colors[band === 0 ? 0 : colors.length - 1]}
            opacity={opacity}
            reverse={band === 1}
          />
        ))
      )}
    </Layer>
  );
}

function HelixBead({
  durationMs,
  delayMs,
  radius,
  size,
  color,
  opacity,
  reverse,
}: {
  durationMs: number;
  delayMs: number;
  radius: number;
  size: number;
  color: string;
  opacity: number;
  reverse: boolean;
}) {
  const loop = useLoop(durationMs, delayMs);
  // Die Größe hängt an derselben Schleife wie die Bahn. Damit ist sie an den *Winkel*
  // gekoppelt: Jede Perle ist an derselben Stelle der Bahn groß und gegenüber klein -
  // genau das liest das Auge als "vorne" und "hinten".
  return (
    <Orbit radius={radius} loop={loop} reverse={reverse}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ scale: breathe(loop, 0.45, 1.35) }],
        }}
      />
    </Orbit>
  );
}

/* --------------------------------------------------------------- Sonnenwind */

/** Böen aus langgezogenen Streifen, die am Rahmen vorbeiziehen. */
export function SolarWindEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 4, 8);
  const base = cycleDurationMs(settings.speed, 3600, 1100);
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Gust
          key={i}
          durationMs={Math.round(base * (0.75 + phase * 0.5))}
          delayMs={Math.round(base * phase)}
          // Ungleiche Radien: Streifen auf einer einzigen Bahn lesen sich als Ring,
          // nicht als Wind.
          radius={settings.size / 2 + 6 + phase * settings.size * 0.18}
          length={settings.size * (0.22 + phase * 0.18)}
          thickness={Math.max(2, Math.round(settings.size * 0.028))}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Gust({
  durationMs,
  delayMs,
  radius,
  length,
  thickness,
  color,
  opacity,
}: {
  durationMs: number;
  delayMs: number;
  radius: number;
  length: number;
  thickness: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  // Am Anfang und Ende unsichtbar, sonst verrät der Sprung der Schleife die Bahn.
  const fade = loop.interpolate({ inputRange: [0, 0.18, 0.6, 1], outputRange: [0, 1, 0.55, 0] });
  return (
    <Orbit radius={radius} loop={loop}>
      <Animated.View
        style={{
          width: length,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          opacity: Animated.multiply(fade, opacity),
        }}
      />
    </Orbit>
  );
}

/* ---------------------------------------------------------------- Schwerkraft */

/** Teilchen, die von außen zum Avatar gezogen werden und dabei kleiner werden. */
export function GravityEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 6, 10);
  const base = cycleDurationMs(settings.speed, 3400, 1200);
  const radius = settings.size / 2 + Math.max(14, settings.size * 0.3);
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);
  const dot = Math.max(3, Math.round(settings.size * 0.035));

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Faller
          key={i}
          angleDeg={(360 * i) / count + (phase - 0.5) * 20}
          durationMs={Math.round(base * (0.8 + phase * 0.5))}
          delayMs={Math.round(base * phase)}
          radius={radius}
          travel={radius - settings.size / 2}
          size={dot}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Faller({
  angleDeg,
  durationMs,
  delayMs,
  radius,
  travel,
  size,
  color,
  opacity,
}: {
  angleDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
  travel: number;
  size: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  // Der Inhalt einer Speiche sitzt außen, positives `translateY` zieht ihn deshalb zum
  // Mittelpunkt. Die Drehung steckt in der Speiche, nicht in diesem Transform - sonst
  // drehte sich der Punkt um sich selbst und fiele auf einer Geraden.
  const translateY = loop.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const fade = loop.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 0.8, 0] });
  const shrink = loop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });

  return (
    <Spoke radius={radius} angleDeg={angleDeg}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: Animated.multiply(fade, opacity),
          transform: [{ translateY }, { scale: shrink }],
        }}
      />
    </Spoke>
  );
}

/* -------------------------------------------------------------- Sternenstaub */

/** Ein stilles Feld aus Funkeln in unterschiedlichen Abständen. */
export function StardustEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 7, 12);
  const base = cycleDurationMs(settings.speed, 4200, 1600);
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Twinkle
          key={i}
          angleDeg={(360 * i) / count + (phase - 0.5) * 26}
          // Ungleiche Abstände sind hier der ganze Punkt: Gleich weit entfernte Punkte
          // lesen sich als Perlenkette, nicht als Sternenstaub.
          radius={settings.size / 2 + 6 + phase * settings.size * 0.34}
          durationMs={Math.round(base * (0.6 + phase * 0.9))}
          delayMs={Math.round(base * phase)}
          size={Math.max(2, Math.round(settings.size * (0.018 + phase * 0.022)))}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Twinkle({
  angleDeg,
  radius,
  durationMs,
  delayMs,
  size,
  color,
  opacity,
}: {
  angleDeg: number;
  radius: number;
  durationMs: number;
  delayMs: number;
  size: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  return (
    <Spoke radius={radius} angleDeg={angleDeg}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: Animated.multiply(breathe(loop, 0.1, 1), opacity),
          transform: [{ scale: breathe(loop, 0.7, 1.25) }],
        }}
      />
    </Spoke>
  );
}

/* ---------------------------------------------------------------- Goldregen */

/** Glitzernde Tropfen, die am Rahmen vorbei nach unten fallen. */
export function GoldRainEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 6, 11);
  const base = cycleDurationMs(settings.speed, 3200, 1200);
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Drop
          key={i}
          durationMs={Math.round(base * (0.75 + phase * 0.6))}
          // Ohne Versatz fiele die ganze Reihe als eine waagerechte Linie herunter.
          delayMs={Math.round(base * phase)}
          offsetX={(phase - 0.5) * settings.size * 1.15}
          travel={settings.size * 0.85}
          size={Math.max(2, Math.round(settings.size * 0.026))}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Drop({
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
  const translateY = loop.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });
  const fade = loop.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.9, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        effectStyles.stacked,
        { opacity: Animated.multiply(fade, opacity), transform: [{ translateX: offsetX }, { translateY }] },
      ]}
    >
      <View style={{ width: size, height: size * 2.6, borderRadius: size, backgroundColor: color }} />
    </Animated.View>
  );
}
