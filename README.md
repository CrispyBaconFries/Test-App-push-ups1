# Liegestütz Coach

Eine React-Native/Expo-App, die über die **Frontkamera** die Liegestütz-Form in Echtzeit
analysiert: ein Strichlinien-Skelett (Kopf, Torso, Arme, Ellenbogen, Hüfte) wird über das
Kamerabild gelegt, live mitbewegt, und jede Wiederholung wird automatisch gezählt und
bezüglich sauberer Ausführung bewertet.

Aufbau: Handy vor sich auf den Boden stellen (Frontkamera zeigt zum Nutzer), App starten,
Liegestütze machen — die App zählt Wiederholungen, erkennt typische Fehler (Hüfte sackt
durch, zu wenig Tiefe, Ellenbogen zu weit abgespreizt, Kopf/Nacken nicht neutral) und gibt
sofortiges visuelles Feedback plus einen Form-Score pro Wiederholung.

## Architektur

| Layer | Tech |
|---|---|
| App-Framework | Expo (React Native, TypeScript), Custom Dev Client |
| Kamera | `react-native-vision-camera` (Frame Processors) |
| Pose-Erkennung | `react-native-mediapipe` → Google MediaPipe **Pose Landmarker** (33 BlazePose-Punkte, on-device, GPU-delegiert) |
| Skelett-Overlay | `react-native-svg`, gezeichnet über `ViewCoordinator.convertPoint` (korrekte Zuordnung Kamera-Frame → Bildschirm, inkl. Spiegelung/Rotation/Crop) |
| Formanalyse | reines TypeScript, kein UI-/Native-Code (`src/pose/formAnalysis.ts`) — dadurch mit Jest unit-testbar |
| Persistenz | `@react-native-async-storage/async-storage` (lokal, gerätespezifisch) |
| Navigation | `@react-navigation/native-stack` |
| Gamification | Punkte/Level jetzt, Grundgerüst für Challenges/Matches (siehe Roadmap) |

### Wichtig: kein Expo Go

Diese App nutzt native Module (Kamera-Frame-Processors, MediaPipe), die in **Expo Go
nicht laufen**. Es wird ein **Custom Dev Client** benötigt (`expo-dev-client`,
`expo prebuild` + nativer Build). Siehe Setup unten.

## Wie die Formanalyse funktioniert

`src/pose/formAnalysis.ts` (`PushUpAnalyzer`) bekommt pro Kamera-Frame die von MediaPipe
gelieferten **`worldLandmarks`** (metrische 3D-Koordinaten, hüft-zentriert — deutlich
robuster gegenüber Kameraperspektive als die 2D-Bildkoordinaten, die nur fürs Zeichnen des
Overlays verwendet werden).

Daraus werden pro Frame vier Winkel berechnet (jeweils für die Körperseite, die MediaPipe
gerade zuverlässiger sieht):

- **Ellenbogenwinkel** (Schulter–Ellenbogen–Handgelenk) → steuert die Zustandsmaschine
  `up → descending → down → ascending → up`, die eine Wiederholung erkennt.
- **Hüft-/Rumpfgeradheit** (Schulter–Hüfte–Knöchel) → erkennt durchhängende Hüfte oder
  einen zu hohen Po ("Dach").
- **Ellenbogen-Abspreizung** (Ellenbogen–Schulter–Hüfte) → erkennt zu weit vom Körper
  abgespreizte Ellenbogen.
- **Nacken-/Kopfhaltung** (Ohr–Schulter–Hüfte) → erkennt eine nicht neutrale Kopfhaltung.

Eine Wiederholung wird gezählt, sobald der Arm die Abwärtsbewegung wirklich begonnen hat
(Ellenbogenwinkel unter `elbowAttemptDeg`, Standard 140°) und danach wieder vollständig
gestreckt wird (`elbowUpDeg`, Standard 160°) — bewusst **unabhängig davon, wie tief** die
Wiederholung war. Auch eine zu flache Wiederholung zählt also als Versuch, wird aber mit
niedrigem Form-Score und der Rückmeldung "Tiefer gehen" bewertet. Nur eine winzige
Bewegung, die nie über die Attempt-Schwelle hinauskommt, wird als Rauschen verworfen.

Der Form-Score (0–100) startet bei 100 und wird für jeden erkannten Fehler anteilig
reduziert; alle Schwellenwerte liegen gesammelt in `DEFAULT_THRESHOLDS` und lassen sich
leicht anpassen/kalibrieren.

## Setup

```bash
npm install
npm run model:download   # lädt das MediaPipe-Modell (~5.7 MB, wird nicht committed)
npm run prebuild          # erzeugt ios/ und android/ (Expo Prebuild)
npm run android            # oder: npm run ios (braucht macOS + Xcode)
```

Für den täglichen Metro-Server danach: `npm run start` (startet mit `--dev-client`).

