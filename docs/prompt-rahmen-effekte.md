# Prompt für eine andere KI: Rang-Rahmen und Effekte

## Für chris — so benutzt du das

**Welche KI.** Nimm eine, die **Code** schreibt (Claude, ChatGPT, Gemini — jeweils das
beste verfügbare Modell), **keine Bild-KI**. Ein animierter Rahmen ist kein Bild, sondern
Code, der in unser Rang-System, unsere Farbwerte und unseren Kamera-Pfad passen muss.
Midjourney & Co. können hier nichts liefern, was wir einbauen könnten.

Das ist kein Widerspruch zu `docs/grafik-plan.md`, wo steht, eine andere KI bringe bei den
Effekten nichts. Dort ging es um eine KI **ohne Projektwissen** — genau das behebt dieser
Prompt: Er enthält die Schnittstellen, die Farbwerte, die Beispiele und die Regeln, an
denen es sonst scheitert.

**So gehst du vor:**

1. Alles ab der Trennlinie unten kopieren und als eine Nachricht abschicken.
2. Die Antwort als Datei speichern und mir schicken (oder den Inhalt hier einfügen).
3. Ich prüfe sie gegen die Regeln, baue sie ein und schreibe die Tests dazu.

**Was du nicht tun musst:** nichts freistellen, nichts konvertieren, keine Bilddateien
verwalten. Es kommt Text heraus, der direkt in den Quellcode geht.

**Womit du rechnen solltest:** Die KI wird Regeln brechen — meist neue Pakete vorschlagen
oder SVG-Pfade animieren wollen. Das ist normal. Schick mir die Antwort trotzdem; ich sehe
sofort, was tragfähig ist, und der Rest ist schneller korrigiert als neu erzeugt.

---

# AB HIER KOPIEREN

Du bist ein erfahrener React-Native-Entwickler und Motion-Designer. Du erweiterst eine
bestehende, produktive App um Rang-Rahmen und animierte Rahmen-Effekte. Deine Antwort wird
direkt in den Quellcode übernommen — sie muss deshalb exakt in die unten beschriebenen
Schnittstellen passen.

## 1. Die App

„Liegestütz Coach": eine Android-App, die per Handykamera Liegestütze zählt und die Form
bewertet. Es gibt eine Rangliste, Duelle und ein Ranglisten-System. Jeder Spieler hat einen
runden Avatar mit einem Rahmen, der seinen Rang zeigt.

Technischer Stand, unveränderlich:

- Expo SDK 57, React Native 0.86.3, **New Architecture aktiv**
- TypeScript im `strict`-Modus
- Zielgerät: Android-Handy, Release-Build

## 2. Deine Aufgabe, in zwei Teilen

### Aufgabe A — fünf Rang-Rahmen

Fünf Ränge, jeder bekommt einen eigenen Rahmen. Sie müssen als **Reihe** funktionieren:
erkennbar dieselbe Familie, aber mit spürbarer Steigerung von unten nach oben. Wer Gold
erreicht, soll das sehen, ohne den Text zu lesen.

Die **obersten drei Ränge (Gold, Diamant, Challenger) bekommen je einen dynamischen
Rahmen** mit Bewegung. Bronze und Silber bleiben statisch.

### Aufgabe B — mindestens 20 dynamische Effektmuster

Ein Katalog von **mindestens 20** klar unterscheidbaren Bewegungseffekten, die um den
Avatar herum laufen. Sie werden später den Rängen zugeordnet und im Münz-Shop verkauft.

**Die wichtigste Anforderung:** Sie müssen sich wirklich unterscheiden. Zwanzigmal
„leuchtender Ring, etwas anders getimt" ist ein Fehlschlag. Abschnitt 7 gibt dir dafür eine
Matrix vor.

## 3. Die harten Regeln — Verstöße machen die Lieferung unbrauchbar

**3.1 Keine neuen Abhängigkeiten.** Erlaubt sind ausschließlich:

- `react-native` (insbesondere `Animated`, `Easing`)
- `react-native-svg` (Version 15) — bereits installiert
- `expo-linear-gradient` — bereits installiert
- `@expo/vector-icons` — bereits installiert

