/**
 * Der Katalog der Rahmen-Effekte und die Rechnung dahinter - reine Daten und reine
 * Funktionen, getrennt von der Darstellung (`src/components/FrameEffectLayer.tsx`).
 *
 * # Warum das ein eigenes Modul ist
 *
 * Genau wie bei `rankFrameStyle.ts`: Die Entscheidung "wie stark, wie schnell, wie viele
 * Funken" ist Rechnung, keine Darstellung, und lässt sich damit ohne React-Test-Setup
 * prüfen. Die Bildschirm-Komponente bekommt nur noch fertige Zahlen.
 *
 * # Warum Effekte im Code und nicht als Bilddatei
 *
 * Ausführlich in `docs/grafik-plan.md`. Die drei Gründe, die hier zählen:
 *
 * - **Keine neue native Abhängigkeit.** `react-native-svg`, `expo-linear-gradient` und
 *   die Animationen von React Native sind längst im Projekt. Kein `npm install`, kein
 *   Prebuild, kein neues Gradle-Risiko - und das wiegt bei diesem Projekt schwer.
 * - **Die Rangfarbe kommt automatisch mit.** Ein Effekt bekommt die Farben des Rangs
 *   bzw. des gekauften Themes durchgereicht. Als Bilddatei bräuchte jede Farbe einen
 *   eigenen Satz Dateien.
 * - **"Etwas weniger grell" ist ein Zahlenwert.** Bei Bilddateien wäre es eine neue
 *   Runde beim Bildgenerator, für jede Größe und jede Farbe.
 *
 * # Wofür der Werkstatt-Bildschirm da ist
 *
 * `EffectWorkshopScreen` zeigt **einen** Effekt in einer großen Vorschau, mit Reglern für
 * Stärke, Tempo, Größe und Ringdicke. chris entscheidet damit **auf dem Handy** statt an
 * einem Screenshot, und kann das Ergebnis als eine Zeile ablesen (`describeSelection`)
 * und mir durchgeben. Ohne das rate ich, wie etwas wirkt, das ich nie zu sehen bekomme.
 *
 * Bewusst *einer* und nicht alle nebeneinander: Jedes Teilchen eines Effekts ist eine
 * eigene laufende Animation. Bei einer Wand aus Vorschauen sind das schnell über hundert
 * gleichzeitig - dann ruckelt die Werkstatt selbst, und man sieht nicht mehr, ob der
 * Effekt ruckelt oder der Bildschirm.
 *
 * # Wo Effekte im Spiel auftauchen
 *
 * Nur im **Profil**, am großen runden Avatar. In der Rangliste nicht: Dort sind es
 * rechteckige Zeilen, und ein Effekt, der für einen Kreis gebaut ist, sitzt darin falsch.
 * Für die Tabellenansicht kommt später eine eigene Familie von Effekten, die auf
 * rechteckige Zellen zugeschnitten ist.
 */

export const FRAME_EFFECT_IDS = [
  // Die ersten sieben sind die ursprünglichen und stehen bewusst zuerst - "Ohne" ist der
  // Vergleichsmaßstab im Werkstatt-Bildschirm und muss der erste Eintrag bleiben.
  'none',
  'glow',
  'rotor',
  'sparks',
  'flames',
  'lightning',
  'aura',
  // Vierundzwanzig weitere, nach Art der Bewegung sortiert: erst kreisende, dann Ringe
  // und Flächen, dann feste Formen. Die Reihenfolge ist die Reihenfolge im
  // Werkstatt-Bildschirm.
  'comet',
  'double_rotor',
  'orbit_rings',
  'helix',
  'solar_wind',
  'gravity',
  'stardust',
  'gold_rain',
  'radar',
  'implosion',
  'shockwave',
  'prism',
  'broken_ring',
  'neon',
  'marquee',
  'heartbeat',
  'ember',
  'smoke',
  'shards',
  'crystals',
  'rays',
  'electro',
  'wave_points',
  'crown',
] as const;

export type FrameEffectId = (typeof FRAME_EFFECT_IDS)[number];

