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

### ✅ Erledigt (10.09.2026)

- **Hüftwinkel über das Knie statt über den Knöchel.** Der Knöchel liegt beim Liegestütz
  auf den Zehen und damit unter der Körperlinie; über ihn gemessen war der Winkel auch bei
  geradem Rücken systematisch zu klein. Regressionstest baut genau diesen Fall nach.
- **Vorzeichen im Live-Hinweis.** `liveCue()` kann jetzt `HIPS_PIKING` melden und ist mit
  `finishRep()` einig.
- **Nacken-Schwelle aus 144 Messungen kalibriert:** 140° → 115°. Markiert statt 93 % noch
  12,5 % und lässt eine saubere Serie (126–140°) mit 11° Luft durch.

### ✅ Erledigt (10.09.2026, zweite Runde)

- **Verschluckte Wiederholungen behoben.** 14 gemacht, 8 gezählt: Wer oben nicht ganz
  durchstreckt, ließ mehrere Liegestütze zu einem überlangen „Rep" verschmelzen, der am
  Zeitlimit verworfen wurde. Abschluss jetzt zusätzlich über den Umkehrpunkt
  (`repReversalToleranceDeg`). `maxRepDurationMs` 8 s → 12 s.
- **Hüft-Schwelle kalibriert:** 160° → 145°, jetzt aus knie-basierten Messungen (saubere
  Wiederholungen 152–169°, echte Abweichung 97°). 7 von 8 halten sie ein statt 2.
- **`DiscardedRep` trägt den Ellbogen-Winkelbereich mit**, sonst ist ein `TOO_LONG` nicht
  deutbar.

### ✅ Erledigt (10.09.2026, dritte Runde)

- **Positionswechsel zählen nicht mehr mit.** Der Gang in die Stützposition und das
  Aufstehen danach wurden als Wiederholungen gezählt (3 in einer Sitzung). Neuer
  Verwurfsgrund `NOT_A_PLANK`, der nur greift, wenn weder Stützposition noch Tiefe
  vorliegen — eine echte Wiederholung mit schlechter Hüfte bleibt gezählt.
- **Bestätigt aus der Aufzeichnung vom 09.09.2026, 20:12 Uhr:** Die
  Umkehrpunkt-Erkennung wirkt (24 gezählt, keine verschluckten Abschnitte mehr),
  `HEAD_MISALIGNED` liegt bei 1 von 24, die Hüfte bei 158–169°, Formnoten im Median 93.

### Noch offen

1. **`minHipStraightnessDeg` (160°) neu kalibrieren.** Bewusst unverändert gelassen: Die
   Kennzahl misst seit dem 10.09.2026 etwas anderes (Knie statt Knöchel), alte
   Aufzeichnungen taugen dafür also nicht. Die nächste Aufzeichnung sagt, ob 160° jetzt
   erreichbar ist. Messung und Schwelle im selben Schritt zu ändern würde das Ergebnis
   unlesbar machen.

2. **Produktentscheidung `goodDepthElbowDeg` (95°).** Kein Messfehler — die gemessene
   Tiefe liegt im Median bei 101°, also wirklich knapp oberhalb des rechten Winkels. Die
   Frage ist, ob die App bei 95 % der Wiederholungen „tiefer gehen" sagen soll oder ob
   eine mildere Stufe (z. B. Hinweis erst ab 110°) motivierender ist.

3. **Sichtbarkeit durchreichen.** `react-native-mediapipe` verwirft MediaPipes
   Konfidenzwerte im nativen Bridge-Code (`ConvertHelpers.kt`); `visibility` ist bei uns
   auf jedem Frame `undefined`. Solange das so bleibt, können schlechte Landmarken gar
   nicht aussortiert werden — `minTrackedFrameRatio` greift derzeit nur, wenn ein Landmark
   ganz fehlt. Für dieses Paket gibt es bereits einen Patch, in den das mit hineinkann.

4. **Sitzungskontext erfassen** — Person, Abstand, Handyhöhe, frontal oder seitlich, und
   eine Selbsteinschätzung nach dem Satz. Ohne das mischen sich mehrere Personen aus
   unbekannten Perspektiven in einem Datensatz.

5. **Zeitreihen statt nur Zusammenfassungen** — vier Zahlen pro Wiederholung reichen nicht,
   um „kurzer Erkennungsaussetzer" von „echtes Durchhängen" zu unterscheiden.

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

## 4. Firebase App Check (Play Integrity)

Aus der Sicherheitsdurchsicht vom 10.09.2026 (siehe README, „Sicherheit: was die Regeln
erzwingen"). Die Security Rules erzwingen jetzt, dass Werte sich nur so verändern, wie die
App sie verändert — aber sie können nicht prüfen, **wer** schreibt. Ein manipulierter
Client, der sich an die erlaubten Schrittweiten hält, kommt weiterhin durch.

App Check schließt genau diese Lücke: Firebase lehnt Anfragen ab, die nicht aus der
echten, unveränderten App aus dem Play Store kommen (Play Integrity als Anbieter). Kein
Server, keine Cloud Function nötig — Konsolen-Einrichtung plus ein Abhängigkeits-Paket
(`@react-native-firebase/app-check`).

Bewusst als eigener Schritt und nicht nebenbei erledigt: Eine unvollständige Einrichtung
blockiert **alle** Firebase-Anfragen der App. Der Weg wäre: erst im Erzwingungs-Modus
„nur überwachen" laufen lassen, in der Konsole nachsehen, dass die echten Anfragen als
gültig ankommen, und erst dann erzwingen. Dazu braucht es einen Play-Store-Eintrag (auch
interner Test reicht) — also frühestens sinnvoll, wenn die App dort landet.
