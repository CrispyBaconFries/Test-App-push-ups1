# Offene Punkte

Diese Datei ist das dauerhafte Gedächtnis für vereinbarte, aber noch nicht umgesetzte
Arbeiten. Sie überlebt jede Chat-Sitzung — was hier nicht steht, geht verloren.
Erledigtes wird gestrichen, nicht gelöscht, damit nachvollziehbar bleibt, was schon
untersucht wurde.

---

## 1. Fehlalarme bei Hüfte und Kopf

**Beobachtung von chris (07.–09.09.2026):** Ganzkörper vollständig im Bild, gerader
Rücken, Blick geradeaus in die Kamera — trotzdem dauerhaft „Hüfte sackt durch" und
„Kopfhaltung". Bestätigt durch 124 aufgezeichnete Wiederholungen aus 10 Sitzungen
(`docs/messdaten/2026-09-09-reps.json`, auswertbar mit `npm run analyze:reps`):
`HEAD_MISALIGNED` schlägt bei **93,5 %** an, irgendeine Hüftmeldung bei **91 %**.

### ✅ Erledigt (09.09.2026)

- **Robuste Kennzahlen statt schlechtestem Einzelframe.** Hüfte/Nacken/Flare als
  Perzentil, Tiefe als n-kleinster Wert — siehe `src/pose/stats.ts` und README,
  „Warum die Formwerte keine Extremwerte mehr sind".
- **Plausibilitätsprüfung der Segmentierung.** Zu kurze, zu lange und schlecht
  getrackte Bewegungen werden verworfen statt gezählt (19 % des alten Datensatzes).
- **Verworfene Bewegungen werden mitprotokolliert** (`discardedRep`,
  `getDiscardCounts()`, Eintragstyp `discarded` im Kalibrier-Log).
- **Auswertungsskript** `scripts/analyze-rep-log.js`, damit jede weitere Aufzeichnung
  identisch ausgewertet wird.

### Messung nach der Umstellung (Aufzeichnung vom 09.09.2026, 18:48 Uhr, 20 Wiederholungen)

20 gemacht, 20 gezählt, 0 verworfen — die Plausibilitätsprüfung hat nichts Legitimes
weggeworfen. Die Streubreite der Messwerte ist zusammengebrochen, die anatomisch
unmöglichen Werte sind vollständig weg:

| | vorher (124 Wdh.) | nachher (20 Wdh.) |
|---|---|---|
| Hüfte | 7–169° (Spanne 162°) | **133–157° (Spanne 24°)** |
| Tiefe | 12–138° (Spanne 126°) | **94–114° (Spanne 20°)** |
| Flare | 29–176° (Spanne 147°) | **50–60° (Spanne 10°)** |
| Nacken | 59–158° (Spanne 99°) | **126–140° (Spanne 14°)** |
| Hüft-Richtungswechsel | 43 % | **21 %** |

Damit ist die Datenlage für die Schwellen sauber. Die verbliebenen Fehlalarme sind jetzt
eindeutig den Punkten unten zuzuordnen und nicht mehr dem Messrauschen: In dieser Sitzung
liegt der Nackenwinkel zwischen 126° und 140° bei einer Schwelle von 140° (eingehalten:
1 von 20), die Hüftgerade zwischen 148° und 155° bei einer Schwelle von 160°
(eingehalten: **0 von 20**). Beide Schwellen liegen komplett außerhalb des Bereichs, den
ein Mensch in dieser Kameraperspektive überhaupt erreichen kann.

### Noch offen

1. **Falscher Referenzpunkt bei der Hüfte.**
   ```ts
   const hipStraightnessDeg = hip && ankle ? angleAtPoint(shoulder, hip, ankle) : null;
   ```
   Beim Liegestütz steht der Fuß auf den Zehen, der Knöchel liegt also deutlich
   *unterhalb* der Körperlinie Schulter–Hüfte–Knie. Der Winkel Schulter–Hüfte–Knöchel ist
   damit auch bei perfekt geradem Rücken systematisch kleiner als 180°. Kandidat:
   **Schulter–Hüfte–Knie** messen, den Knöchel nur noch für die Sichtbarkeitsprüfung
   verwenden.

