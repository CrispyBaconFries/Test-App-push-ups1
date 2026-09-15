import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
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
import { Layer, Orbit, breathe, edgeRadius, effectStyles, phases, useLoop } from './frame-effects/kit';
import {
  CometEffect,
  DoubleRotorEffect,
  GoldRainEffect,
  GravityEffect,
  HelixEffect,
  OrbitRingsEffect,
  SolarWindEffect,
  StardustEffect,
} from './frame-effects/orbits';
import {
  BrokenRingEffect,
  EmberEffect,
  HeartbeatEffect,
  ImplosionEffect,
  MarqueeEffect,
  NeonEffect,
  PrismEffect,
  RadarEffect,
  ShockwaveEffect,
  SmokeEffect,
} from './frame-effects/rings';
import {
  CrownEffect,
  CrystalsEffect,
  ElectroEffect,
  RaysEffect,
  ShardsEffect,
  WavePointsEffect,
} from './frame-effects/shapes';

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
 * # Wo was steht
 *
 * Diese Datei ist die **Weiche**: Sie ordnet jeder Kennung ihren Effekt zu. Die Effekte
 * selbst liegen daneben, nach Art der Bewegung getrennt:
 *
 * - `frame-effects/kit.tsx` - die gemeinsamen Bausteine (`Layer`, `Orbit`, `Spoke`,
 *   `SpinGroup`, `useLoop`, `breathe`, `phases`). **Dort** stehen auch die drei Fallen,
 *   in die man bei Kreisbahnen und Kennlinien sonst zuverlässig tritt.
 * - `frame-effects/orbits.tsx` - alles, was um den Avatar herumläuft.
 * - `frame-effects/rings.tsx` - Ringe und Flächen.
 * - `frame-effects/shapes.tsx` - feste Formen an festen Stellen.
 *
 * Die sieben ursprünglichen Effekte sind bewusst *hier* geblieben: Sie sind die einzigen,
 * die SVG und Farbverläufe brauchen, und ein Umzug hätte sieben funktionierende Effekte
 * angefasst, um nichts zu gewinnen.
 *
 * # Wie die Ebenen liegen
 *
 * Jeder Effekt sitzt in einer `Layer`: absolut positioniert, füllt den Elternknoten
 * (also die Box des Avatars) und zentriert seine Kinder. Damit ist der Mittelpunkt jedes
 * Effekts der Mittelpunkt des Avatars, ohne dass irgendwo Größen doppelt gepflegt werden
 * müssen - und weil die Ebene absolut liegt, verschiebt sie das Layout nicht.
 *
 * Kreisende Teilchen benutzen durchgehend dasselbe Muster: **ein quadratischer Kasten,
 * der sich dreht, mit dem Teilchen oben mittig** (`Orbit`, bzw. `Spoke` für einen festen
 * Winkel). Der Radius ist damit die halbe Kastenbreite. Der naheliegende Weg (Teilchen um
 * `translateY` verschieben und dann drehen) tut nicht dasselbe - gedreht würde um den
 * Mittelpunkt des *Teilchens*, nicht um den des Avatars.
 */

export interface FrameEffectLayerProps {
  effectId: FrameEffectId;
  settings: EffectSettings;
  /** Farben des Rang-Rings bzw. des gekauften Themes - der Effekt nimmt sie mit. */
  colors: readonly [string, string, ...string[]];
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

    // Kreisende Effekte (frame-effects/orbits.tsx)
    case 'comet':
      return <CometEffect settings={settings} colors={colors} />;
    case 'double_rotor':
      return <DoubleRotorEffect settings={settings} colors={colors} />;
    case 'orbit_rings':
      return <OrbitRingsEffect settings={settings} colors={colors} />;
    case 'helix':
      return <HelixEffect settings={settings} colors={colors} />;
    case 'solar_wind':
      return <SolarWindEffect settings={settings} colors={colors} />;
    case 'gravity':
      return <GravityEffect settings={settings} colors={colors} />;
    case 'stardust':
      return <StardustEffect settings={settings} colors={colors} />;
    case 'gold_rain':
      return <GoldRainEffect settings={settings} colors={colors} />;

    // Ringe und Flächen (frame-effects/rings.tsx)
    case 'radar':
      return <RadarEffect settings={settings} colors={colors} />;
    case 'implosion':
      return <ImplosionEffect settings={settings} colors={colors} />;
    case 'shockwave':
      return <ShockwaveEffect settings={settings} colors={colors} />;
    case 'prism':
      return <PrismEffect settings={settings} colors={colors} />;
    case 'broken_ring':
      return <BrokenRingEffect settings={settings} colors={colors} />;
    case 'neon':
      return <NeonEffect settings={settings} colors={colors} />;
    case 'marquee':
      return <MarqueeEffect settings={settings} colors={colors} />;
    case 'heartbeat':
      return <HeartbeatEffect settings={settings} colors={colors} />;
    case 'ember':
      return <EmberEffect settings={settings} colors={colors} />;
    case 'smoke':
      return <SmokeEffect settings={settings} colors={colors} />;

    // Feste Formen (frame-effects/shapes.tsx)
    case 'shards':
      return <ShardsEffect settings={settings} colors={colors} />;
    case 'crystals':
      return <CrystalsEffect settings={settings} colors={colors} />;
    case 'rays':
      return <RaysEffect settings={settings} colors={colors} />;
    case 'electro':
      return <ElectroEffect settings={settings} colors={colors} />;
    case 'wave_points':
      return <WavePointsEffect settings={settings} colors={colors} />;
    case 'crown':
      return <CrownEffect settings={settings} colors={colors} />;
  }

  /**
   * Unerreichbar, solange jede Kennung einen Fall hat - und genau das ist der Zweck:
   * `never` bricht die Typprüfung, sobald jemand `FRAME_EFFECT_IDS` erweitert und den
   * Fall hier vergisst. Ohne diese Zeile käme `undefined` zurück, und der Effekt fehlte
   * einfach still.
   */
  const missing: never = effectId;
  void missing;
  return null;
}