Jedes weitere Paket (Lottie, Skia, Rive, Moti, `react-native-redash`, …) bedeutet einen
nativen Neubau. Dieses Projekt hat dabei eine dokumentierte Geschichte von Gradle-,
CMake- und Prefab-Fehlern, die Tage gekostet haben. **Schlage kein Paket vor, auch nicht
als Option.** Wenn etwas ohne neues Paket nicht geht, lass den Effekt weg und sag warum.

**3.2 Alle Bewegung über `useNativeDriver: true`.** Daraus folgt zwingend: Animierbar sind
**nur `transform` (translateX/Y, scale, rotate) und `opacity`**. Nicht animierbar sind
Breite, Höhe, Farben, `borderRadius`, Schatten und SVG-Pfaddaten.

Der Grund ist nicht Stilfrage: Im JS-Thread läuft bei laufender Kamera die Posenerkennung
(MediaPipe, 30 Bilder/s). Alles, was dort mitrechnet, ruckelt sichtbar. Der Native-Treiber
läuft im UI-Thread weiter, auch wenn JS gerade beschäftigt ist.

**3.3 Kein Reanimated, keine Worklets.** `react-native-reanimated` ist zwar installiert
(als Abhängigkeit von anderem), wird in diesem Pfad aber bewusst nicht benutzt — siehe 3.2.

**3.4 SVG-Formen sind statisch.** Eine Flammenzunge, ein Blitz, ein Splitter darf als
`<Path>` fest definiert sein. Ihre *Form* ändert sich nie; bewegt werden dürfen nur Lage,
Größe und Deckkraft der umgebenden `Animated.View`. Willst du „züngeln", nimm mehrere
Zungen mit versetzten Phasen — nicht einen sich verformenden Pfad.

**3.5 Kein `Math.random()` beim Rendern.** Es würfelt bei jedem Renderdurchlauf neu, und
die Teilchen springen. Für ungleichmäßige Verteilung gibt es eine feste Folge (siehe
`phases()` in Abschnitt 5).

**3.6 Farben kommen immer als Prop.** Nie ein Farbwert im Effekt hartkodiert. Jeder Effekt
bekommt ein Farb-Array durchgereicht und muss mit 2 wie mit 3 Farben funktionieren. Nur so
tragen die Effekte automatisch die Rangfarbe *und* die gekauften Shop-Themes.

**3.7 Zwei Größen, ein Effekt.** Derselbe Effekt läuft bei **36 px** (Zeile in der
Rangliste) und bei **140 px** (Profilbild). Alle Maße müssen sich aus `settings.size`
ableiten, nie feste Pixelzahlen.

**3.8 Teilchenbudget.** In der Rangliste sind bis zu 20 Rahmen gleichzeitig sichtbar. Jedes
Teilchen ist eine eigene laufende Animation. **Höchstens 12 bewegte Elemente pro Effekt**,
und begründe bei jedem Effekt kurz, warum deine Zahl vertretbar ist.

**3.9 Kommentare auf Deutsch, und sie erklären das *Warum*.** Nicht „setzt die Deckkraft",
sondern warum dieser Wert und nicht ein anderer. Das ist der Stil des gesamten Projekts.

**3.10 Nichts Bestehendes umbenennen.** Bestehende Typen, Funktionsnamen und Signaturen
bleiben wie sie sind. Du erweiterst, du baust nicht um.

## 4. Das Farbsystem — benutze exakt diese Werte

**Hintergrund der App** (darauf liegt alles, dunkel):

| Zweck | Hex |
|---|---|
| Hintergrund | `#0B0F14` |
| Karten-Oberfläche | `#161C24` |

**Die fünf Ränge** (`src/ranking/ranks.ts` und `rankFrameStyle.ts`):

| Rang | Kennfarbe | Rahmen-Verlauf heute | Ringdicke | dynamisch? |
|---|---|---|---|---|
| Bronze | `#AD7A56` | `#AD7A56` → `#8C5E3E` | 3 px | nein |
| Silber | `#B7C0C7` | `#E4E9ED` → `#9AA5AD` | 4 px | nein |
| Gold | `#E0B93D` | `#FFE9A8` → `#E0B93D` → `#B8860B` | 4 px | **ja** |
| Diamant | `#5AC8E8` | `#D6F6FF` → `#5AC8E8` → `#2E7FA6` | 5 px | **ja** |
| Challenger | `#FF5A5F` | `#FFD36E` → `#FF5A5F` → `#B23AFF` | 6 px | **ja** |

