import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';
import { cycleDurationMs, effectOpacity, haloRadius, particleCount } from '../../ranking/frameEffects';
import {
  Layer,
  Orbit,
  Spoke,
  blink,
  breathe,
  edgeRadius,
  effectStyles,
  phases,
  useLoop,
  type EffectProps,
} from './kit';

/**
 * Effekte, die aus **Ringen und Flächen** bestehen statt aus einzelnen Teilchen.
 *
 * # Die Falle, die hier lauert
 *
 * Ein gleichfarbiger Kreisrand, der sich dreht, sieht aus wie ein Kreisrand, der steht.
 * Drehung wird nur dann sichtbar, wenn der Ring irgendwo *anders* ist als anderswo - eine
 * Lücke (`BrokenRing`), verschiedene Seitenfarben (`Prism`) oder ein Zeiger (`Radar`).
 * Ein „rotierender Ring" ohne eines dieser drei Merkmale ist ein toter Effekt, der im
 * Katalog Platz belegt.
 *
 * Deshalb bewegt sich hier, wo es geht, die *Größe* und die *Deckkraft* statt des Winkels.
 *
 * # Und die Falle daneben
 *
 * Ein Ring, der kleiner ist als Avatar plus Rang-Ring, liegt vollständig **hinter** dem
 * Avatar. Er läuft, man sieht ihn nur nie. Jeder Ring hier geht deshalb von `edgeRadius`
 * aus, nicht von `settings.size / 2` plus einer geratenen Handvoll Pixel.
 */

/** Ein unbewegter Kreisrand - kostet keine Animation und gibt den anderen Halt. */
function RingOutline({
  diameter,
  thickness,
  color,
  opacity,
}: {
  diameter: number;
  thickness: number;
  color: string;
  opacity: number;
}) {
  return (
    <View
      style={[
        effectStyles.stacked,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderWidth: thickness,
          borderColor: color,
          opacity,
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------- Radar */

/** Ein Zeiger mit Nachleuchten, der wie ein Radarschirm umläuft. */
export function RadarEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 4200, 1300));
  const opacity = effectOpacity(settings.intensity);
  const blades = 6;
  // Der Zeiger streicht AUSSEN am Rahmen entlang. Vorher reichte er vom Rand bis in die
  // Mitte - und damit lagen neunzig Prozent davon hinter dem Avatar.
  const sweep = Math.max(10, Math.round(settings.size * 0.3));
  const radius = edgeRadius(settings.size) + sweep;

  // Alle Zeiger hängen an **einer** Schleife und stehen über `offsetDeg` fächerförmig
  // hintereinander. Eine Schleife für den ganzen Fächer - und der Fächer kann nicht
  // auseinanderlaufen, wie er es mit sechs eigenen Schleifen irgendwann täte.
  return (
    <Layer>
      <RingOutline diameter={radius * 2} thickness={1} color={colors[0]} opacity={opacity * 0.25} />
      {Array.from({ length: blades }, (_, i) => (
        <Orbit key={i} radius={radius} loop={loop} offsetDeg={-i * 7}>
          <View
            style={{
              width: Math.max(1, Math.round(settings.size * 0.02)),
              // Nur so lang wie der Streifen außerhalb des Avatars: Der Inhalt einer
              // Bahn sitzt oben am Kastenrand, der Zeiger reicht damit von außen bis
              // genau an den Ring heran.
              height: sweep,
              backgroundColor: colors[0],
              opacity: opacity * (1 - i * 0.15),
            }}
          />
        </Orbit>
      ))}
    </Layer>
  );
}

/* ----------------------------------------------------------------- Implosion */

/** Ringe, die von außen auf den Avatar zusammenfallen. */
export function ImplosionEffect({ settings, colors }: EffectProps) {
  const base = cycleDurationMs(settings.speed, 3200, 1200);
  const opacity = effectOpacity(settings.intensity);
  // Maßstab 1 liegt genau auf dem Rand - alles darunter wäre vom Avatar verdeckt.
  const diameter = edgeRadius(settings.size) * 2;

  return (
    <Layer>
      {[0, 1, 2].map((i) => (
        <PulseRing
          key={i}
          durationMs={base}
          // Gleichmäßig über den Durchlauf verteilt: Ohne Versatz lägen alle drei Ringe
          // exakt übereinander, und man sähe einen statt dreier Wellen.
          delayMs={Math.round((base / 3) * i)}
          diameter={diameter}
          thickness={Math.max(1, Math.round(settings.size * 0.022))}
          color={colors[i % colors.length]}
          opacity={opacity}
          from={1.9}
          to={1}
        />
      ))}
    </Layer>
  );
}

/* ----------------------------------------------------------------- Druckwelle */

/** Ringe, die vom Avatar nach außen laufen. */
export function ShockwaveEffect({ settings, colors }: EffectProps) {
  const base = cycleDurationMs(settings.speed, 3000, 1100);
  const opacity = effectOpacity(settings.intensity);
  const diameter = edgeRadius(settings.size) * 2;

  return (
    <Layer>
      {[0, 1, 2].map((i) => (
        <PulseRing
          key={i}
          durationMs={base}
          delayMs={Math.round((base / 3) * i)}
          diameter={diameter}
          thickness={Math.max(1, Math.round(settings.size * 0.026))}
          color={colors[i % colors.length]}
          opacity={opacity}
          from={1}
          to={2}
        />
      ))}
    </Layer>
  );
}

/** Ein Ring, der über einen Durchlauf von `from` auf `to` skaliert und dabei verblasst. */
function PulseRing({
  durationMs,
  delayMs,
  diameter,
  thickness,
  color,
  opacity,
  from,
  to,
}: {
  durationMs: number;
  delayMs: number;
  diameter: number;
  thickness: number;
  color: string;
  opacity: number;
  from: number;
  to: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  const scale = loop.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  // Vorn und hinten auf null: Ein Ring, der mitten im Bild erscheint oder verschwindet,
  // verrät den Rücksprung der Schleife sofort.
  const fade = loop.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.45, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        effectStyles.stacked,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderWidth: thickness,
          borderColor: color,
          opacity: Animated.multiply(fade, opacity),
          transform: [{ scale }],
        },
      ]}
    />
  );
}