export interface FrameEffectDefinition {
  id: FrameEffectId;
  label: string;
  /** Ein Satz, der beschreibt, was man sieht - steht im Werkstatt-Bildschirm unter dem Effekt. */
  description: string;
  /**
   * Wie viele Elemente bei voller Stärke gleichzeitig animiert laufen.
   *
   * Kein Schmuckwert: Jedes bewegte Element ist eine eigene Animation, und die App rechnet
   * nebenher die Posenerkennung. Die Zahl ist die Obergrenze, gegen die ein Test prüft -
   * ohne sie wächst ein Effekt beim Feintuning still von acht auf dreißig Teilchen, und
   * auffallen würde es erst auf dem Gerät.
   */
  movingParts: number;
}

/** Obergrenze für `movingParts`. Bewusst niedrig - siehe dort. */
export const MAX_MOVING_PARTS = 12;

const DEFINITIONS: Record<FrameEffectId, FrameEffectDefinition> = {
  none: {
    id: 'none',
    label: 'Ohne',
    description: 'Nur der Rang-Ring, wie er heute aussieht. Der Vergleichsmaßstab.',
    movingParts: 0,
  },
  glow: {
    id: 'glow',
    label: 'Leuchten',
    description: 'Weicher Schein rundherum, der mit dem Atem größer und kleiner wird.',
    movingParts: 1,
  },
  rotor: {
    id: 'rotor',
    label: 'Lichtlauf',
    description: 'Ein heller Punkt wandert einmal um den Ring - der "legendär"-Look.',
    movingParts: 1,
  },
  sparks: {
    id: 'sparks',
    label: 'Funken',
    description: 'Kleine Funken kreisen um den Rahmen, jeder mit eigenem Tempo.',
    movingParts: 9,
  },
  flames: {
    id: 'flames',
    label: 'Flammen',
    description: 'Züngelnde Flammenzungen rund um den Rahmen, jede in eigenem Takt.',
    movingParts: 9,
  },
  lightning: {
    id: 'lightning',
    label: 'Blitze',
    description: 'Gezackte Blitze, die im unregelmäßigen Takt kurz aufblitzen.',
    movingParts: 5,
  },
  aura: {
    id: 'aura',
    label: 'Aura',
    description: 'Große pulsierende Aura mit aufsteigenden Funken - Super-Saiyajin.',
    movingParts: 11,
  },
  comet: {
    id: 'comet',
    label: 'Komet',
    description: 'Ein heller Kopf mit Schweif jagt um den Rahmen.',
    movingParts: 5,
  },
  double_rotor: {
    id: 'double_rotor',
    label: 'Doppelrotor',
    description: 'Zwei gegenläufige Flügelpaare auf unterschiedlichen Bahnen.',
    movingParts: 4,
  },
  orbit_rings: {
    id: 'orbit_rings',
    label: 'Umlaufbahnen',
    description: 'Drei Bahnen mit je einem Trabanten, jeder in eigenem Tempo.',
    movingParts: 3,
  },
  helix: {
    id: 'helix',
    label: 'Helix',
    description: 'Zwei gegenläufige Perlenbänder, deren Perlen vorn größer wirken als hinten.',
    movingParts: 8,
  },
  solar_wind: {
    id: 'solar_wind',
    label: 'Sonnenwind',
    description: 'Langgezogene Böen ziehen auf mehreren Bahnen am Rahmen vorbei.',
    movingParts: 8,
  },
  gravity: {
    id: 'gravity',
    label: 'Schwerkraft',
    description: 'Teilchen werden von außen zum Avatar gezogen und werden dabei kleiner.',
    movingParts: 10,
  },
  stardust: {
    id: 'stardust',
    label: 'Sternenstaub',
    description: 'Ein stilles Funkelfeld in ungleichen Abständen rund um den Rahmen.',
    movingParts: 12,
  },
  gold_rain: {
    id: 'gold_rain',
    label: 'Goldregen',
    description: 'Glitzernde Tropfen fallen am Rahmen vorbei nach unten.',
    movingParts: 11,
  },
  radar: {
    id: 'radar',
    label: 'Radar',
    description: 'Ein Zeiger mit Nachleuchten streicht wie auf einem Radarschirm umher.',
    movingParts: 6,
  },
  implosion: {
    id: 'implosion',
    label: 'Implosion',
    description: 'Ringe fallen von außen auf den Avatar zusammen.',
    movingParts: 3,
  },
  shockwave: {
    id: 'shockwave',
    label: 'Druckwelle',
    description: 'Ringe laufen vom Avatar nach außen und verlaufen sich.',
    movingParts: 3,
  },
  prism: {
    id: 'prism',
    label: 'Prisma',
    description: 'Ein Ring mit verschiedenfarbigen Seiten dreht sich, innen ein zweiter dagegen.',
    movingParts: 2,
  },
  broken_ring: {
    id: 'broken_ring',
    label: 'Bruchring',
    description: 'Zwei Ringe mit wandernder Lücke, gegenläufig.',
    movingParts: 2,
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    description: 'Eine Leuchtröhre, die unruhig flackert.',
    movingParts: 2,
  },
  marquee: {
    id: 'marquee',
    label: 'Lauflicht',
    description: 'Lampen rund um den Rahmen springen der Reihe nach an.',
    movingParts: 12,
  },
  heartbeat: {
    id: 'heartbeat',
    label: 'Herzschlag',
    description: 'Der Ring pocht im Doppelschlag, wie ein Puls.',
    movingParts: 2,
  },
  ember: {
    id: 'ember',
    label: 'Glut',
    description: 'Eine ruhige warme Glut mit einzelnen aufsteigenden Funken.',
    movingParts: 7,
  },
  smoke: {
    id: 'smoke',
    label: 'Rauch',
    description: 'Große weiche Schwaden steigen langsam auf und vergehen.',
    movingParts: 3,
  },
  shards: {
    id: 'shards',
    label: 'Splitter',
    description: 'Scharfkantige Splitter fliegen vom Rahmen weg und verglühen.',
    movingParts: 8,
  },
  crystals: {
    id: 'crystals',
    label: 'Kristalle',
    description: 'Zwei gegenläufige Kränze aus Rauten, die dabei atmen.',
    movingParts: 9,
  },
  rays: {
    id: 'rays',
    label: 'Strahlenkranz',
    description: 'Unterschiedlich lange Strahlen drehen sich langsam um den Avatar.',
    movingParts: 12,
  },
  electro: {
    id: 'electro',
    label: 'Strom',
    description: 'Kurze Entladungen knistern rund um den Rand.',
    movingParts: 10,
  },
  wave_points: {
    id: 'wave_points',
    label: 'Wellenpunkte',
    description: 'Eine Welle läuft durch die Punkte am Rand, nach außen und zurück.',
    movingParts: 10,
  },
  crown: {
    id: 'crown',
    label: 'Krone',
    description: 'Eine leuchtende Krone steht über dem Avatar.',
    movingParts: 5,
  },
};