2. **Der Live-Hinweis ignoriert die Richtung.**
   ```ts
   if (hipStraightnessDeg !== null && hipStraightnessDeg < t.minHipStraightnessDeg) {
     return 'HIPS_SAGGING';
   }
   ```
   `liveCue()` wertet das Vorzeichen von `hipSagDeviation` nicht aus, kann deshalb
   **niemals** `HIPS_PIKING` melden und nennt jede Abweichung „sackt durch".
   `finishRep()` macht es richtig, `liveCue()` nicht.

3. **Schwellen neu setzen** — `minHipStraightnessDeg` (160) und `minNeckAngleDeg` (140)
   liegen beide oberhalb des 90. Perzentils aller je gemessenen Werte. Aber erst nach
   1. und 2. **und** nach einer neuen Aufzeichnung, sonst kalibriert man auf den
   Messfehler.

4. **Sichtbarkeit durchreichen.** `react-native-mediapipe` verwirft MediaPipes
   Konfidenzwerte im nativen Bridge-Code (`ConvertHelpers.kt`); `visibility` ist bei uns
   auf jedem Frame `undefined`. Solange das so bleibt, können schlechte Landmarken gar
   nicht aussortiert werden — `minTrackedFrameRatio` greift derzeit nur, wenn ein
   Landmark ganz fehlt. Für dieses Paket gibt es bereits einen Patch, in den das mit
   hineinkann.

5. **Sitzungskontext erfassen** — Person, Abstand, Handyhöhe, frontal oder seitlich, und
   eine Selbsteinschätzung nach dem Satz. Ohne das mischen sich mehrere Personen aus
   unbekannten Perspektiven in einem Datensatz; genau daher stammt die enorme Streuung
   (Flare-Median je Sitzung zwischen 58° und 101° — das ist die Kameraperspektive, nicht
   die Technik).

6. **Zeitreihen statt nur Zusammenfassungen** — vier Zahlen pro Wiederholung reichen
   nicht, um „kurzer Erkennungsaussetzer" von „echtes Durchhängen" zu unterscheiden.

## 2. Kalibrierung mit Kopf-Rahmen vor dem Training

Von chris bestätigt. Vor dem Start positioniert sich die Person so, dass der Kopf in einem
kopfförmigen Rahmen liegt.

Wichtig ist die **Trennung der beiden Rollen**: Der Rahmen ist Positionierungshilfe und
Auslöser für die Grundlinien-Messung. Die eigentliche Zählreferenz bleibt
**körperrelativ** (Verhältnisse aus `worldLandmarks`) und darf *nicht* an
Bildschirmkoordinaten hängen — sonst bricht die Erkennung, sobald das Handy auch nur
leicht verrutscht.

Geplant: `src/pose/calibration.ts` plus eigener Screen vor dem WorkoutScreen. Die dort
gemessene Grundlinie (Schulter–Hüfte–Knie-Winkel im Stütz, Armlänge, Körperhöhe) speist
persönliche Schwellen, statt für alle die globalen `DEFAULT_THRESHOLDS` zu benutzen. Das
löst Punkt 1 langfristig auf die saubere Art.

## 3. Schneller Design-/Layout-Workflow

chris will Design, Position und Darstellung schnell und selbst ändern können. Vorschläge,
morgen abzustimmen:

| | Ansatz | Deckt ab | Aufwand |
|---|---|---|---|
| a | **Web-Vorschau** via `npx expo start --web` — `react-native-web` und `react-dom` sind bereits Abhängigkeiten | alle Screens ohne Kamera, Sofort-Reload im PC-Browser inkl. DevTools | gering |
| b | **Zentrale `src/theme/layout.ts`** — alle Positionen, Größen, Abstände an einer Stelle statt in 14 StyleSheets | alles | gering–mittel |
| c | **DEV-Layout-Modus in der App** — Overlay-Elemente per Finger verschieben, Werte als JSON exportieren und in `layout.ts` übernehmen | nur die Kamera-Overlays, die (a) nicht darstellen kann | mittel |
| d | **DEV-Screen-Galerie** mit Mockdaten — jeden Screen-Zustand direkt anspringen, ohne ihn erspielen zu müssen | alle Screens | mittel |

Empfehlung: erst (a) + (b), das deckt den Großteil der Oberfläche mit dem geringsten
Aufwand ab. (c) nur für WorkoutScreen, BossFightScreen und DuelScreen — dort geht es um
Overlays über dem Kamerabild, die eine Web-Vorschau prinzipbedingt nicht zeigen kann.