/* -------------------------------------------------------------------- Prisma */

/** Ein Ring, dessen Seiten verschiedene Farben haben und sich dreht. */
export function PrismEffect({ settings, colors }: EffectProps) {
  const outer = useLoop(cycleDurationMs(settings.speed, 8000, 2600));
  const inner = useLoop(cycleDurationMs(settings.speed, 11000, 3800));
  const opacity = effectOpacity(settings.intensity);
  const innerSize = edgeRadius(settings.size) * 2;
  const outerSize = innerSize + Math.round(settings.size * 0.16);
  const last = colors[colors.length - 1];

  // Vier verschiedene Seitenfarben sind hier keine Deko, sondern die Voraussetzung dafür,
  // dass man die Drehung überhaupt sieht (siehe Kopfkommentar).
  const rotate = (loop: Animated.Value, reverse: boolean) =>
    loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', reverse ? '-360deg' : '360deg'] });

  return (
    <Layer>
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderWidth: Math.max(2, Math.round(settings.size * 0.03)),
            borderTopColor: colors[0],
            borderRightColor: colors[1],
            borderBottomColor: last,
            borderLeftColor: colors[1],
            opacity,
            transform: [{ rotate: rotate(outer, false) }],
          },
        ]}
      />
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            borderWidth: Math.max(1, Math.round(settings.size * 0.018)),
            borderTopColor: last,
            borderRightColor: 'transparent',
            borderBottomColor: colors[0],
            borderLeftColor: 'transparent',
            opacity: opacity * 0.85,
            transform: [{ rotate: rotate(inner, true) }],
          },
        ]}
      />
    </Layer>
  );
}

/* ------------------------------------------------------------ Gebrochener Ring */

/** Zwei Ringe mit wandernder Lücke, gegenläufig. */
export function BrokenRingEffect({ settings, colors }: EffectProps) {
  const outer = useLoop(cycleDurationMs(settings.speed, 6000, 2000));
  const inner = useLoop(cycleDurationMs(settings.speed, 8200, 2900));
  const opacity = effectOpacity(settings.intensity);
  const innerSize = edgeRadius(settings.size) * 2;
  const outerSize = innerSize + Math.round(settings.size * 0.18);

  const rotate = (loop: Animated.Value, reverse: boolean) =>
    loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', reverse ? '-360deg' : '360deg'] });

  return (
    <Layer>
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderWidth: Math.max(2, Math.round(settings.size * 0.035)),
            borderColor: colors[0],
            // Die Lücke: Ohne sie wäre die Drehung eines gleichfarbigen Rings unsichtbar.
            borderLeftColor: 'transparent',
            opacity,
            transform: [{ rotate: rotate(outer, false) }],
          },
        ]}
      />
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            borderWidth: Math.max(1, Math.round(settings.size * 0.022)),
            borderColor: colors[colors.length - 1],
            borderRightColor: 'transparent',
            opacity: opacity * 0.8,
            transform: [{ rotate: rotate(inner, true) }],
          },
        ]}
      />
    </Layer>
  );
}