export function frameEffectById(id: FrameEffectId): FrameEffectDefinition {
  return DEFINITIONS[id];
}

export const FRAME_EFFECTS: readonly FrameEffectDefinition[] = FRAME_EFFECT_IDS.map((id) => DEFINITIONS[id]);

/** Die drei Regler des Werkstatt-Bildschirms. `intensity` und `speed` sind 0..1, `size` ist der Avatar-Durchmesser in px. */
export interface EffectSettings {
  intensity: number;
  speed: number;
  size: number;
}

/** Ein Regler-Bereich mit kleinstem und größtem Wert. */
export interface SliderRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Die Mitte eines Regler-Bereichs - der Startwert jedes Effekts.
 *
 * chris wollte "alle Werte vorab auf 50 %". Bei Stärke und Tempo (0 bis 1) ist das
 * eindeutig: 0,5. Bei Größe und Ringdicke fängt der Bereich nicht bei null an, und dort
 * gibt es zwei Lesarten - die Hälfte des Höchstwerts (70 px) oder die Mitte des Bereichs
 * (88 px). Gewählt ist die Mitte des Bereichs, weil das die Lesart ist, die man auf dem
 * Bildschirm *sieht*: Der Reglerknopf steht in der Mitte, nach links wie nach rechts ist
 * gleich viel Luft. Die Hälfte des Höchstwerts läge bei Größe im linken Drittel und sähe
 * aus wie ein Fehler.
 *
 * Eine Funktion und keine ausgeschriebenen Zahlen, damit ein geänderter Bereich den
 * Startwert automatisch mitnimmt - sonst steht irgendwann eine Vorgabe außerhalb ihres
 * eigenen Reglers.
 */