**Die sechs kaufbaren Themes** — sie ersetzen nur die Farben, nie die Struktur. Jeder
Effekt muss mit allen davon funktionieren:

| Theme | Verlauf |
|---|---|
| Standard | Rangfarbe (siehe oben) |
| Inferno | `#FFD36E` → `#FF5A5F` → `#8C1A1A` |
| Aqua | `#D6F6FF` → `#2E9FE8` → `#1B4E7A` |
| Royal | `#F3D9FF` → `#B23AFF` → `#4B1780` |
| Toxic | `#EFFF9E` → `#7ED321` → `#3D6E0F` |
| Monochrom | `#FFFFFF` → `#9AA5AD` → `#2B2F33` |

## 5. Der bestehende Code — daran musst du dich anlegen

### 5.1 Der Effekt-Katalog (`src/ranking/frameEffects.ts`)

Reine Daten und reine Funktionen, ohne React. Hier kommen deine neuen Effekte hinein:

```ts
export const FRAME_EFFECT_IDS = ['none', 'glow', 'rotor', 'sparks', 'flames', 'lightning', 'aura'] as const;
export type FrameEffectId = (typeof FRAME_EFFECT_IDS)[number];

export interface FrameEffectDefinition {
  id: FrameEffectId;
  label: string;
  /** Ein Satz, der beschreibt, was man sieht - steht im Werkstatt-Bildschirm unter dem Effekt. */
  description: string;
}

/** Die drei Regler des Werkstatt-Bildschirms. `intensity`/`speed` sind 0..1, `size` ist der Avatar-Durchmesser in px. */
export interface EffectSettings {
  intensity: number;
  speed: number;
  size: number;
}
```

Diese Hilfsfunktionen existieren bereits — **benutze sie, schreibe sie nicht neu**:

```ts
/** Dauer eines Durchlaufs. Mehr Tempo = kürzere Dauer. */
cycleDurationMs(speed: number, slowestMs: number, fastestMs: number): number

/** Deckkraft aus der Stärke. Beginnt bei 0,15, damit "leise" nicht wie "aus" aussieht. */
effectOpacity(intensity: number): number

/** Wie weit ein Leuchten über den Avatar hinausragt, in px - am Durchmesser bemessen. */
haloRadius(size: number, intensity: number, factor?: number): number

/** Anzahl Teilchen zwischen min und max, gesteuert über die Stärke. */
particleCount(intensity: number, min: number, max: number): number
```

### 5.2 Die Effektebene (`src/components/FrameEffectLayer.tsx`)

```ts
export interface FrameEffectLayerProps {
  effectId: FrameEffectId;
  settings: EffectSettings;
  /** Farben des Rang-Rings bzw. des gekauften Themes - der Effekt nimmt sie mit. */
  colors: readonly [string, string, ...string[]];
}
```

Diese Bausteine existieren bereits. **Kopiere ihr Muster, erfinde kein eigenes:**

```tsx
/**
 * Ein Wert, der endlos von 0 nach 1 läuft.
 *
 * `Easing.linear` und nicht die Vorgabe: Bei Drehungen erzeugt jede andere Kennlinie ein
 * sichtbares Stocken an der Stelle, an der der Durchlauf von 1 wieder auf 0 springt.
 *
 * Der Versatz (`delayMs`) läuft über `setTimeout` und **nicht** über `Animated.delay`
 * innerhalb der Schleife: Dort würde er bei *jedem* Durchlauf erneut warten, aus dem
 * gleichmäßigen Kreisen würde ein Stottern.
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

/** Feste, ungleichmäßig verteilte Phasen (goldener Schnitt) - besser als `Math.random()`. */
function phases(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i * 0.618) % 1);
}

/** Absolut liegende Ebene, die den Avatar füllt und ihre Kinder auf dessen Mittelpunkt zentriert. */
function Layer({ children }: { children: React.ReactNode }) {
  return <View pointerEvents="none" style={styles.layer}>{children}</View>;
}

/**
 * Ein Kasten, der sich um den Mittelpunkt dreht, mit seinem Inhalt oben mittig.
 * Der Radius ist die halbe Kastenbreite.
 *
 * Der naheliegende Weg (Teilchen per `translateY` verschieben und dann drehen) tut NICHT
 * dasselbe - gedreht würde um den Mittelpunkt des *Teilchens*, nicht um den des Avatars.
 */
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
```