/* --------------------------------------------------------------------- Neon */

/** Eine Leuchtröhre, die unruhig flackert. */
export function NeonEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 2600, 900));
  const opacity = effectOpacity(settings.intensity);
  const innerSize = edgeRadius(settings.size) * 2;
  const outerSize = innerSize + Math.round(settings.size * 0.12);

  // Die Kennlinie steigt durchgehend - ein `% 1` irgendwo darin würde React Native beim
  // Rendern werfen (siehe kit.tsx). Das Flackern kommt aus den Ausgabewerten, nicht aus
  // einer verschobenen Eingabe.
  const flicker = loop.interpolate({
    inputRange: [0, 0.03, 0.06, 0.09, 0.12, 0.48, 0.51, 0.54, 1],
    outputRange: [1, 0.2, 1, 0.3, 1, 1, 0.15, 1, 1],
  });

  return (
    <Layer>
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderWidth: Math.max(2, Math.round(settings.size * 0.05)),
            borderColor: colors[0],
            // Deckkraft und Flackern gehen beide aus der Stärke hervor - ein Regler, der
            // an einem Effekt nichts tut, ist ein kaputter Regler.
            opacity: Animated.multiply(flicker, opacity * 0.45),
          },
        ]}
      />
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            borderWidth: Math.max(1, Math.round(settings.size * 0.018)),
            borderColor: '#FFFFFF',
            opacity: Animated.multiply(flicker, opacity),
          },
        ]}
      />
    </Layer>
  );
}

/* ------------------------------------------------------------------ Lauflicht */

/** Lampen rund um den Rahmen, die der Reihe nach anspringen. */
export function MarqueeEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 8, 12);
  const base = cycleDurationMs(settings.speed, 2800, 900);
  const opacity = effectOpacity(settings.intensity);
  const bulb = Math.max(3, Math.round(settings.size * 0.05));
  const radius = edgeRadius(settings.size, bulb / 2);

  return (
    <Layer>
      <RingOutline diameter={radius * 2} thickness={1} color={colors[0]} opacity={opacity * 0.15} />
      {Array.from({ length: count }, (_, i) => (
        <Bulb
          key={i}
          angleDeg={(360 * i) / count}
          durationMs={base}
          // Der Reihe nach - und zwar über den Versatz der Schleife, nicht über eine
          // verschobene Kennlinie. Das ist der Unterschied zwischen "läuft" und "wirft".
          delayMs={Math.round((base / count) * i)}
          radius={radius}
          size={bulb}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Bulb({
  angleDeg,
  durationMs,
  delayMs,
  radius,
  size,
  color,
  opacity,
}: {
  angleDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
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
          opacity: Animated.multiply(blink(loop, 0.12, 1, 0.3), opacity),
        }}
      />
    </Spoke>
  );
}

/* ----------------------------------------------------------------- Herzschlag */

/** Ein Ring, der im Doppelschlag pocht. */
export function HeartbeatEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 2200, 800));
  const opacity = effectOpacity(settings.intensity);
  const ring = edgeRadius(settings.size) * 2;
  const halo = ring + haloRadius(settings.size, settings.intensity, 0.5) * 2;

  // "lub-dub": zwei ungleiche Schläge kurz hintereinander, dann Ruhe. Ein einzelnes,
  // gleichmäßiges Pulsieren gibt es schon als "Leuchten" - das hier muss sich davon
  // hörbar unterscheiden, sonst ist es derselbe Effekt in Grün.
  const beat = loop.interpolate({
    inputRange: [0, 0.07, 0.14, 0.22, 0.32, 1],
    outputRange: [1, 1.14, 1.03, 1.2, 1, 1],
  });
  const flash = loop.interpolate({
    inputRange: [0, 0.07, 0.14, 0.22, 0.32, 1],
    outputRange: [0.45, 1, 0.6, 1, 0.45, 0.45],
  });

  return (
    <Layer>
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            backgroundColor: colors[colors.length - 1],
            opacity: Animated.multiply(flash, opacity * 0.22),
            transform: [{ scale: beat }],
          },
        ]}
      />
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: Math.max(2, Math.round(settings.size * 0.03)),
            borderColor: colors[0],
            opacity: Animated.multiply(flash, opacity),
            transform: [{ scale: beat }],
          },
        ]}
      />
    </Layer>
  );
}

