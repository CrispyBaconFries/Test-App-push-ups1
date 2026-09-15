import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';
import { cycleDurationMs, effectOpacity, particleCount } from '../../ranking/frameEffects';
import {
  Layer,
  Spoke,
  SpinGroup,
  blink,
  breathe,
  effectStyles,
  phases,
  useLoop,
  type EffectProps,
} from './kit';

/**
 * Effekte aus **festen Formen** an festen Stellen - Splitter, Kristalle, Strahlen,
 * Lampen, eine Krone.
 *
 * Sie sitzen alle in einer `Spoke` (fester Winkel am Rand) statt in einer `Orbit`. Der
 * Unterschied ist der ganze Charakter: Ein Teilchen auf einer Bahn *zieht vorbei*, eine
 * Form an einer Speiche *ist da* und tut dort etwas. Die zweite Sorte liest sich als
 * Ornament, die erste als Bewegung - und der Katalog braucht beides, sonst sieht am Ende
 * alles nach kreisenden Punkten aus.
 *
 * Wo eine Gruppe als Ganzes rotiert, macht das `SpinGroup`: eine Animation für zwölf
 * Strahlen statt zwölf Animationen, die irgendwann auseinanderlaufen.
 */

/* ----------------------------------------------------------------- Splitter */

/** Scharfkantige Splitter, die vom Rahmen wegfliegen und verglühen. */
export function ShardsEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 5, 8);
  const base = cycleDurationMs(settings.speed, 3000, 1100);
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);
  const length = Math.max(6, Math.round(settings.size * 0.2));

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Shard
          key={i}
          // Jeder Splitter bekommt einen eigenen Winkel - ohne den lägen alle auf einem
          // Fleck übereinander und man sähe einen statt acht.
          angleDeg={(360 * i) / count + (phase - 0.5) * 16}
          durationMs={Math.round(base * (0.8 + phase * 0.5))}
          delayMs={Math.round(base * phase)}
          radius={settings.size / 2 + 4}
          travel={Math.round(settings.size * 0.3)}
          length={length}
          width={Math.max(2, Math.round(settings.size * 0.045))}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Shard({
  angleDeg,
  durationMs,
  delayMs,
  radius,
  travel,
  length,
  width,
  color,
  opacity,
}: {
  angleDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
  travel: number;
  length: number;
  width: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  // Negativ = nach außen: Der Inhalt einer Speiche sitzt oben am Kastenrand, "oben" ist
  // im gedrehten Kasten die Richtung vom Avatar weg.
  const translateY = loop.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] });
  const fade = loop.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 1, 0.5, 0] });

  return (
    <Spoke radius={radius} angleDeg={angleDeg}>
      <Animated.View
        style={{
          width,
          height: length,
          // Bewusst ohne runde Ecken: Das ist der optische Unterschied zu den Flammen,
          // die an denselben Stellen sitzen könnten.
          backgroundColor: color,
          opacity: Animated.multiply(fade, opacity),
          transform: [{ translateY }],
        }}
      />
    </Spoke>
  );
}

/* ---------------------------------------------------------------- Kristalle */

/** Ein Kranz aus Rauten, der sich langsam dreht und dabei atmet. */
export function CrystalsEffect({ settings, colors }: EffectProps) {
  const outer = useLoop(cycleDurationMs(settings.speed, 14000, 5000));
  const inner = useLoop(cycleDurationMs(settings.speed, 9000, 3400));
  const opacity = effectOpacity(settings.intensity);
  const outerRadius = settings.size / 2 + 10;
  const innerRadius = settings.size / 2 + 2;
  const gem = Math.max(4, Math.round(settings.size * 0.09));

  return (
    <Layer>
      <SpinGroup size={outerRadius * 2} loop={outer}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Spoke key={i} radius={outerRadius} angleDeg={(360 * i) / 6}>
            <Gem size={gem} color={colors[i % colors.length]} opacity={opacity} loop={outer} />
          </Spoke>
        ))}
      </SpinGroup>
      <SpinGroup size={innerRadius * 2} loop={inner} reverse>
        {[0, 1, 2].map((i) => (
          <Spoke key={i} radius={innerRadius} angleDeg={60 + (360 * i) / 3}>
            <Gem size={gem * 0.65} color={colors[colors.length - 1]} opacity={opacity * 0.8} loop={inner} />
          </Spoke>
        ))}
      </SpinGroup>
    </Layer>
  );
}