Zwei Fallen, die uns schon Zeit gekostet haben und die du vermeiden musst:

- Die Effektebene braucht `zIndex: -1`, sonst liegt sie **über** dem Avatar statt dahinter.
- Ein Teilchen-Kasten braucht `justifyContent: 'flex-start'`. Mit `'center'` sitzt das
  Teilchen im Mittelpunkt des Avatars statt auf der Kreisbahn — es sieht dann so aus, als
  wäre der Effekt gar nicht da.

### 5.3 Die Rang-Rahmen (`src/ranking/rankFrameStyle.ts`)

```ts
export interface RankFrameStyle {
  tier: RankTier;              // 'BRONZE' | 'SILBER' | 'GOLD' | 'DIAMANT' | 'CHALLENGER'
  borderWidth: number;         // Ringdicke in px
  gradientColors: readonly [string, string, ...string[]];
  glow: boolean;               // zusätzlicher Leucht-Schatten
  pulse: boolean;              // leichtes Pulsieren
}
```

Für Aufgabe A darfst du dieses Interface **erweitern** (z. B. um `effectId` und um
Vorgabewerte für Stärke und Tempo). Bestehende Felder bleiben.

## 6. Der Werkstatt-Bildschirm

Es gibt bereits einen Bildschirm, der alle Effekte nebeneinander zeigt, mit Reglern für
Stärke (0–100 %), Tempo (0–100 %) und Größe (36–140 px). Jeder deiner Effekte muss über die
ganze Breite dieser Regler sinnvoll aussehen:

- **Stärke 0 %** — sichtbar, aber dezent. Nicht unsichtbar (sonst ist er von „Ohne" nicht
  zu unterscheiden und man weiß nicht, ob man ihn leise gestellt oder kaputt gemacht hat).
- **Stärke 100 %** — deutlich, aber der Avatar bleibt erkennbar. Der Effekt schmückt, er
  überdeckt nicht.
- **Tempo 0 %** — langsam und ruhig, nicht stehend.
- **Tempo 100 %** — schnell, aber nicht flimmernd. Nichts schneller als ~4 Hz; das ist
  unangenehm und für manche Menschen ein gesundheitliches Risiko.

## 7. Die Variationsmatrix — so werden die 20 wirklich verschieden

Jeder Effekt ist eine Kombination aus vier Achsen. **Keine zwei Effekte dürfen in
Geometrie *und* Bewegung *und* Rhythmus übereinstimmen.**

| Achse | Mögliche Werte |
|---|---|
| **Geometrie** | Ring · Bogensegmente · Teilchen · Strahlen · Splitter/Polygone · weicher Halo · Schweif · Punktewelle · Doppelring |
| **Bewegung** | Drehung · Skalierung · Umlauf auf Kreisbahn · Deckkraft · Staffel (Lauflicht) · Drift (geradlinig) |
| **Rhythmus** | gleichmäßig · atmend · Stakkato (kurze Blitze) · unregelmäßig · Welle (Phasenversatz) |
| **Richtung** | im Uhrzeigersinn · gegen den Uhrzeigersinn · nach außen · nach innen · aufwärts |

**Diese sechs existieren bereits** — baue sie nicht noch einmal, aber halte den Stil:

| Effekt | Was man sieht |
|---|---|
| `glow` | Weicher Schein rundherum, der mit dem Atem größer und kleiner wird. |
| `rotor` | Ein heller Punkt wandert einmal um den Ring — der „legendär"-Look. |
| `sparks` | Kleine Funken kreisen um den Rahmen, jeder mit eigenem Tempo. |
| `flames` | Züngelnde Flammenzungen rund um den Rahmen, jede in eigenem Takt. |
| `lightning` | Gezackte Blitze, die im unregelmäßigen Takt kurz aufblitzen. |
| `aura` | Große pulsierende Aura mit aufsteigenden Funken — Super-Saiyajin. |

**Mindestens 20 neue** kommen dazu. Diese Liste ist ein Startpunkt, kein Gefängnis —
ersetze, was du für schwach hältst, aber begründe es:

1. **Kometenschweif** — Lichtpunkt mit verblassendem Schweif, Umlauf, gleichmäßig
2. **Doppelrotor** — zwei Lichtläufe, gegenläufig auf zwei Radien
3. **Orbitringe** — zwei gekippte Ringe (Ellipsen durch `scaleY`), unterschiedliche Drehachsen
4. **Radar** — Ringe entstehen innen und laufen nach außen, verblassen dabei
5. **Implosion** — dasselbe rückwärts: Ringe von außen nach innen, verdichten sich
6. **Sternenstaub** — viele kleine Punkte, nur Deckkraft, unregelmäßig funkelnd, kein Umlauf
7. **Splitterkranz** — polygonale Scherben, ruckweise Drehung in 12 Schritten statt fließend
8. **Herzschlag** — Ring skaliert zweimal kurz hintereinander, dann Pause
9. **Neonflackern** — Ring mit unregelmäßigem Deckkraft-Einbruch wie eine defekte Leuchtröhre
10. **Lauflicht** — Ring aus Segmenten, die nacheinander aufleuchten (Marquee)
11. **Laola** — Ring aus Punkten, die nacheinander größer werden (Welle im Kreis)
12. **Strahlenkranz** — Strahlen nach außen, Länge und Deckkraft atmen gemeinsam
13. **Sonnenwind** — Strahlen drehen sich und flackern in einer Welle
14. **Eiskristalle** — Splitter, sehr langsame Gegendrehung, einzelnes Funkeln
15. **Rauchschleier** — großer weicher Halo, langsame Drehung plus seitliches Driften
16. **Elektrofeld** — kurze Bögen, die an wechselnden Stellen im Stakkato aufblitzen
17. **Goldregen** — Teilchen fallen von oben nach unten am Rahmen vorbei
18. **Schwerkraft** — Teilchen spiralen von außen nach innen und verblassen am Ring
19. **Prismaring** — Farbverlaufsring, der sich dreht; die Farben wandern rundum
20. **Schockwelle** — ein einzelner starker Ring alle paar Sekunden, sonst Ruhe
21. **Doppelhelix** — zwei Teilchenketten, um 180° versetzt, gegenläufig
22. **Atemkrone** — Bogensegmente oben, die wie eine Krone auf- und abschwingen
23. **Glutkern** — Halo, dessen Farbe von innen nach außen verläuft, atmend, sehr langsam
24. **Bruchring** — Ring mit Lücke, die einmal pro Durchlauf herumwandert

## 8. Was du abliefern musst

Eine einzige Markdown-Antwort mit diesen Teilen, in dieser Reihenfolge:

**Teil 1 — Übersichtstabelle.** Alle deine Effekte mit ihrer Einordnung in die vier Achsen
aus Abschnitt 7. Daran prüfen wir, dass sie wirklich verschieden sind. Spalten: `id` ·
Label · Geometrie · Bewegung · Rhythmus · Richtung · Anzahl bewegter Elemente.

**Teil 2 — Der Katalog.** Ein TypeScript-Block, fertig zum Einfügen in
`src/ranking/frameEffects.ts`: die erweiterte `FRAME_EFFECT_IDS`-Liste und die neuen
Einträge im `DEFINITIONS`-Objekt. `label` kurz (1–2 Wörter), `description` genau ein Satz
auf Deutsch, der beschreibt, *was man sieht* — nicht, wie es gemacht ist.

**Teil 3 — Die Rang-Rahmen.** Ein TypeScript-Block für `src/ranking/rankFrameStyle.ts`:
alle fünf Ränge, mit deiner Erweiterung des Interfaces. Dazu ein kurzer Absatz, warum die
fünf als Reihe funktionieren und welchen Effekt Gold, Diamant und Challenger bekommen.