export function sliderMidpoint(range: SliderRange): number {
  return Math.round((range.min + range.max) / 2);
}

/**
 * Stärke und Tempo laufen von 0 bis 1, hier in Prozent notiert.
 *
 * In Prozent und nicht als 0..1, damit `sliderMidpoint` überall dieselbe, ganzzahlige
 * Rechnung macht - bei 0..1 käme dort durch das Runden 1 statt 0,5 heraus.
 */
export const INTENSITY_RANGE = { min: 0, max: 100 } as const;
export const SPEED_RANGE = { min: 0, max: 100 } as const;

/** Kleinster und größter Avatar-Durchmesser im Werkstatt-Bildschirm. 36 px ist die Größe in der Rangliste, 140 px die im Profil. */
export const SIZE_RANGE = { min: 36, max: 140 } as const;

/**
 * Kleinste und größte Ringdicke im Werkstatt-Bildschirm, in px.
 *
 * Die Rang-Stufen liegen heute zwischen 3 px (Bronze) und 6 px (Challenger), siehe
 * `rankFrameStyle.ts`. Der Regler geht bewusst darüber hinaus: Er ist dazu da, den
 * *richtigen* Bereich zu finden, nicht den bestehenden zu bestätigen.
 */
export const RING_RANGE = { min: 1, max: 14 } as const;

/** Ringdicke, mit der die Werkstatt startet: die Mitte des Reglers (siehe `sliderMidpoint`). */
export const DEFAULT_RING_WIDTH = sliderMidpoint(RING_RANGE);

/**
 * Womit jeder Effekt startet: jeder Regler in der Mitte.
 *
 * Ein bewusst neutraler Ausgangspunkt - von hier aus ist "mehr" und "weniger" gleich weit
 * entfernt, und niemand muss raten, ob eine Vorgabe schon eine Meinung war.
 */