/* -------------------------------------------------------------------- Glut */

/** Eine ruhige, warme Glut mit einzelnen aufsteigenden Funken. */
export function EmberEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 6000, 2400));
  const count = particleCount(settings.intensity, 3, 5);
  const base = cycleDurationMs(settings.speed, 4200, 1800);
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);
  const rim = edgeRadius(settings.size);
  const core = rim * 2 + Math.round(settings.size * 0.12);

  // Der Kern war vorher `settings.size + 8` groß - also **kleiner** als Avatar plus Ring
  // und damit vollständig verdeckt. Er lief, man sah ihn nie. Jetzt beginnt er am Rand
  // und reicht darüber hinaus.
  return (
    <Layer>
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: core,
            height: core,
            borderRadius: core / 2,
            backgroundColor: colors[0],
            opacity: Animated.multiply(breathe(loop, 0.22, 0.5), opacity),
            transform: [{ scale: breathe(loop, 0.96, 1.06) }],
          },
        ]}
      />
      {/* Der heiße Saum direkt am Rahmen: Er gibt der Glut eine Kante, sonst ist sie nur
          ein weicher Fleck und damit nicht von "Leuchten" zu unterscheiden. */}
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: rim * 2,
            height: rim * 2,
            borderRadius: rim,
            borderWidth: Math.max(2, Math.round(settings.size * 0.03)),
            borderColor: colors[colors.length - 1],
            opacity: Animated.multiply(breathe(loop, 0.35, 0.9), opacity),
          },
        ]}
      />
      {spread.map((phase, i) => (
        <Ember
          key={i}
          durationMs={Math.round(base * (0.8 + phase * 0.7))}
          delayMs={Math.round(base * phase)}
          // Breit genug gestreut, dass die Funken seitlich **neben** dem Avatar
          // aufsteigen statt hinter ihm.
          offsetX={(phase - 0.5) * settings.size * 1.5}
          travel={settings.size * 0.95}
          size={Math.max(3, Math.round(settings.size * 0.042))}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Ember({
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
  const translateY = loop.interpolate({ inputRange: [0, 1], outputRange: [travel * 0.5, -travel] });
  const fade = loop.interpolate({ inputRange: [0, 0.2, 0.65, 1], outputRange: [0, 1, 0.5, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        effectStyles.stacked,
        { opacity: Animated.multiply(fade, opacity), transform: [{ translateX: offsetX }, { translateY }] },
      ]}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </Animated.View>
  );
}

/* -------------------------------------------------------------------- Rauch */

/** Große weiche Schwaden, die langsam aufsteigen und vergehen. */
export function SmokeEffect({ settings, colors }: EffectProps) {
  const base = cycleDurationMs(settings.speed, 9000, 4000);
  const opacity = effectOpacity(settings.intensity);

  return (
    <Layer>
      {[0, 1, 2].map((i) => (
        <Puff
          key={i}
          durationMs={base}
          delayMs={Math.round((base / 3) * i)}
          // Am Rand gemessen und nicht an der Avatargröße: Eine Schwade von
          // `size * 1.15` ist bei dickem Ring kleiner als der Avatar und damit unsichtbar.
          diameter={edgeRadius(settings.size) * 2 * (1.15 + i * 0.15)}
          drift={settings.size * (i === 1 ? -0.2 : 0.2)}
          rise={settings.size * 0.55}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Puff({
  durationMs,
  delayMs,
  diameter,
  drift,
  rise,
  color,
  opacity,
}: {
  durationMs: number;
  delayMs: number;
  diameter: number;
  drift: number;
  rise: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  // Ein gleichfarbiger Kreis, der sich *dreht*, sieht aus wie ein Kreis, der steht. Rauch
  // entsteht deshalb aus Steigen, Wachsen und Vergehen - nicht aus einer Drehung.
  const translateY = loop.interpolate({ inputRange: [0, 1], outputRange: [rise * 0.35, -rise] });
  const translateX = loop.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const scale = loop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] });
  const fade = loop.interpolate({ inputRange: [0, 0.25, 0.6, 1], outputRange: [0, 1, 0.55, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        effectStyles.stacked,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: color,
          // 0,22 war zusammen mit mittlerer Stärke praktisch durchsichtig (0,575 × 0,22
          // = 0,13). Rauch darf weich sein, aber man muss ihn sehen.
          opacity: Animated.multiply(fade, opacity * 0.45),
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
}
