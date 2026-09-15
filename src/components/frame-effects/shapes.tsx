import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { cycleDurationMs, effectOpacity, particleCount } from '../../ranking/frameEffects';
import {
  Layer,
  Orbit,
  Spoke,
  SpinGroup,
  blink,
  breathe,
  edgeRadius,
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
          radius={edgeRadius(settings.size)}
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
  const gem = Math.max(4, Math.round(settings.size * 0.09));
  const innerRadius = edgeRadius(settings.size, gem / 2);
  const outerRadius = innerRadius + Math.round(settings.size * 0.14);

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
  const radius = edgeRadius(settings.size) + long;

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

/**
 * Feine Blitze, die rund um den Rahmen knistern - der Super-Saiyajin-2-Look.
 *
 * Vorlage sind die Beschreibungen der Form: **viele** dünne, zickzackförmige Funken, die
 * **ununterbrochen** um den Körper zucken, nicht ein paar große Blitze, die ab und zu
 * einschlagen. Genau daran hängen die drei Entscheidungen hier:
 *
 * - **Dünn und gezackt** statt breiter Balken: zwei gestrichelte Pfade übereinander, ein
 *   farbiger und ein weißer Kern darin. Das ist der Unterschied zwischen "Stromschlag"
 *   und "Lichtbalken".
 * - **Durchgehend**: Jeder Blitz leuchtet nur einen Wimpernschlag, aber die Takte sind so
 *   versetzt, dass sich die Fenster überlappen. Es ist immer irgendwo einer an.
 * - **Wandernd**: Alle Blitze hängen an *einer* langsamen Drehung. Weil jeder auf einem
 *   eigenen, schnellen Takt blitzt, schlägt er bei jedem Durchlauf an einer etwas anderen
 *   Stelle ein - ohne `Math.random()`, das bei jedem Render neu würfeln würde.
 *
 * Abgegrenzt gegen "Blitze": Das sind zwei bis fünf große, langsame Einschläge. Hier sind
 * es sechs bis neun kleine, schnelle - dieselbe Idee in einer anderen Tonlage.
 */
export function ElectroEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 6, 9);
  const base = cycleDurationMs(settings.speed, 1600, 600);
  // Sehr langsam: Die Drehung soll man nicht sehen, sie soll nur dafür sorgen, dass die
  // Einschläge nicht jedes Mal an derselben Stelle sitzen.
  const drift = useLoop(cycleDurationMs(settings.speed, 20000, 9000));
  const opacity = effectOpacity(settings.intensity);
  const spread = useMemo(() => phases(count), [count]);
  const rim = edgeRadius(settings.size);

  return (
    <Layer>
      {spread.map((phase, i) => {
        const length = Math.max(8, Math.round(settings.size * (0.15 + phase * 0.16)));
        return (
          <CrackleBolt
            key={i}
            drift={drift}
            offsetDeg={(360 * i) / count + (phase - 0.5) * 20}
            durationMs={Math.round(base * (0.7 + phase * 0.7))}
            // Gleichmäßig über den Takt verteilt: So überlappen sich die kurzen Fenster
            // zu einem durchgehenden Knistern statt zu vereinzeltem Blinken.
            delayMs={Math.round((base / count) * i)}
            radius={rim + length}
            length={length}
            width={Math.max(4, Math.round(settings.size * 0.08))}
            color={colors[i % colors.length]}
            opacity={opacity}
          />
        );
      })}
    </Layer>
  );
}

function CrackleBolt({
  drift,
  offsetDeg,
  durationMs,
  delayMs,
  radius,
  length,
  width,
  color,
  opacity,
}: {
  drift: Animated.Value;
  offsetDeg: number;
  durationMs: number;
  delayMs: number;
  radius: number;
  length: number;
  width: number;
  color: string;
  opacity: number;
}) {
  const flash = useLoop(durationMs, delayMs);
  // Zweimal kurz an, dann lange aus: Ein einzelnes Aufleuchten wirkt wie ein
  // Anzeigefehler, ein Doppelzucken wie Elektrizität.
  const glow = flash.interpolate({
    inputRange: [0, 0.04, 0.08, 0.12, 0.2, 1],
    outputRange: [0, 1, 0.25, 0.9, 0, 0],
  });
  const zigzag = 'M8 0 L3 11 L9 14 L2 29 L8 31 L4 44';

  return (
    <Orbit radius={radius} loop={drift} offsetDeg={offsetDeg}>
      <Animated.View style={{ opacity: Animated.multiply(glow, opacity) }}>
        <Svg width={width} height={length} viewBox="0 0 12 44">
          {/* Zwei Striche auf demselben Pfad: außen die Rangfarbe als Schein, innen ein
              dünner weißer Kern. Das ist die Zeichnung, an der man einen elektrischen
              Funken erkennt - eine einfarbige Linie sieht nach Strich aus. */}
          <Path
            d={zigzag}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={zigzag}
            stroke="#FFFFFF"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </Orbit>
  );
}