**Teil 4 — Die Effekt-Komponenten.** Ein TypeScript-Block pro Effekt, im Muster der
bestehenden Komponenten aus Abschnitt 5.2. Jeder Block:

- heißt `function <Name>Effect({ settings, colors }: { settings: EffectSettings; colors: readonly [string, string, ...string[]] })`
- benutzt `useLoop`, `breathe`, `phases`, `Layer`, `Orbit` wo passend
- hat einen deutschen Kommentar darüber, der das *Warum* der gewählten Zahlen erklärt
- nennt die Anzahl bewegter Elemente und warum sie vertretbar ist

**Teil 5 — Der Schalter.** Die erweiterte `switch`-Anweisung in `FrameEffectLayer`.

**Teil 6 — Deine Einschätzung.** Ehrlich und kurz:

- Welche deiner Effekte sind bei 36 px vermutlich nicht mehr zu erkennen?
- Welche sind am teuersten und sollten in der Rangliste nicht benutzt werden?
- Was hättest du mit einer weiteren Bibliothek besser gelöst — und wie ist deine
  Umsetzung stattdessen? (Nur zur Information, **kein Paketvorschlag**.)

## 9. Abnahmekriterien

Wir übernehmen deine Lieferung nur, wenn alles davon zutrifft:

- [ ] Kein neues Paket, keine neuen Importe außer den vier erlaubten
- [ ] Jede Animation nutzt `useNativeDriver: true`; animiert werden nur `transform` und `opacity`
- [ ] Kein `Math.random()` im Renderpfad
- [ ] Keine hartkodierte Farbe in einem Effekt
- [ ] Jeder Effekt funktioniert mit 2 und mit 3 Farben
- [ ] Alle Maße leiten sich aus `settings.size` ab
- [ ] Höchstens 12 bewegte Elemente pro Effekt
- [ ] Nichts schneller als etwa 4 Hz
- [ ] Mindestens 20 neue Effekte, keine zwei mit derselben Achsen-Kombination
- [ ] Deutsche Kommentare, die das *Warum* erklären
- [ ] Bestehende Namen und Signaturen unverändert

## 10. Was du nicht tun sollst

- Keine Bilddateien, keine PNG/SVG-Dateien zum Herunterladen, keine Lottie-JSON.
- Keine Änderungen an der Zähl- oder Kameralogik. Rühre nichts außerhalb der genannten
  drei Dateien an.
- Keine Tests schreiben — die kommen bei uns dazu, weil sie an unser Test-Setup gebunden sind.
- Keine Erklärungen, wie React Native funktioniert. Wir kennen es. Schreib den Code.
- Nichts erfinden, was du nicht sicher weißt. Wenn ein Effekt unter diesen Regeln nicht
  umsetzbar ist, sag das in einem Satz und liefere stattdessen einen weiteren, der es ist.

---

# Nachfass-Befehl (Runde 2)

Zu benutzen, wenn aus Runde 1 eine *Spezifikation* zurückkam statt der Effekt-Komponenten.
Alles ab der Trennlinie kopieren.

---

Die Übergabe-Dokumentation ist angekommen und inhaltlich freigegeben. Die 24 Effekt-IDs,
die Beschreibungen, die Rangzuordnung und die Element-Zahlen sind übernommen — daran musst
du nichts mehr ändern.

**Was fehlt, ist der Code.** Ich brauche jetzt die Implementierung, nicht noch eine
Beschreibung. Liefere in einer Antwort:

1. **`src/ranking/frameEffects.ts`** — der vollständige, fertige Block: `FRAME_EFFECT_IDS`
   mit allen 31 Einträgen und das komplette `DEFINITIONS`-Objekt. `'none'` bleibt der
   **erste** Eintrag (ein Test prüft das), die bestehenden sechs behalten ihre Reihenfolge,
   die 24 neuen kommen dahinter.
2. **`src/ranking/rankFrameStyle.ts`** — der vollständige Block mit allen fünf Rängen und
   dem erweiterten Interface.
