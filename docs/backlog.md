# Offene Punkte

Diese Datei ist das dauerhafte Gedächtnis für vereinbarte, aber noch nicht umgesetzte
Arbeiten. Sie überlebt jede Chat-Sitzung — was hier nicht steht, geht verloren.
Erledigtes wird gestrichen, nicht gelöscht, damit nachvollziehbar bleibt, was schon
untersucht wurde.

---

## Reihenfolge (Stand 10.09.2026, abends)

Die Punkte unten sind nach Thema sortiert, nicht nach Reihenfolge. Was zuerst dran ist,
steht hier — geordnet danach, **was was blockiert**:

### Phase 0 — an chris' PC, heute Abend

Alles Weitere hängt daran. Ohne diese drei Rückmeldungen wäre jede weitere Arbeit an der
Erkennung oder der Optik geraten statt begründet.

1. **App bauen und die Zählung prüfen.** Zählt der Weg in die Position noch mit? Steht der
   Zähler nach dem Bestätigungston auf 0?
2. **Firebase einrichten** (`docs/firebase-einrichten.md`), Regeln deployen, im
   Regelsimulator gegenprüfen.
3. **Drei Dinge zurückmelden:** Kalibrierungsdaten teilen (enthält jetzt `baseline`, seit
   dem 10.09.2026 abends auch die gemessene Ruhe beim Halten — Rauschen, Wandern,
   Neustarts), die Effekt-Zeile aus der Werkstatt, und ob die Werkstatt mit sieben
   Effekten ruckelt.

   **Wichtig für Punkt 1:** Die Aufzeichnung vom 10.09.2026 vormittags/mittags enthält
   noch *keinen* `baseline`-Eintrag, stammt also aus der Zeit vor der Startpositions-Sperre.
   Ob der Weg in die Position noch mitgezählt wird, lässt sich daran nicht ablesen — dafür
   braucht es eine frische Aufzeichnung nach diesem Build.

### Phase 1 — sobald die Daten da sind

4. **Schwellwerte gegen die neue Aufzeichnung prüfen** — Punkt 1.1 unten, plus die
   Gegenprobe zu den 20°/25° aus Punkt 2. Braucht Aufzeichnungen mit `kind: 'baseline'`.
5. **Den gewählten Effekt einbauen**, wo er hingehört (Rangliste, Profil, Duell) — Punkt 5.
6. **Zu zweit testen:** Freundschaftsspiel, Ranked, Länderspiel-Wertung. Braucht Firebase
   und eine zweite Person.

### Phase 2 — Design-Runde

7. **Faktoren festlegen** (`SPACING_SCALE`, `RADIUS_SCALE`, `FONT_SCALE`) — im Browser
   vergleichen, nicht im Kopf entscheiden.
8. **Werte vereinheitlichen**, falls gewünscht (Kartenrundungen 14/16/18/20 auf einen Wert,
   strengere Abstandsstufung) — Punkt 3.
9. **Avatar-Motive** per Bild-KI, Prompt steht in `docs/grafik-plan.md` — Punkt 5.3.

### Phase 3 — Erkennung weiter verbessern

10. **Tiefenmaß ohne Unterarm** (Schulterhöhe statt Ellbogenwinkel) — Punkt 1.2. Die
    Schwelle selbst ist am 10.09.2026 auf 105° korrigiert; offen ist die Kennzahl.
11. Sichtbarkeit durch die native Bridge (Patch) — Punkt 1.3. Braucht Prebuild.
12. Sitzungskontext erfassen — Punkt 1.4.
13. Frame-Zeitreihen statt nur Kennzahlen — Punkt 1.5.

### Phase 4 — vor einer Veröffentlichung