Das Pose-Landmarker-Modell (`pose_landmarker_lite.task`, Google/MediaPipe) wird **nicht**
im Repo mitgeführt (Binärdatei, ~5.7 MB) und stattdessen per Skript geladen
(`scripts/download-pose-model.js`, offizielle Google-Storage-URL). Der Expo-Config-Plugin
`plugins/withPoseLandmarkerModel.js` bündelt die Datei beim `expo prebuild` automatisch in
die iOS- und Android-Projekte (Xcode "Copy Bundle Resources" bzw.
`android/app/src/main/assets/`) — bricht mit einer klaren Fehlermeldung ab, falls die Datei
vorher nicht heruntergeladen wurde.

Vor einem Store-Release `app.json` anpassen: `ios.bundleIdentifier` /
`android.package` sind aktuell Platzhalter (`com.pushupcoach.app`).

### Tests & Typecheck

```bash
npm test          # Jest — Unit-Tests für Rep-Zählung, Form-Scoring, Punkte/Level
npm run typecheck # tsc --noEmit
```

Die Kernlogik (`src/pose/formAnalysis.ts`, `src/gamification/points.ts`) ist bewusst
UI- und Native-Code-frei gehalten, damit sie ganz ohne Gerät/Simulator getestet werden
kann. Ein synthetischer Pose-Builder (`src/pose/testing/poseBuilder.ts`) erzeugt dafür
33-Punkt-Skelette mit exakt kontrollierten Winkeln.

**Hinweis zur Verifikation:** Dieses Projekt wurde in einer Cloud-Sandbox ohne
Kamera/Simulator/echtes Gerät entwickelt. TypeScript-Kompilierung und alle Unit-Tests
laufen grün und die Integration wurde sorgfältig gegen den tatsächlich installierten
Quellcode von `react-native-vision-camera` und `react-native-mediapipe` abgeglichen
(Native-API-Kompatibilität, `ViewCoordinator`-Koordinatentransformation,
Modell-Asset-Auflösung). Ein echter On-Device-Testlauf (Kamera-Permission-Flow, Tracking-
Qualität, Performance) steht noch aus und sollte vor einem Release erfolgen.

## Projektstruktur

```
src/
  pose/
    blazePoseLandmarks.ts   33-Punkt-Indizes (BlazePose-Standard, kein Native-Import)
    landmarks.ts             Winkel-/Sichtbarkeits-Hilfsfunktionen
    formAnalysis.ts           Zustandsmaschine + Form-Scoring (PushUpAnalyzer)
    feedbackText.ts            deutsche Texte für Form-Hinweise
    testing/poseBuilder.ts     synthetischer Pose-Generator für Tests
  components/
    SkeletonOverlay.tsx        SVG-Strichmodell über der Kamera
    RepHud.tsx                  Rep-Zähler, Score, Live-Hinweis
  screens/
    HomeScreen.tsx, WorkoutScreen.tsx, SummaryScreen.tsx, HistoryScreen.tsx
  storage/workoutStorage.ts    lokale Session-Historie (AsyncStorage)
  gamification/points.ts        Punkte-/Level-Berechnung
  navigation/RootNavigator.tsx
plugins/withPoseLandmarkerModel.js   Config-Plugin: bündelt das .task-Modell nativ
scripts/download-pose-model.js        lädt das Modell herunter
```

## Roadmap (spielerische Weiterentwicklung)

Die App ist bewusst so gebaut, dass jede Wiederholung als `RepResult` (Form-Score +
konkrete Fehler) vorliegt und in `WorkoutSession`s gebündelt lokal gespeichert wird — das
ist die Grundlage für alles Folgende:

1. **Punkte & Level** (bereits umgesetzt, `src/gamification/points.ts`): Form-Score
   bestimmt Punkte pro Wiederholung, mit Bonus für perfekte Ausführung.
2. **Tägliche/wöchentliche Challenges**: z. B. "Heute 30 saubere Liegestütze" — braucht
   ein Challenge-Datenmodell (Ziel, Zeitraum, Fortschritt) und eine
   Benachrichtigungs-/Erinnerungs-Komponente (`expo-notifications`).
3. **Badges/Auszeichnungen**: Meilensteine (erste 100 Liegestütze, 7-Tage-Streak,
   perfekte Session) — Regelwerk über die bereits vorhandene `WorkoutStats`-Auswertung.
4. **Duelle/Matches gegen andere**: zeitlich begrenzter Wettkampf (z. B. "60 Sekunden,
   wer schafft mehr saubere Liegestütze") — braucht einen Realtime-Layer (z. B. Firebase,
   Supabase Realtime oder ein eigenes WebSocket-Backend) statt der aktuell rein lokalen
   `AsyncStorage`-Persistenz, plus Nutzerkonten/Matchmaking.
5. **Bagger/Leaderboards**: setzt eine Backend-Anbindung für Konten + serverseitig
   validierte Scores voraus (client-seitige Scores sind manipulierbar).

Schritte 2–3 lassen sich rein lokal umsetzen; Schritte 4–5 brauchen ein Backend und damit
eine bewusste Folgeentscheidung (Anbieter, Datenmodell, Authentifizierung).