3. **Eine Komponente je neuem Effekt**, 24 Stück, im Muster von `GlowEffect`/`SparksEffect`.
   Signatur exakt:
   `function XEffect({ settings, colors }: { settings: EffectSettings; colors: readonly [string, string, ...string[]] })`
4. **Die erweiterte `switch`-Anweisung** in `FrameEffectLayer`.

Dabei sind acht Punkte zu beachten, die in der Übergabe noch fehlen:

**A. `effectSettings` am Rang hat kein `size`, `EffectSettings` schon.** Das ist richtig so
— die Größe kommt aus dem Anzeigeort (36 px Rangliste, 140 px Profil), nicht aus dem Rang.
Schreibe an der Stelle, wo beides zusammenkommt, einen Kommentar dazu, und liefere die
Zusammenführung mit:
`const settings: EffectSettings = { ...style.effectSettings, size };`

**B. Alles, was „wächst", „sich ausbreitet" oder „zusammenzieht", muss `scale` sein.**
Betrifft `radar`, `implosion`, `shockwave`, `rays`, `crown`, `ember`. Ein animierter
SVG-Radius (`r`), eine animierte `width`/`height` oder ein animierter `borderRadius`
funktionieren mit `useNativeDriver: true` **nicht** — sie werfen zur Laufzeit oder werden
still ignoriert. Ein Ring, der nach außen läuft, ist also ein `Animated.View` mit festem
Durchmesser und `transform: [{ scale }]`, dazu abnehmende `opacity`.

**C. „Unregelmäßig" ohne `Math.random()`.** Betrifft `neon`, `electro`, `stardust`,
`lightning`. Nimm eine Interpolation mit mehreren, ungleich verteilten Stützstellen, z. B.:
`loop.interpolate({ inputRange: [0, 0.07, 0.11, 0.38, 0.42, 0.61, 1], outputRange: [1, 0.2, 1, 0.35, 1, 0.15, 1] })`
Die Stützstellen sind fest im Code, damit das Flackern bei jedem Durchlauf gleich aussieht
und nicht bei jedem Renderdurchlauf neu gewürfelt wird.

**D. Der Werkstatt-Bildschirm zeigt alle Effekte gleichzeitig.** Nach deiner Element-Zählung
wären das **151 gleichzeitig laufende Animationen** in einer `ScrollView` ohne
Virtualisierung — auf einem Mittelklasse-Android wird das ruckeln. Liefere deshalb
zusätzlich:

- eine Konstante je Effekt, die seine Element-Zahl maschinenlesbar macht (z. B. Feld
  `movingParts: number` in `FrameEffectDefinition`), und
- einen Vorschlag in zwei Sätzen, wie der Werkstatt-Bildschirm das lösen sollte
  (Vorschlag von mir: nur der gerade ausgewählte Effekt läuft animiert, alle anderen als
  Standbild — aber sag, wenn du etwas Besseres siehst).

**E. Gold bekommt `glow`** — das ist der schlichteste der bestehenden Effekte und gleichzeitig
der Standard-Look. Die drei obersten Ränge sollen sich deutlich voneinander abheben. Schlage
für Gold **einen der neuen** Effekte vor (`comet` oder `marquee` wären meine Kandidaten) und
begründe in einem Satz. Diamant (`prism`) und Challenger (`aura`) bleiben.

**F. `FrameEffectId` ist ein aus `FRAME_EFFECT_IDS` abgeleiteter Union-Typ**, und
`DEFINITIONS` ist ein `Record<FrameEffectId, FrameEffectDefinition>`. Fehlt auch nur eine
Kennung, schlägt der Typecheck fehl. Liefere das Objekt vollständig, nicht mit „… usw.".

**G. Keine Auslassungen.** Kein `// ... wie oben`, kein „analog zu". Jede der 24 Komponenten
vollständig ausgeschrieben. Wenn die Antwort dafür zu lang wird, teile sie auf mehrere
Nachrichten auf und sag am Ende jeder, was noch kommt.

