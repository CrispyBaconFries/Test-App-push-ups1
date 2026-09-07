# Offene Punkte

Diese Datei ist das dauerhafte Gedächtnis für vereinbarte, aber noch nicht umgesetzte
Arbeiten. Sie überlebt jede Chat-Sitzung — was hier nicht steht, geht verloren.
Erledigtes wird gestrichen, nicht gelöscht, damit nachvollziehbar bleibt, was schon
untersucht wurde.

---

## 1. HIPS_SAGGING-Fehlalarm beheben

**Beobachtung von chris (07.09.2026):** Ganzkörper vollständig im Bild, gerader Rücken,
Blick geradeaus in die Kamera — trotzdem dauerhaft „Hüfte sackt durch".

Zwei konkrete Verdachtspunkte in `src/pose/formAnalysis.ts`, beide vor dem Kalibrieren zu
prüfen. **Nicht einfach die Schwelle hochdrehen** — das würde echte Formfehler mit
verstecken:

1. **Falscher Referenzpunkt.**
   ```ts
   const hipStraightnessDeg = hip && ankle ? angleAtPoint(shoulder, hip, ankle) : null;
   ```
   Beim Liegestütz steht der Fuß auf den Zehen, der Knöchel liegt also deutlich
   *unterhalb* der Körperlinie Schulter–Hüfte–Knie. Der Winkel Schulter–Hüfte–Knöchel ist
   damit auch bei perfekt geradem Rücken systematisch kleiner als 180° — und rutscht ohne
   jedes Zutun unter die Schwelle von 160°. Kandidat: **Schulter–Hüfte–Knie** messen (das
   Knie liegt auf der Körperlinie), den Knöchel nur noch für die Sichtbarkeitsprüfung
   verwenden.

2. **Live-Hinweis ignoriert die Richtung.**
   ```ts
   if (hipStraightnessDeg !== null && hipStraightnessDeg < t.minHipStraightnessDeg) {
     return 'HIPS_SAGGING';
   }
   ```
   `liveCue()` wertet das Vorzeichen von `hipSagDeviation` überhaupt nicht aus. Der
   Live-Hinweis kann deshalb **niemals** `HIPS_PIKING` melden und nennt jede Abweichung
   „sackt durch" — auch ein hochgestrecktes Gesäß. `finishRep()` macht es richtig
   (`acc.hipSagDeviationAtDeepest >= 0 ? 'HIPS_SAGGING' : 'HIPS_PIKING'`), `liveCue()`
   nicht. Das erklärt zusätzlich, warum die Meldung sich „falsch" anfühlt.

**Danach erst kalibrieren:** `minHipStraightnessDeg` (aktuell 160) und `minNeckAngleDeg`
(aktuell 140) anhand echter Aufzeichnungen von chris neu setzen. Werkzeug ist vorhanden:
`calibrationLogger` plus der DEV-Teilen-Knopf auf dem HomeScreen. Reihenfolge:
erst 1. und 2. beheben, dann neu aufzeichnen, dann Zahlen festlegen — sonst kalibriert man
auf einen Messfehler.

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
