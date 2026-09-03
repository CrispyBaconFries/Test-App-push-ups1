# Liegestütz Coach

Eine React-Native/Expo-App, die über die **Frontkamera** die Liegestütz-Form in Echtzeit
analysiert: ein Strichlinien-Skelett (Kopf, Torso, Arme, Ellenbogen, Hüfte) wird über das
Kamerabild gelegt, live mitbewegt, und jede Wiederholung wird automatisch gezählt und
bezüglich sauberer Ausführung bewertet.

Aufbau: Handy vor sich auf den Boden stellen (Frontkamera zeigt zum Nutzer), App starten,
Liegestütze machen — die App zählt Wiederholungen, erkennt typische Fehler (Hüfte sackt
durch, zu wenig Tiefe, Ellenbogen zu weit abgespreizt, Kopf/Nacken nicht neutral) und gibt
sofortiges visuelles Feedback plus einen Form-Score pro Wiederholung.

## Aktueller Stand: zwei Entwicklungsstufen

**Stufe 1 (aktuell aktiv, in `RootNavigator`/`CameraScreen`):** Start-Button → Kamera
öffnet sich → zwischen Front- und Rückkamera wechseln → Zurück-Button. Nutzt
`expo-camera` und läuft **direkt in der normalen Expo-Go-App**, ohne eigenen nativen
Build — das ist bewusst so gewählt, damit du die App sofort auf deinem Handy starten und
bei jeder Änderung live sehen kannst (siehe "Lokal starten" unten).

**Stufe 2 (bereits fertig implementiert, aber noch nicht eingehängt, in
`WorkoutScreen.tsx`):** die volle Pose-Erkennung mit Skelett-Overlay, automatischer
Wiederholungs-Zählung und Form-Bewertung (Details weiter unten). Sie nutzt
`react-native-vision-camera` + MediaPipe, also *native* Module, die es in Expo Go nicht
gibt — dafür ist ein **Custom Dev Client** nötig (einmaliger nativer Build, siehe
"Stufe 2 aktivieren" unten). Der Code ist unverändert vorhanden und komplett unit-getestet,
nur aktuell nicht in `RootNavigator.tsx` verdrahtet.

## Lokal starten (Handy + PC-Vorschau)

> **Wichtig:** Dieses Projekt wurde von Claude in einer Cloud-Sandbox entwickelt, die
> keinen Tunnel zu deinem Handy oder eine grafische Vorschau auf deinem PC aufbauen kann
> (ausgehende Verbindungen zu ngrok/Expo-Cloud-Diensten sind dort blockiert). Die
> folgenden Befehle führst du deshalb **bei dir lokal** aus (Terminal auf deinem
> Rechner, im Projektordner) — dort funktioniert der komplette Live-Reload-Workflow
> normal.

```bash
npm install
npm run start        # startet den Metro-Server im Expo-Go-Modus, zeigt einen QR-Code
```