type EffectProps = Omit<FrameEffectLayerProps, 'effectId'>;

/** Weicher Schein, der größer und kleiner wird. */
function GlowEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 3600, 900));
  const diameter = settings.size + haloRadius(settings.size, settings.intensity) * 2;

  return (
    <Layer>
      {/* `stacked` ist hier nicht nötig, solange es bei einem einzigen Element bleibt -
          aber es gilt für jeden Effekt die gleiche Regel, und ein Test prüft sie. Käme
          hier je ein zweites Element dazu, läge es sonst *unter* diesem statt darüber. */}
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: colors[colors.length - 1],
            opacity: Animated.multiply(breathe(loop, 0.25, 0.6), effectOpacity(settings.intensity)),
            transform: [{ scale: breathe(loop, 0.94, 1.06) }],
          },
        ]}
      />
    </Layer>
  );
}

/** Ein heller Punkt, der einmal um den Ring wandert. */
function RotorEffect({ settings, colors }: EffectProps) {
  const loop = useLoop(cycleDurationMs(settings.speed, 5000, 1200));
  const ring = edgeRadius(settings.size) * 2;
  const rotate = loop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Layer>
      <Animated.View
        style={[
          effectStyles.stacked,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            overflow: 'hidden',
            opacity: effectOpacity(settings.intensity),
            transform: [{ rotate }],
          },
        ]}
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
  const baseDuration = cycleDurationMs(settings.speed, 6000, 1600);
  const dotSize = 4 + Math.round(settings.size / 24);
  const radius = edgeRadius(settings.size, dotSize / 2);
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
  const count = particleCount(settings.intensity, 5, 9);
  const baseDuration = cycleDurationMs(settings.speed, 1800, 500);
  const spread = useMemo(() => phases(count), [count]);
  const opacity = effectOpacity(settings.intensity);

  return (
    <Layer>
      {spread.map((phase, i) => {
        // Gleich lange Zungen in gleichmäßigem Abstand sahen in der Web-Vorschau aus wie
        // Blütenblätter, nicht wie Feuer. Beides wird deshalb bewusst ungleich gemacht -
        // aus derselben festen Phase, damit es bei jedem Render gleich bleibt.
        const length = settings.size * (0.34 + phase * 0.26);
        return (
          <Flame
            key={i}
            // Gleichmäßig über den ganzen Kreis verteilt (Flammen nur unten sähen aus, als
            // stünde der Avatar auf einem Lagerfeuer), aber mit Versatz gegen die Symmetrie.
            angleDeg={(360 * i) / count + (phase - 0.5) * 18}
            durationMs={Math.round(baseDuration * (0.75 + phase * 0.6))}
            delayMs={Math.round(baseDuration * phase)}
            radius={edgeRadius(settings.size) + length}
            length={length}
            // Deutlich schmaler als zuvor (0,2): Eine Flamme ist hoch und schmal, eine
            // breite Zunge liest sich als Blatt.
            width={settings.size * 0.13}
            colors={colors}
            opacity={opacity}
          />
        );
      })}
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
  // Eindeutig je Zunge: Zwei `<RadialGradient>` mit derselben Kennung wären im Browser
  // ein einziger Verlauf (SVG-Kennungen gelten dort dokumentweit).
  const gradientId = `flame-${Math.round(radius)}-${Math.round(angleDeg * 10)}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        effectStyles.stacked,
        // `justifyContent: 'flex-start'` ist hier NICHT kosmetisch: `effectStyles.stacked`
        // zentriert seinen Inhalt, die Flamme säße damit mitten auf dem Avatar statt an
        // dessen Rand - unsichtbar hinter dem Ring. Genauso wie bei `Orbit` muss der
        // Inhalt oben am Kastenrand kleben, denn der Radius IST die halbe Kastenbreite.
        { width: radius * 2, height: radius * 2, alignItems: 'center', justifyContent: 'flex-start' },
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
            {/* Heißer Kern unten am Ring, nach oben auslaufend - so herum, weil eine
                Flamme dort am hellsten ist, wo sie brennt, nicht an der Spitze. */}
            <RadialGradient id={gradientId} cx="50%" cy="88%" r="85%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="30%" stopColor={colors[0]} stopOpacity={0.95} />
              <Stop offset="75%" stopColor={colors[0]} stopOpacity={0.45} />
              <Stop offset="100%" stopColor={colors[colors.length - 1]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/*
            Flammen-Silhouette, Spitze oben (= vom Avatar weg).
            Die vorige Tropfenform (unten breit und rund) las sich in der Web-Vorschau als
            Blütenblatt: Eine Flamme ist unten SCHMAL, wird im unteren Drittel am breitesten
            und läuft von dort lang aus.
          */}
          <Path
            d="M10 0 C 13 14, 19 25, 19 33 A 9 9 0 0 1 1 33 C 1 25, 7 14, 10 0 Z"
            fill={`url(#${gradientId})`}
          />
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
  const radius = edgeRadius(settings.size) + length;
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
        effectStyles.stacked,
        // Siehe `Flame`: Ohne `flex-start` läge der Blitz mitten auf dem Avatar.
        { width: radius * 2, height: radius * 2, alignItems: 'center', justifyContent: 'flex-start' },
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
          effectStyles.stacked,
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
        effectStyles.stacked,
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