14. **Firebase App Check** — Punkt 4. Braucht einen Play-Store-Eintrag.
15. **Eigener Release-Keystore** und dessen SHA-1 in Firebase (siehe README,
    „Play-Store-Veröffentlichung" und `docs/firebase-einrichten.md`, Schritt 4).
16. **Danksagungen-Bildschirm**, falls Grafiken unter CC BY verwendet werden.

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

2. ~~**Produktentscheidung `goodDepthElbowDeg` (95°).**~~ **Erledigt am 10.09.2026 —
   und die Einschätzung darin war falsch.** Es *ist* ein Messfehler: Innerhalb einer
   einzigen Sitzung (09.09.2026, 20:12 Uhr) streuen 24 Wiederholungen am Stück zwischen
   91° und 139°. Niemand ändert seine Tiefe im selben Satz um 48°. Am Tiefpunkt zeigt der
   Unterarm fast auf die Kamera zu, und dort ist MediaPipes Tiefenschätzung am
   schlechtesten. Schwelle auf 105° (85 % → 17 % Meldungen in den jüngsten Sitzungen),
   Begründung im README.

   **Offen bleibt der eigentliche Punkt:** ein Tiefenmaß, das nicht am Unterarm hängt —
   etwa die Schulterhöhe im Verhältnis zur Armlänge (Schulter–Ellbogen), die von der
   Unterarm-Verkürzung unabhängig ist. Erst damit ist „tiefer gehen" wieder eine Aussage
   über die Ausführung statt über die Kameraperspektive. Braucht Zeitreihen (Punkt 5).

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

## 2. Kalibrierung in der Startposition — ERLEDIGT (10.09.2026)

Umgesetzt als `src/pose/startPosition.ts` plus `StartPositionOverlay`, nicht als eigener
Screen und **ohne** den ursprünglich geplanten Kopf-Rahmen. Ausführlich im README
(„Startposition: gezählt wird erst, wenn die Position steht" und „Persönliche Schwellwerte
aus der Grundhaltung"). Kurz:

- Gezählt wird erst, wenn die obere Position **zwei Sekunden ruhig gehalten** wurde. Damit
  ist der Weg in die Position keine Wiederholung mehr — er führt zwar durch die Haltung
  hindurch, bleibt aber nie darin stehen.
- Dieselben zwei Sekunden liefern die persönliche Grundhaltung (Schulter–Hüfte–Knie,
  Ohr–Schulter–Hüfte). Daraus kommen persönliche Schwellen, die nur lockern, nie
  verschärfen.
- Der Kopf-Rahmen ist bewusst gestrichen: Er hängt an Bildschirmkoordinaten (kippt das
  Handy, stimmt er nicht mehr) und verlangt, aus zwei Metern Entfernung Details auf einem
  Handy am Boden zu erkennen. Die Trennung der Rollen, um die es dabei ging — Referenz
  bleibt körperrelativ aus `worldLandmarks` — gilt in der umgesetzten Lösung ohnehin.

**Offen bleibt** die Gegenprobe mit echten Daten: Ob 20° (Hüfte) und 25° (Nacken) unter der
Grundhaltung die richtigen Abstände sind, lässt sich erst sagen, wenn Aufzeichnungen mit
`kind: 'baseline'` vorliegen. `npm run analyze:reps` gibt die Grundhaltung dafür bereits
mit aus. Ebenso offen: Ob sich der gemessene Ellbogenwinkel der oberen Position
(`topElbowAngleDeg`) lohnt, um `elbowUpDeg` zu personalisieren — er wird deshalb schon
protokolliert, aber noch nicht verwendet.

## 3. Schneller Design-/Layout-Workflow

chris will Design, Position und Darstellung schnell und selbst ändern können. Vorschläge,
morgen abzustimmen:

| | Ansatz | Deckt ab | Aufwand |
|---|---|---|---|
| a | ~~**Web-Vorschau**~~ — **erledigt am 10.09.2026**: `npm run web`, siehe README „Web-Vorschau" | alle Screens, **auch** die Anzeigen über dem Kamerabild (Attrappe statt Kamera) | erledigt |
| b | ~~**Zentrale `src/theme/layout.ts`**~~ — **erledigt am 10.09.2026**: 626 Werte aus 20 StyleSheets laufen durch `space()`/`radius()`/`font()`, drei Faktoren steuern die ganze App. Siehe README „Ein Ort für Abstände" | alles | erledigt |
| c | **DEV-Layout-Modus in der App** — Overlay-Elemente per Finger verschieben, Werte als JSON exportieren und in `layout.ts` übernehmen | nur die Kamera-Overlays, die (a) nicht darstellen kann | mittel |
| d | **DEV-Screen-Galerie** mit Mockdaten — jeden Screen-Zustand direkt anspringen, ohne ihn erspielen zu müssen | alle Screens | mittel |

Empfehlung: erst (a) + (b), das deckt den Großteil der Oberfläche mit dem geringsten
Aufwand ab.

**(a) ist erledigt und hat sich sofort bezahlt gemacht** — zwei echte Fehler in der
Effekt-Werkstatt, die weder Typprüfung noch Tests finden konnten (siehe README). Die
Annahme in der Zeile für (c) hat sich dabei als falsch erwiesen: Die Web-Vorschau zeigt die
Kamera-Overlays sehr wohl, weil die Kamera-Attrappe eine ruhige dunkle Fläche rendert und
alles darüber echt bleibt. **(c) ist damit vorerst hinfällig** — es bliebe nur der Wunsch,
Elemente per Finger zu verschieben statt Zahlen zu ändern, und dafür ist (b) der kürzere Weg.

**(b) ist ebenfalls erledigt** und wurde pixelgenau gegen den Stand davor geprüft (sechs von
acht Bildschirmen exakt identisch, die zwei Abweichungen sind Animation und Countdown).

**Offen bleibt die eigentliche Design-Runde**, und die gehört chris: Welche Faktoren sollen
gelten, und sollen die heute 14 verschiedenen Abstandswerte auf eine strengere Stufung
zusammengezogen werden? Beides ist jetzt eine Frage von Ausprobieren im Browser statt von
Umbauarbeiten. **(d) DEV-Screen-Galerie** wäre der nächste sinnvolle Baustein, falls das
Erspielen bestimmter Zustände (frisch installiert, lange Streak, volle Rangliste) beim
Vergleichen stört.

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

## 5. Grafik: Icons, Rahmen, Effekte

Eigenes Dokument: [`docs/grafik-plan.md`](grafik-plan.md). Kurz:

1. ~~**Effekt-Werkstatt** als DEV-Bildschirm~~ — **erledigt am 10.09.2026**. Sieben Effekte
   nebeneinander, Regler für Stärke/Tempo/Größe, Umschalter für Rang und Theme, Auswahl als
   eine Zeile zum Weitergeben. Siehe README, „Effekt-Werkstatt". Keine neue native
   Abhängigkeit — auch der Schieberegler ist selbst gebaut.
   **Offen:** chris muss die Effekte auf dem Gerät ansehen und entscheiden, welcher wohin
   kommt (Rangliste, Profil, Duell) und mit welchen Werten. Bis dahin ist die Werkstatt ein
   Werkzeug und ändert am Aussehen der App nichts.
2. ~~**Zentrale `src/theme/layout.ts`**~~ — **erledigt am 10.09.2026**. 626 Werte laufen
   durch `space()`/`radius()`/`font()`, drei Faktoren steuern die ganze App; pixelgenau
   gegen den Stand davor geprüft. Siehe README, „Ein Ort für Abstände".
   **Offen:** Welche Faktoren gelten sollen — das ist die Design-Runde, und die gehört chris.
3. **Erst danach Bilddateien**: acht Avatar-Motive per Bild-KI (fertiger Prompt steht im
   Dokument), Abzeichen und Boss-Motive aus CC0-Sätzen (kenney.nl) oder game-icons.net —
   Letzteres nur zusammen mit einem Danksagungen-Bildschirm, CC BY verlangt Namensnennung.

Lottie (`lottie-react-native`) bleibt bewusst Reserve für die zwei, drei Effekte, bei denen
der Code-Weg sichtbar schlechter aussieht — es ist eine neue native Abhängigkeit und damit
ein neuer Prebuild samt Gradle-Risiko.

## 6. Diagnose aus der Vorzeige-App — Stand 10.09.2026

Erledigt: **Fehlergrenze und Fehlerbericht** (siehe README, „Wenn etwas abstürzt"). Ein
Absturz ist damit keine weiße Fläche mehr, sondern eine teilbare Nachricht.

Damit gibt es drei Kanäle aus der App heraus, und alle drei brauchen chris' aktives Teilen:

| Kanal | Wofür | Knopf |
|---|---|---|
| Kalibrier-Log | Wiederholungen, verworfene Bewegungen, Grundhaltung | 🧪 immer sichtbar |
| Fehlerbericht | Abstürze und gefangene Fehler | ⚠️ nur wenn etwas aufgezeichnet wurde |
| Effekt-Werkstatt | die gewählte Optik als eine Zeile | 🎨 über den Startbildschirm |

**Noch offen:** Ein Fehler, der die App beendet, *bevor* AsyncStorage geschrieben hat, geht
verloren — bei einem nativen Absturz (MediaPipe, Kamera) hilft nur ein Absturzberichts-SDK,
und das wäre eine neue native Abhängigkeit. Bisher gab es keinen solchen Fall; erst wenn
einer auftritt, lohnt die Diskussion.