export const DEFAULT_EFFECT_SETTINGS: EffectSettings = {
  intensity: sliderMidpoint(INTENSITY_RANGE) / 100,
  speed: sliderMidpoint(SPEED_RANGE) / 100,
  size: sliderMidpoint(SIZE_RANGE),
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Dauer eines Animationsdurchlaufs in Millisekunden.
 *
 * Der Regler läuft bewusst andersherum als die Zahl: **mehr Tempo = kürzere Dauer**.
 * Ein Regler, bei dem "nach rechts" langsamer bedeutet, verwirrt beim Ausprobieren mehr,
 * als die eine Zeile Umrechnung hier kostet.
 */
export function cycleDurationMs(speed: number, slowestMs: number, fastestMs: number): number {
  return Math.round(slowestMs + (fastestMs - slowestMs) * clamp01(speed));
}

/**
 * Deckkraft eines Effekts aus der Stärke.
 *
 * Beginnt bei 0,15 und nicht bei 0: Ein Effekt, der bei Stärke 0 komplett verschwindet,
 * ist im Werkstatt-Bildschirm nicht von "Ohne" zu unterscheiden - man weiß dann nicht, ob
 * man ihn gerade nur leise gestellt oder etwas kaputt gemacht hat.
 */
export function effectOpacity(intensity: number): number {
  return Math.round((0.15 + 0.85 * clamp01(intensity)) * 100) / 100;
}

/**
 * Wie weit ein Leuchten oder eine Aura über den Avatar hinausragt, in px.
 *
 * Am Avatar-Durchmesser bemessen und nicht als feste Zahl: Derselbe Effekt muss neben
 * einem 36-px-Ranglisteneintrag und einem 140-px-Profilbild gleich *wirken*, und dafür
 * muss er mitwachsen.
 */
export function haloRadius(size: number, intensity: number, factor = 0.45): number {
  return Math.round(size * factor * (0.4 + 0.6 * clamp01(intensity)));
}

/**
 * Anzahl der Funken bzw. Flammenzungen.
 *
 * Nach oben gedeckelt, und zwar nicht aus optischen Gründen: Jedes Teilchen ist eine
 * eigene laufende Animation. Bei einem Bildschirm voller Ranglisteneinträge summiert sich
 * das, und das Ruckeln fiele ausgerechnet dort auf, wo die Kamera ohnehin schon rechnet.
 */
export function particleCount(intensity: number, min: number, max: number): number {
  return Math.round(min + (max - min) * clamp01(intensity));
}

/**
 * Die aktuelle Auswahl als eine Zeile.
 *
 * Der eigentliche Zweck des Werkstatt-Bildschirms: chris probiert aus, liest diese Zeile
 * ab und schickt sie mir. Dann setze ich genau das ein, statt aus "mach's etwas cooler"
 * raten zu müssen.
 */
export function describeSelection(
  effectId: FrameEffectId,
  settings: EffectSettings,
  tierLabel: string,
  /** Weggelassen = Ringdicke nicht Teil der Auswahl (sie kommt dann weiterhin vom Rang). */
  ringWidthPx?: number
): string {
  const pct = (value: number) => `${Math.round(clamp01(value) * 100)} %`;
  const ring = ringWidthPx === undefined ? '' : ` · Ringdicke ${Math.round(ringWidthPx)} px`;
  return (
    `${frameEffectById(effectId).label} · Stärke ${pct(settings.intensity)} · ` +
    `Tempo ${pct(settings.speed)} · Größe ${Math.round(settings.size)} px${ring} · Rang ${tierLabel}`
  );
}

/**
 * Was ein einzelner Spieler an seinem Avatar trägt.
 *
 * # Warum die Regler-Werte mitreisen und nicht fest im Effekt stehen
 *
 * Noch trägt niemand einen Effekt - im Spiel ist heute überall `none`, und eingebaut wird
 * erst, was chris in der Werkstatt aussucht (Aufgabe #10). Dieser Typ hält die Tür für
 * zwei Dinge offen, die später kommen sollen:
 *
 * - **Gekauft** (Münz-Shop, wie die Rahmen-Themes in `frameThemes.ts`) oder später gegen
 *   echtes Geld.
 * - **Erspielt** - ein Effekt als Belohnung für eine Leistung, nicht für Geld.
 *
 * In beiden Fällen ist das Verstellbare der eigentliche Wert: Zwei Spieler mit demselben
 * Effekt, aber eigener Stärke, eigenem Tempo und eigener Größe sehen unterschiedlich aus.
 * Stünden die Werte fest im Effekt, wäre jeder gekaufte Effekt bei allen gleich, und die
 * Werkstatt wäre ein Entwicklerwerkzeug geblieben statt der Vorlage für einen späteren
 * Einstell-Bildschirm.
 *
 * Bewusst **kein** Freigabe-/Preis-Modell hier: Solange niemand entschieden hat, was
 * etwas kostet und was man dafür tun muss, wäre das geraten. Der Typ beschreibt nur, was
 * ein Spieler trägt - wer es ihm gegeben hat, klärt die Stelle, die es vergibt.
 */
export interface PlayerFrameEffect {
  effectId: FrameEffectId;
  settings: EffectSettings;
  /** Ringdicke in px, oder weggelassen: dann bestimmt sie weiterhin der Rang. */
  ringWidthPx?: number;
}

/** Was jeder Spieler hat, solange nichts gekauft oder erspielt wurde: den Rang-Ring, sonst nichts. */
export const DEFAULT_PLAYER_FRAME_EFFECT: PlayerFrameEffect = {
  effectId: 'none',
  settings: DEFAULT_EFFECT_SETTINGS,
};
