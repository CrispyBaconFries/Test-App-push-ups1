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

export const FRAME_EFFECT_IDS = ['none', 'glow', 'rotor', 'sparks', 'flames', 'lightning', 'aura'] as const;

export type FrameEffectId = (typeof FRAME_EFFECT_IDS)[number];

export interface FrameEffectDefinition {
  id: FrameEffectId;
  label: string;
  /** Ein Satz, der beschreibt, was man sieht - steht im Werkstatt-Bildschirm unter dem Effekt. */
  description: string;
}

const DEFINITIONS: Record<FrameEffectId, FrameEffectDefinition> = {
  none: {
    id: 'none',
    label: 'Ohne',
    description: 'Nur der Rang-Ring, wie er heute aussieht. Der Vergleichsmaßstab.',
  },
  glow: {
    id: 'glow',
    label: 'Leuchten',
    description: 'Weicher Schein rundherum, der mit dem Atem größer und kleiner wird.',
  },
  rotor: {
    id: 'rotor',
    label: 'Lichtlauf',
    description: 'Ein heller Punkt wandert einmal um den Ring - der "legendär"-Look.',
  },
  sparks: {
    id: 'sparks',
    label: 'Funken',
    description: 'Kleine Funken kreisen um den Rahmen, jeder mit eigenem Tempo.',
  },
  flames: {
    id: 'flames',
    label: 'Flammen',
    description: 'Züngelnde Flammenzungen rund um den Rahmen, jede in eigenem Takt.',
  },
  lightning: {
    id: 'lightning',
    label: 'Blitze',
    description: 'Gezackte Blitze, die im unregelmäßigen Takt kurz aufblitzen.',
  },
  aura: {
    id: 'aura',
    label: 'Aura',
    description: 'Große pulsierende Aura mit aufsteigenden Funken - Super-Saiyajin.',
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

export const DEFAULT_EFFECT_SETTINGS: EffectSettings = {
  intensity: 0.6,
  speed: 0.5,
  size: 96,
};

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

/** Ringdicke, mit der die Werkstatt startet - die Mitte der heutigen Rang-Stufen. */
export const DEFAULT_RING_WIDTH = 4;

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