/** Eine Raute - ein um 45° gedrehtes Quadrat, damit ohne SVG auskommend. */
function Gem({
  size,
  color,
  opacity,
  loop,
}: {
  size: number;
  color: string;
  opacity: number;
  loop: Animated.Value;
}) {
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        opacity,
        // Die Eigendrehung um 45° macht aus dem Quadrat die Raute; das Atmen hängt an der
        // Schleife der Gruppe und kostet deshalb keine eigene Animation.
        transform: [{ rotate: '45deg' }, { scale: breathe(loop, 0.8, 1.15) }],
      }}
    />
  );
}

/* ----------------------------------------------------------------- Strahlen */

/** Ein Strahlenkranz, der sich langsam dreht - unterschiedlich lange Strahlen. */
export function RaysEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 16000, 5000));
  const pulse = useLoop(cycleDurationMs(settings.speed, 4000, 1600));
  const opacity = effectOpacity(settings.intensity);
  const count = 12;
  const long = Math.max(10, Math.round(settings.size * 0.38));
  const short = Math.round(long * 0.55);
  const radius = settings.size / 2 + long;

  return (
    <Layer>
      <SpinGroup size={radius * 2} loop={loop}>
        {Array.from({ length: count }, (_, i) => (
          <Spoke key={i} radius={radius} angleDeg={(360 * i) / count}>
            <Animated.View
              style={{
                width: Math.max(1, Math.round(settings.size * 0.016)),
                // Abwechselnd lang und kurz: Zwölf gleich lange Strahlen sehen aus wie
                // ein Zahnrad, nicht wie Licht.
                height: i % 2 === 0 ? long : short,
                backgroundColor: colors[i % colors.length],
                opacity: Animated.multiply(breathe(pulse, 0.35, 1), opacity),
              }}
            />
          </Spoke>
        ))}
      </SpinGroup>
    </Layer>
  );
}

/* -------------------------------------------------------------------- Strom */

/** Kurze Entladungen, die rund um den Rand knistern. */
export function ElectroEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 6, 10);
  const base = cycleDurationMs(settings.speed, 1800, 650);
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);

  return (
    <Layer>
      {spread.map((phase, i) => (
        <Arc
          key={i}
          angleDeg={(360 * i) / count + (phase - 0.5) * 14}
          // Sehr kurze, ungleich lange Takte: Gleichmäßiges Blinken liest sich als
          // Anzeigefehler, ungleichmäßiges als Elektrizität.
          durationMs={Math.round(base * (0.6 + phase * 0.9))}
          delayMs={Math.round(base * phase)}
          radius={settings.size / 2 + 5}
          // Quer zur Speiche, also am Rand entlang - das unterscheidet den Effekt von den
          // Blitzen, die nach außen zeigen.
          length={Math.max(5, Math.round(settings.size * 0.16))}
          thickness={Math.max(2, Math.round(settings.size * 0.03))}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function Arc({
  angleDeg,
  durationMs,
  delayMs,
  radius,
  length,
  thickness,
  color,
  opacity,
}: {
  angleDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
  length: number;
  thickness: number;
  color: string;
  opacity: number;
}) {
  const loop = useLoop(durationMs, delayMs);
  return (
    <Spoke radius={radius} angleDeg={angleDeg}>
      <Animated.View
        style={{
          width: length,
          height: thickness,
          backgroundColor: color,
          opacity: Animated.multiply(blink(loop, 0, 1, 0.12), opacity),
        }}
      />
    </Spoke>
  );
}

/* -------------------------------------------------------------- Wellenpunkte */

/** Punkte am Rand, durch die eine Welle nach außen und innen läuft. */
export function WavePointsEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 8, 10);
  const base = cycleDurationMs(settings.speed, 3600, 1300);
  const opacity = effectOpacity(settings.intensity);
  const radius = settings.size / 2 + 12;
  const dot = Math.max(3, Math.round(settings.size * 0.045));

  return (
    <Layer>
      {Array.from({ length: count }, (_, i) => (
        <WaveDot
          key={i}
          angleDeg={(360 * i) / count}
          durationMs={base}
          // Der Versatz erzeugt die Welle: Jeder Punkt ist ein Stück später dran als sein
          // Nachbar, und genau das liest das Auge als Wanderung.
          delayMs={Math.round((base / count) * i)}
          radius={radius}
          amplitude={Math.round(settings.size * 0.12)}
          size={dot}
          color={colors[i % colors.length]}
          opacity={opacity}
        />
      ))}
    </Layer>
  );
}

function WaveDot({
  angleDeg,
  durationMs,
  delayMs,
  radius,
  amplitude,
  size,
  color,
  opacity,
}: {
  angleDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
  amplitude: number;
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
          opacity,
          transform: [{ translateY: breathe(loop, amplitude, -amplitude) }, { scale: breathe(loop, 0.7, 1.2) }],
        }}
      />
    </Spoke>
  );
}