- **Auf dem Handy:** [Expo Go](https://expo.dev/go) aus dem App/Play Store installieren,
  QR-Code aus dem Terminal scannen (gleiches WLAN wie dein PC). Die App öffnet sich sofort
  — jede gespeicherte Codeänderung aktualisiert sie automatisch (Fast Refresh), ohne
  Neuinstallation.
- **Virtuelles Handy am PC:** im laufenden `npm run start`-Terminal `w` drücken (öffnet
  die App im Browser über `react-native-web`) oder `a`/`i` für einen Android-Emulator
  bzw. iOS-Simulator, falls du Android Studio/Xcode installiert hast. Alternativ direkt:
  `npm run web`.

Sobald du mir sagst, welche Befehle das bei dir ausgibt (bzw. was du im Browser/Handy
siehst), kann ich von hier aus weitere Anpassungen machen — die Datei-Änderungen kommen
dann bei deinem nächsten `git pull` an, der lokale Metro-Server lädt sie automatisch neu,
sobald du den Branch aktualisiert hast.

## Architektur

| Layer | Tech |
|---|---|
| App-Framework | Expo (React Native, TypeScript) |
| Kamera (Stufe 1, aktiv) | `expo-camera` — läuft in Expo Go |
| Kamera (Stufe 2, geparkt) | `react-native-vision-camera` (Frame Processors) — braucht Custom Dev Client |
| Pose-Erkennung (Stufe 2) | `react-native-mediapipe` → Google MediaPipe **Pose Landmarker** (33 BlazePose-Punkte, on-device, GPU-delegiert) |
| Skelett-Overlay | `react-native-svg`, gezeichnet über `ViewCoordinator.convertPoint` (korrekte Zuordnung Kamera-Frame → Bildschirm, inkl. Spiegelung/Rotation/Crop) |
| Formanalyse | reines TypeScript, kein UI-/Native-Code (`src/pose/formAnalysis.ts`) — dadurch mit Jest unit-testbar |
| Persistenz | `@react-native-async-storage/async-storage` (lokal, gerätespezifisch) |
| Navigation | `@react-navigation/native-stack` |
| Gamification | Punkte/Level jetzt, Grundgerüst für Challenges/Matches (siehe Roadmap) |

## Wie die Formanalyse funktioniert (Stufe 2)

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

## Stufe 2 aktivieren (Pose-Erkennung, Custom Dev Client)

Sobald du die volle MediaPipe-Version testen willst:

```bash
npm run model:download   # lädt das MediaPipe-Modell (~5.7 MB, wird nicht committed)
npm run prebuild          # erzeugt ios/ und android/ (Expo Prebuild)
npm run android            # oder: npm run ios (braucht macOS + Xcode)
```

Danach in `src/navigation/RootNavigator.tsx` den `WorkoutScreen`-Import und
`<Stack.Screen name="Workout" component={WorkoutScreen} />` wieder einkommentieren/
hinzufügen (siehe Kommentar dort) und z. B. den Home-Button darauf verlinken. Für den
täglichen Metro-Server danach: `npm run start:dev-client` statt `npm run start`.

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

**Hinweis zur Verifikation:** Stufe 1 (Start/Kamera/Umschalten/Zurück) wurde in dieser
Cloud-Sandbox tatsächlich lauffähig verifiziert — `expo start --web` gestartet und per
Headless-Chromium durchgeklickt (Start → Kamera aktiviert sich, Front-/Rückkamera-Toggle
funktioniert, Zurück-Button funktioniert, keine Konsolenfehler). Ein echter Test auf einem
physischen Handy über Expo Go steht noch aus, da diese Sandbox keine Verbindung zu deinem
Handy aufbauen kann — das übernimmst du mit den Befehlen oben.

Stufe 2 (MediaPipe) konnte mangels Kamera/Gerät in dieser Sandbox nicht live getestet
werden. TypeScript-Kompilierung und alle Unit-Tests laufen grün, die Integration wurde
sorgfältig gegen den tatsächlich installierten Quellcode von `react-native-vision-camera`
und `react-native-mediapipe` abgeglichen (Native-API-Kompatibilität,
`ViewCoordinator`-Koordinatentransformation, Modell-Asset-Auflösung — ein echter
`expo prebuild`-Lauf hat das Modell korrekt in ein generiertes Xcode-Projekt eingebettet).
Ein echter On-Device-Testlauf steht noch aus.

## Projektstruktur

```
src/
  pose/
    blazePoseLandmarks.ts   33-Punkt-Indizes (BlazePose-Standard, kein Native-Import)
    landmarks.ts             Winkel-/Sichtbarkeits-Hilfsfunktionen
    formAnalysis.ts           Zustandsmaschine + Form-Scoring (PushUpAnalyzer, Stufe 2)
    feedbackText.ts            deutsche Texte für Form-Hinweise
    testing/poseBuilder.ts     synthetischer Pose-Generator für Tests
  components/
    SkeletonOverlay.tsx        SVG-Strichmodell über der Kamera (Stufe 2)
    RepHud.tsx                  Rep-Zähler, Score, Live-Hinweis (Stufe 2)
  screens/
    HomeScreen.tsx      Start-Button, Punkte/Level-Übersicht
    CameraScreen.tsx     Stufe 1: Kamera, Front-/Rückkamera-Toggle, Zurück (expo-camera)
    WorkoutScreen.tsx    Stufe 2: volle Pose-Erkennung (aktuell nicht verdrahtet)
    SummaryScreen.tsx, HistoryScreen.tsx
  storage/workoutStorage.ts    lokale Session-Historie (AsyncStorage)
  gamification/points.ts        Punkte-/Level-Berechnung
  navigation/RootNavigator.tsx
plugins/withPoseLandmarkerModel.js   Config-Plugin: bündelt das .task-Modell nativ (Stufe 2)
scripts/download-pose-model.js        lädt das Modell herunter (Stufe 2)
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