**H. Prüfe deinen eigenen Code vor dem Absenden** gegen diese Liste und schreibe unter jeden
Block eine Zeile, dass er sie einhält:
kein neues Paket · `useNativeDriver: true` · nur `transform`/`opacity` animiert · kein
`Math.random()` · keine hartkodierte Farbe · alle Maße aus `settings.size` · höchstens 12
bewegte Elemente · nichts schneller als ~4 Hz.

---

# Nachfass-Befehl (Runde 3): Struktur-Entscheidungen und „jetzt Code"

Zu benutzen, wenn die KI die Struktur klären will, statt zu liefern. Alles ab der
Trennlinie kopieren.

---

Deine Rückfragen sind beantwortet — hier sind die Entscheidungen, alle vier. Du musst nichts
mehr abwägen, nur noch umsetzen.

**1. Dateistruktur: ja, aber mit einer gemeinsamen Werkzeug-Datei.**

```
src/components/frame-effects/
  kit.tsx                  <- useLoop, breathe, phases, Layer, Orbit, styles (alles exportiert)
  CometEffect.tsx
  DoubleRotorEffect.tsx
  ... (24 Dateien, eine je Effekt)
```

`kit.tsx` ist nicht optional. Die Helfer liegen heute privat in `FrameEffectLayer.tsx`;
ohne gemeinsame Datei würde jede der 24 Dateien sie kopieren, und spätestens beim ersten
`styles.layer` mit fehlendem `zIndex: -1` liegt der Effekt über dem Avatar statt dahinter.
Das ist hier schon einmal passiert.

Jede Effekt-Datei: **benannter Export** (`export function CometEffect(...)`), Importe
vollständig, keine eigene Kopie eines Helfers.

**2. Die sechs bestehenden Effekte (`glow`, `rotor`, `sparks`, `flames`, `lightning`,
`aura`) fasst du nicht an.** Sie bleiben, wo sie sind. Sie laufen, sie sind abgenommen, und
ein Umzug gehört nicht in dieselbe Änderung wie 24 neue. Den Umzug machen wir danach
separat.

**3. `BrokenRingEffect`: kein `borderLeftColor: 'transparent'`.** Dein eigener Einwand ist
richtig. Nimm stattdessen ein SVG `<Circle>` mit **statischem** `strokeDasharray` — die
Lücke ist fest in den Strichmustern, es wird nichts daran animiert. Die Lücke wandert,
indem sich das ganze SVG per `transform: [{ rotate }]` dreht. Damit bleibt die Form statisch
und die Bewegung auf dem Native-Treiber, wie verlangt.

**4. `View` mit `borderRadius` ist für Kreise und Ringe ausdrücklich erwünscht**, nicht nur
geduldet. Es ist billiger als ein SVG-Mount, und bei bis zu 20 Rahmen gleichzeitig in der
Rangliste zählt das. Die Regel lautet:

- **Einfacher Kreis, Ring oder Punkt** → `View` mit `borderRadius`.
- **Alles andere** (Flammenzunge, Blitz, Splitter, Strahlenform, Verlauf) → statisches SVG.

Beides ist statisch; animiert wird in beiden Fällen nur die umgebende `Animated.View`.

## Und jetzt das Wichtigste

Du schreibst, die vorherigen Nachrichten enthielten die ausgearbeiteten Komponenten.
**Dann gib genau die aus — unverändert, als Entwurf, mit allen Mängeln, die du selbst
genannt hast.**

Schreibe sie nicht neu und poliere sie nicht. Fehlende Importe, unsaubere Ringe und
uneinheitliche Phasen korrigieren wir hier in Minuten; jede weitere Runde bei dir ist
dagegen eine neue Gelegenheit, dass sich Details gegenüber der abgenommenen Spezifikation
verschieben.

Aufteilen auf mehrere Nachrichten ist in Ordnung. Zwei Bedingungen:

- **Jede Datei vollständig.** Kein `// ... wie oben`, kein „analog zu CometEffect". Lieber
  sechs Dateien pro Nachricht als 24 angerissene.
- **Am Ende jeder Nachricht eine Zeile**, welche Dateien darin waren und welche noch fehlen.

Reihenfolge, damit ich früh einbauen kann: zuerst `kit.tsx`, dann die Effekte in der
Reihenfolge der Liste.