/* --------------------------------------------------------------------- Krone */

/** Eine leuchtende Krone über dem Avatar. */
export function CrownEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 3600, 1500));
  const opacity = effectOpacity(settings.intensity);
  const spikeWidth = Math.max(3, Math.round(settings.size * 0.07));
  const gap = Math.round(settings.size * 0.115);
  const lift = settings.size * 0.58;
  // Mitte am höchsten, nach außen kürzer - gleich hohe Zacken sehen aus wie ein Kamm.
  const heights = [0.6, 0.85, 1, 0.85, 0.6];

  const bandHeight = Math.max(2, Math.round(settings.size * 0.035));

  return (
    <Layer>
      {heights.map((factor, i) => {
        const height = Math.max(6, Math.round(settings.size * 0.24 * factor));
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              effectStyles.stacked,
              {
                // `stacked` zentriert sein Kind, `translateY` verschiebt also dessen
                // *Mitte*. Damit alle fünf Zacken trotz unterschiedlicher Höhe auf
                // derselben Linie stehen, muss die halbe Höhe mit hinein - sonst hängen
                // die kurzen Zacken in der Luft und die langen ragen in den Avatar.
                transform: [{ translateX: (i - 2) * gap }, { translateY: -lift - height / 2 }],
              },
            ]}
          >
            <Animated.View
              style={{
                width: spikeWidth,
                height,
                backgroundColor: colors[i % colors.length],
                borderTopLeftRadius: spikeWidth / 2,
                borderTopRightRadius: spikeWidth / 2,
                opacity: Animated.multiply(breathe(loop, 0.55, 1), opacity),
                // Wächst nach oben statt in beide Richtungen - sonst löst sich die Zacke
                // beim Atmen vom Reif darunter.
                transform: [{ scaleY: breathe(loop, 0.88, 1.08) }],
                transformOrigin: 'center bottom',
              }}
            />
          </View>
        );
      })}
      {/* Der Reif, auf dem die Zacken stehen: seine Oberkante liegt genau auf der Linie,
          auf der alle Zacken enden. Unbewegt, damit die Krone nicht schwebt. */}
      <View
        pointerEvents="none"
        style={[
          effectStyles.stacked,
          {
            width: gap * 4 + spikeWidth,
            height: bandHeight,
            borderRadius: bandHeight / 2,
            backgroundColor: colors[0],
            opacity,
            transform: [{ translateY: -lift + bandHeight / 2 }],
          },
        ]}
      />
    </Layer>
  );
}