/* -------------------------------------------------------------- Wellenpunkte */

/** Punkte am Rand, durch die eine Welle nach außen und innen läuft. */
export function WavePointsEffect({ settings, colors }: EffectProps) {
  const count = particleCount(settings.intensity, 8, 10);
  const base = cycleDurationMs(settings.speed, 3600, 1300);
  const opacity = effectOpacity(settings.intensity);
  const dot = Math.max(3, Math.round(settings.size * 0.045));
  const amplitude = Math.round(settings.size * 0.12);
  // Der Ausschlag nach innen zählt mit: Sonst taucht die halbe Welle hinter dem Avatar ab.
  const radius = edgeRadius(settings.size, dot / 2) + amplitude;

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
          amplitude={amplitude}
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

/**
 * Eine leuchtende Krone über dem Avatar - **eine** Form, kein Bausatz.
 *
 * Erster Anlauf waren fünf Balken nebeneinander: las sich als Haare. Zweiter Anlauf waren
 * fünf Dreiecke auf einem Reif: sah aus wie zusammengestellte Einzelteile, und beim
 * Atmen gingen die Teile sichtbar auseinander - jedes Element wird für sich skaliert und
 * auf ganze Pixel gerundet, und zwischen zwei Nachbarn bleibt dabei ein Haarspalt stehen.
 *
 * Deshalb jetzt **ein einziger geschlossener SVG-Pfad**: Zacken und Reif sind dieselbe
 * Kontur, es gibt keine Naht, die aufgehen könnte. Das ist auch der Grund, warum die
 * Krone hier SVG benutzt und die übrigen Formen dieser Datei nicht - bei allen anderen
 * sind die Einzelteile *gewollt* einzeln.
 */
export function CrownEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 3600, 1500));
  const opacity = effectOpacity(settings.intensity);
  const width = Math.max(18, Math.round(settings.size * 0.8));
  const height = Math.round(width * 0.68);
  // Die Unterkante sitzt auf dem Rang-Ring auf, mit drei Pixeln Überlappung, damit die
  // Krone aufliegt statt zu schweben. Tiefer ginge nicht: Alles innerhalb von
  // `edgeRadius` verschwindet hinter dem Avatar - und der Reif wäre das Erste, was fehlt.
  const lift = edgeRadius(settings.size) - 3 + height / 2;

  return (
    <Layer>
      <Animated.View
        pointerEvents="none"
        style={[
          effectStyles.stacked,
          {
            opacity: Animated.multiply(breathe(loop, 0.7, 1), opacity),
            // Skaliert wird die ganze Krone auf einmal, nicht jede Zacke für sich -
            // genau daher kamen die Spalten.
            transform: [{ translateY: -lift }, { scale: breathe(loop, 0.98, 1.04) }],
          },
        ]}
      >
        <Svg width={width} height={height} viewBox="0 0 100 68">
          <Defs>
            <SvgGradient id="crownFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="38%" stopColor={colors[0]} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors[colors.length - 1]} stopOpacity={1} />
            </SvgGradient>
          </Defs>
          {/*
            Fünf Zacken (bei x = 8, 29, 50, 71, 92) mit vier Tälern dazwischen, unten
            durchgehend geschlossen zum Reif. Die Mitte ist die höchste Zacke, nach außen
            werden sie niedriger - gleich hohe Zacken sehen aus wie ein Kamm.
          */}
          <Path
            d="M2 68 L98 68 L98 46 L92 20 L81 38 L71 10 L60 34 L50 0 L40 34 L29 10 L18 38 L8 20 L2 46 Z"
            fill="url(#crownFill)"
          />
          {/* Drei Steine im Reif. Sie liegen innerhalb der Kontur, können also keine Naht
              erzeugen - sie sind Zeichnung auf der Form, nicht ein weiteres Teil daneben. */}
          <Circle cx={25} cy={57} r={4.5} fill={colors[colors.length - 1]} opacity={0.9} />
          <Circle cx={50} cy={57} r={6} fill="#FFFFFF" opacity={0.85} />
          <Circle cx={75} cy={57} r={4.5} fill={colors[colors.length - 1]} opacity={0.9} />
        </Svg>
      </Animated.View>
    </Layer>
  );
}
