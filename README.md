# Liegestütz Coach

Eine React-Native/Expo-App, die über die **Frontkamera** die Liegestütz-Form in Echtzeit
analysiert: ein Strichmännchen-Skelett (Kopf, Torso, Arme, Ellenbogen, Beine) wird live
über das Kamerabild gelegt, jede Wiederholung wird automatisch gezählt und bezüglich
sauberer Ausführung bewertet.

Aufbau: Handy vor sich auf den Boden stellen (Frontkamera zeigt zum Nutzer), im Menü
**„Training starten"** wählen, Liegestütze machen — die App zählt Wiederholungen, erkennt
typische Fehler (Hüfte sackt durch, zu wenig Tiefe, Ellenbogen zu weit abgespreizt,
Kopf/Nacken nicht neutral) und gibt sofortiges visuelles Feedback plus einen Form-Score
pro Wiederholung.

## App-Struktur

Die Startseite ist ein Menü mit mehreren Punkten, aus denen man jeweils wieder zurück
navigieren kann (Android-Zurück-Taste/-Geste funktioniert überall, zusätzlich hat jeder
Screen einen sichtbaren „Zurück"-Button):

- **Training starten** — Kamera + Skelett-Overlay + automatische Wiederholungs-Zählung
  und Formbewertung. Der eigentliche Kern der App (`WorkoutScreen.tsx`). Bei jeder
  Wiederholung gibt es einen kurzen Bestätigungston statt Vibration (siehe unten).
- **Trainingsverlauf** — vergangene Workouts mit Wiederholungen, Datum und Uhrzeit
  (`HistoryScreen.tsx`).
- **Auszeichnungen** — freischaltbare Abzeichen für Meilensteine (`AchievementsScreen.tsx`,
  Logik in `src/gamification/badges.ts`); ein neu freigeschaltetes Abzeichen wird direkt
  nach dem Workout auf dem Zusammenfassungs-Screen gefeiert.
- **Kamera-Test** — nur die Kamera ohne Auswertung, zum schnellen Prüfen, falls
  „Training starten" auf einem Gerät Probleme macht (`CameraScreen.tsx`, nutzt
  `expo-camera` statt der MediaPipe-Pipeline — dient als einfacher Diagnose-Fallback).

Auf der Startseite außerdem: ein Level-Fortschrittsbalken (Level 1-50, gedeckelt), eine
Bestleistungen-Übersicht (beste Session, bester Form-Score, längste Streak jemals) und
die **Missionen** (tägliche/wöchentliche Aufgaben mit Münzen-Belohnung, dynamischem
Login-Streak-Bonus, optionaler täglicher Erinnerung) — siehe „Missionen & Münzen" für
Details. Weitere Menüpunkte: **Rangliste** (Gesamt/Woche/Liga/Freunde, siehe
„Ranking-System einrichten"), **Mein Profil** (Level/XP, Reps gesamt/Woche,
Freundescode) und **Münz-Shop** (Streak-Rettung, Avatare, Rahmen-Themes) — siehe
„Münz-Shop" und „Profil-Screen & Level 1-50".

## Auf dem Handy installieren (lokaler Android-Build mit Android Studio)

Die App nutzt native Kamera-/ML-Module (`react-native-vision-camera`, Google MediaPipe),
die es **nicht** in der normalen Expo-Go-App gibt. Es gibt keine fertige APK zum simplen
Herunterladen, weil es dafür einen Signing-Key und einen Play-Store- oder
EAS-Cloud-Build bräuchte — beides bewusst nicht Teil dieses Projekts. Stattdessen baust
du dir die Installationsdatei einmalig **selbst lokal** mit Android Studio; das dauert
beim ersten Mal ca. 20–40 Minuten (SDK-Download), ist danach aber ein einzeiliger Befehl.

### 1. Voraussetzungen installieren

1. **[Android Studio](https://developer.android.com/studio)** herunterladen und
   installieren (bringt das Android SDK, die Build-Tools und ein passendes JDK mit —
   du musst nichts davon einzeln installieren).
2. Android Studio einmal öffnen, dem Setup-Assistenten folgen ("Standard"-Installation
   reicht). Das lädt beim ersten Start automatisch das Android SDK herunter (mehrere GB,
   kann dauern).
3. **[Node.js](https://nodejs.org/)** (LTS-Version) installieren, falls noch nicht
   vorhanden — `node -v` im Terminal sollte etwas wie `v20.x` oder `v22.x` zeigen.
4. Dein Handy vorbereiten:
   - **Einstellungen → Über das Telefon** → 7× auf „Build-Nummer" tippen, um die
     „Entwickleroptionen" freizuschalten.
   - **Einstellungen → Entwickleroptionen → USB-Debugging** aktivieren.
   - Handy per USB-Kabel an den PC anschließen, am Handy den Hinweis „USB-Debugging
     zulassen?" mit **Zulassen** bestätigen (Häkchen bei „immer von diesem Computer
     zulassen" optional).

### 2. Projekt einrichten

Im Terminal, im Projektordner:

```bash
git pull
npm install
npm run model:download
```

`model:download` lädt das MediaPipe-Pose-Modell (`pose_landmarker_lite.task`, ~5,7 MB,
offizielle Google-URL) herunter — es liegt nicht im Repo, wird aber für die
Pose-Erkennung gebraucht. Ohne diesen Schritt bricht der nächste Befehl mit einer
klaren Fehlermeldung ab.

```bash
npm run prebuild
```

Das erzeugt die Ordner `android/` und `ios/` (native Projekte) und bündelt dabei
automatisch das Modell in beide hinein.

### 3. APK bauen und installieren

**Variante A — am schnellsten, für tägliches Testen (empfohlen):**

```bash
npm run android
```

Baut die App, installiert sie automatisch auf dem per USB verbundenen Handy und startet
sie. Danach läuft im Hintergrund ein lokaler Metro-Server: Wenn du (oder ich) Code
änderst, wird die App **automatisch neu geladen**, ohne dass du neu bauen musst
(„Fast Refresh") — genau das automatische Update-Verhalten, das du wolltest. Metro läuft
dabei auf deinem eigenen Rechner, das Handy ist per Kabel verbunden — kein Tunnel, kein
Cloud-Dienst nötig. Zum erneuten Starten des Servers ohne Neubau: `npm run start`.

**Variante B — eigenständige App, die ohne PC läuft (zum Vorführen):**

```bash
npm run android:release
```

**Wichtig zum Verständnis:** Variante A und ein `assembleDebug` erzeugen einen
*Debug*-Build. Der enthält das JavaScript-Bundle **nicht**, sondern lädt es bei jedem
Start vom Metro-Server deines Rechners. Ohne PC bleibt der Bildschirm deshalb leer und
man kann nichts auswählen — das ist kein Fehler, sondern die Bauart. Nur ein
**Release**-Build backt das Bundle fest in die APK und läuft dadurch eigenständig.

`npm run android:release` baut genau das und installiert es direkt aufs angeschlossene
Handy. Danach kannst du das Kabel abziehen, Metro beenden und den PC ausschalten — die
App startet weiterhin, „Training starten" und die Zählung funktionieren vollständig
offline (Kamera, Posenerkennung, Wiederholungszählung, Trainingsverlauf, Punkte,
Missionen, Münzen, Boss-Modus und Profil laufen alle rein lokal auf dem Gerät).

Nur diese Funktionen brauchen zusätzlich Firebase und bleiben ohne Einrichtung inaktiv
(sie zeigen einen entsprechenden Hinweis statt zu crashen): Google-Anmeldung, Rangliste,
Freundesliste und Duelle. Für eine reine Funktionsdemo ist das ohne Belang.

**Als verschickbare Datei** (statt direkt aufs Handy zu installieren):

```bash
cd android
./gradlew assembleRelease        # Windows: gradlew.bat assembleRelease
```

Die fertige Datei liegt danach unter:

```
android/app/build/outputs/apk/release/app-release.apk
```

Die bekommst du per Kabel, Cloud-Speicher oder Messenger aufs Handy, dort antippen →
**Installieren**. Falls das System das erste Mal blockiert: **Einstellungen → Apps →
[Datei-App, z. B. „Dateien"] → Unbekannte Apps installieren** → erlauben, dann erneut
versuchen. Das ist normal für Apps außerhalb des Play Stores.

Solange keine `keystore.properties` existiert, wird dieser Release-Build mit dem
Debug-Schlüssel signiert (siehe `plugins/withReleaseSigning.js`) — völlig ausreichend zum
Vorführen und Weitergeben, nur nicht Play-Store-tauglich. Für die Veröffentlichung siehe
den Abschnitt „Play-Store-Veröffentlichung" weiter unten.

### Wenn `npm install` einen Patch nicht anwenden kann

```
**ERROR** Failed to apply patch for package react-native-mediapipe at path
    node_modules/react-native-mediapipe
```

Passiert, wenn sich eine Datei in `patches/` geändert hat, npm das betroffene Paket aber
für „up to date" hält und deshalb **nicht** neu installiert. In `node_modules` liegt dann
noch die alte, bereits gepatchte Fassung, auf die der neue Patch nicht mehr passt.

Das betroffene Paket einmal entfernen und neu installieren lassen — im Beispiel
`react-native-mediapipe`, den Namen aus der Fehlermeldung übernehmen:

```powershell
Remove-Item -Recurse -Force node_modules\react-native-mediapipe
npm install
```

Danach müssen in der Ausgabe wieder alle Patches mit `✔` erscheinen. Hilft das nicht,
räumt `npm ci` alles ab und installiert streng nach `package-lock.json` neu (dauert
länger, ist aber garantiert sauber).

### Wenn der Build mit „build.ninja still dirty" abbricht

```
Execution failed for task ':react-native-vision-camera:buildCMakeRelWithDebInfo[arm64-v8a]'.
> ninja: error: manifest 'build.ninja' still dirty after 100 tries
```

Das liegt nicht am Projektcode. Der Debug-Build derselben Quellen lief durch, nur der
Release-Build brach ab.

**Was im Log passiert:** CMake läuft 100-mal vollständig und fehlerfrei durch (im Log an
hunderten Wiederholungen von `VisionCamera: Frame Processors: ON!` /
`VisionCamera: Linking react-native-worklets...` erkennbar), ninja hält das Manifest aber
weiterhin für veraltet. Grund: CMake schreibt `build.ninja` nur neu, wenn sich der *Inhalt*
ändert. Bleibt der Inhalt gleich, bleibt auch der Zeitstempel stehen — und ist damit
weiterhin älter als die Eingabedatei, die den Neulauf ausgelöst hat. Ninja versucht es 100-mal
und gibt dann auf.

**Auslöser** ist ein Fehler im Workaround `fix-prefab.gradle` von
`react-native-worklets-core`. Der stempelt die `prefab_config.json` der Module um, die
worklets-core per `find_package` einbinden (also VisionCamera), damit AGP die
Prefab-Konfiguration inklusive `.so` neu erzeugt. Er sucht dafür in `.cxx/<variantenname>` —
AGP benennt diese Ordner aber nach dem CMake-Build-Typ: aus `debug` wird `.cxx/Debug`
(unter Windows case-insensitiv, findet er also), aus `release` wird `.cxx/RelWithDebInfo`
(findet er nicht). Im Release-Build lief der Workaround deshalb still ins Leere. Behoben in
`patches/react-native-worklets-core+1.6.3.patch`: es werden jetzt alle Build-Typ-Ordner
unterhalb von `.cxx` durchsucht.

**Zusätzlich abgesichert** durch `plugins/withCmakeSuppressRegeneration.js`: Es setzt für
alle nativen Module `-DCMAKE_SUPPRESS_REGENERATION=ON`, wodurch CMake die
„Build-System selbst nachgenerieren"-Regel gar nicht erst in `build.ninja` schreibt. Ohne
diese Regel *kann* ninja das Manifest nicht mehr für veraltet halten, unabhängig von
Zeitstempeln. Das ist ungefährlich, weil Gradles eigene Task `configureCMake<Variante>` die
CMake-Dateien als deklarierte Eingaben hat und ohnehin neu konfiguriert, sobald sich eine
`CMakeLists.txt` ändert.

**Widerlegte Vermutungen** (damit sie niemand erneut verfolgt):

- *Veralteter CMake-Zustand in `node_modules/<paket>/android/.cxx/`.* `npm run clean:native`
  entfernte 31 solcher Verzeichnisse — der Fehler kam unverändert wieder. Das Skript bleibt
  trotzdem nützlich (siehe unten), es ist nur nicht die Lösung für diesen Fehler.
- *Wettlauf zwischen vier parallel gebauten CPU-Architekturen.*
  `plugins/withAndroidAbiFilter.js` beschränkt den Build seither auf `arm64-v8a`, im Log
  tauchte danach nur noch `[arm64-v8a]` auf — und der Fehler trat identisch weiter auf. Das
  Plugin bleibt bestehen, aber nur noch wegen Bauzeit und APK-Größe: nur ein Viertel des
  nativen Codes wird kompiliert. **Für die Play-Store-Veröffentlichung muss die Liste wieder
  verbreitert werden** — dann aber als `.aab`, das Google pro Gerät passend ausliefert.
  `arm64-v8a` deckt praktisch alle aktuellen Geräte ab, aber keine Emulatoren (x86_64) und
  keine alten 32-Bit-Geräte.

`npm run clean:native` ist trotzdem das richtige Mittel gegen andere unerklärliche
CMake-Fehler, die ein `expo prebuild --clean` überleben: Das räumt nämlich nur `android/`
ab, die CMake-Arbeitsverzeichnisse liegen aber in `node_modules/<paket>/android/.cxx/`.

```bash
npm run clean:native
```

Löscht ausschließlich Build-Artefakte (`.cxx` und `build` unterhalb von
`node_modules/<paket>/android/`), die beim nächsten Build automatisch neu entstehen.
Danach normal weiterbauen — der nächste Build dauert dadurch einmalig länger.

### Worauf zu achten ist

- **Physisches Handy statt Emulator** für den eigentlichen Test — ein Android-Emulator
  hat keine echte Kamera, die Pose-Erkennung liefert dort nur Test-/Fake-Bilder.
- **Kamera-Berechtigung**: Beim ersten Öffnen von „Training starten" oder „Kamera-Test"
  fragt die App nach Kamerazugriff — unbedingt erlauben, sonst bleibt der Screen leer.
  Versehentlich abgelehnt? **Einstellungen → Apps → Liegestütz Coach → Berechtigungen →
  Kamera** manuell erlauben.
- **Erster Gradle-Build dauert lange** (Android SDK/Build-Tools/Dependencies werden
  heruntergeladen) — das ist normal, spätere Builds sind deutlich schneller.
- **Debug-Build**: `assembleDebug` erzeugt bewusst eine ungesignte Debug-Version (kein
  Schlüssel-Setup nötig) — perfekt zum eigenen Testen, aber nicht für den Play Store
  gedacht. Das kommt erst, falls die App später wirklich veröffentlicht werden soll.
- **Wenn `npm run prebuild` oder der Gradle-Build fehlschlägt**: Fehlermeldung
  komplett kopieren und mir schicken — das ist der erste echte native Build dieses
  Projekts (in meiner Cloud-Sandbox konnte ich mangels Android SDK nur bis kurz davor
  testen, siehe „Hinweis zur Verifikation" unten), Startprobleme sind also nicht
  ausgeschlossen und meist schnell behoben.
- Änderungen, die *neue native Pakete* hinzufügen, brauchen einen erneuten
  `npm run android` (nicht nur Fast Refresh); reine JS/TS-Änderungen (z. B. an
  Bewertungslogik oder Texten) laden automatisch nach.

## Architektur

| Layer | Tech |
|---|---|
| App-Framework | Expo (React Native, TypeScript), Custom Dev Client (lokaler nativer Build) |
| Kamera + Pose-Erkennung | `react-native-vision-camera` (Frame Processors) + `react-native-mediapipe` → Google MediaPipe **Pose Landmarker** (33 BlazePose-Punkte, on-device, GPU-delegiert) |
| Kamera-Test-Screen | `expo-camera` (einfacher, ohne Pose-Erkennung — Diagnose-Fallback) |
| Skelett-Overlay | `react-native-svg`, gezeichnet über `ViewCoordinator.convertPoint` (korrekte Zuordnung Kamera-Frame → Bildschirm, inkl. Spiegelung/Rotation/Crop/Perspektive) |
| Formanalyse | reines TypeScript, kein UI-/Native-Code (`src/pose/formAnalysis.ts`) — dadurch mit Jest unit-testbar |
| Persistenz | `@react-native-async-storage/async-storage` (lokal, gerätespezifisch) |
| Navigation | `@react-navigation/native-stack` |
| Sound-Feedback | `expo-audio` — zwei kurze, synthetisch erzeugte Töne (`assets/sounds/`, erzeugt via `scripts/generate-rep-sounds.js`), kein Vibrieren |
| Erinnerungen | `expo-notifications` — optionale tägliche lokale Benachrichtigung, nur nach expliziter Erlaubnis |
| Gamification | Punkte/Level, Auszeichnungen, Tages-/Wochenziele, Bestleistungen — alles lokal aus `WorkoutSession`-Historie abgeleitet, kein Server nötig (Grundgerüst für Online-Duelle siehe Roadmap) |
| Anmeldung | `@react-native-google-signin/google-signin` (optional, „Mit Google anmelden" auf dem Home-Screen) + `expo-secure-store` für die verschlüsselte lokale Ablage des Profils — kein eigenes Backend, siehe „Google-Anmeldung einrichten" |
| Ranking-System | `@react-native-firebase` (app/auth/firestore/database) als Backend; LP-/Rangsystem, Uhrzeit-Abgleich, Spieler-Avatare mit Rang-Rahmen, Freundschaftsspiel (Einladungscode) und Ranked (Skill-based Matchmaking) — beide spielbar, sobald Firebase eingerichtet ist, siehe „Ranking-System einrichten" |
| Boss-Modus | Komplett offline (kein Backend nötig): dieselbe Kamera-/Zähllogik wie das normale Training, gegen einen immer stärkeren Boss (`src/bossmode/`) — siehe „Boss-Modus" |
| Design-System | Eigene Schriftart **Sora** (`@expo-google-fonts/sora` + `expo-font`, Laden über `useFonts()` in `App.tsx`) für Überschriften/Zahlen; `@expo/vector-icons` (Ionicons) statt reinem Text; `expo-linear-gradient` für Verläufe; `src/theme/colors.ts` + `src/theme/typography.ts` bündeln Farben/Schriftgewichte |

## Wie die Formanalyse funktioniert

`src/pose/formAnalysis.ts` (`PushUpAnalyzer`) bekommt pro Kamera-Frame die von MediaPipe
gelieferten **`worldLandmarks`** (metrische 3D-Koordinaten, hüft-zentriert — deutlich
robuster gegenüber Kameraperspektive als reine 2D-Bildkoordinaten).

Daraus werden pro Frame vier Winkel berechnet (jeweils für die Körperseite, die MediaPipe
gerade zuverlässiger sieht, für die Dauer einer Wiederholung fest — siehe unten):

- **Ellenbogenwinkel** (Schulter–Ellenbogen–Handgelenk) → steuert die Zustandsmaschine
  `up → descending → down → ascending → up`, die eine Wiederholung erkennt.
- **Hüft-/Rumpfgeradheit** (Schulter–Hüfte–Knöchel) → erkennt durchhängende Hüfte oder
  einen zu hohen Po ("Dach").
- **Ellenbogen-Abspreizung** (Ellenbogen–Schulter–Hüfte) → erkennt zu weit vom Körper
  abgespreizte Ellenbogen.
- **Nacken-/Kopfhaltung** (Ohr–Schulter–Hüfte) → erkennt eine nicht neutrale Kopfhaltung.

**Zur Zähllogik** (bewusste Design-Entscheidung, gerne nach dem ersten Test anpassen):
angefragt war sinngemäß „Kopf überschreitet die Parallele der Ellenbogen und kehrt zur
Ausgangsposition zurück". Umgesetzt ist das funktional gleichwertig, aber über den
**Ellenbogenwinkel** statt über einen reinen Bildschirm-Höhenvergleich Kopf/Ellenbogen:
Eine Wiederholung zählt, sobald der Arm die Abwärtsbewegung wirklich begonnen hat
(Ellenbogenwinkel unter `elbowAttemptDeg`, Standard 140°) und danach wieder vollständig
gestreckt wird (`elbowUpDeg`, Standard 160°) — **unabhängig davon, wie tief** genau. Auch
eine zu flache Wiederholung zählt also als Versuch (nicht zu streng), wird aber mit
niedrigem Form-Score und der Rückmeldung "Tiefer gehen" bewertet (kein Falsch-Zählen).
Nur eine winzige Bewegung, die nie über die Attempt-Schwelle hinauskommt, wird als
Rauschen verworfen. Der Grund für den Ellenbogenwinkel statt Kopf/Ellenbogen-Bildhöhe:
Winkel aus den 3D-`worldLandmarks` bleiben stabil, egal wie das Handy genau steht oder
gekippt ist — ein reiner Bildschirm-Höhenvergleich würde sich mit der Kameraperspektive
verschieben. Nach dem ersten echten Test lässt sich das jederzeit umstellen oder
nachschärfen — das ist der Sinn der „Kamera-Test" + „Training starten"-Trennung im Menü.

Der Form-Score (0–100) startet bei 100 und wird für jeden erkannten Fehler anteilig
reduziert; alle Schwellenwerte liegen gesammelt in `DEFAULT_THRESHOLDS`
(`src/pose/formAnalysis.ts`) und lassen sich leicht anpassen/kalibrieren, sobald du
gesehen hast, wie sich die App bei dir anfühlt.

### Warum die Formwerte keine Extremwerte mehr sind (09.09.2026)

Bis zum 09.09.2026 war jede Formkennzahl der **schlechteste Einzelframe** einer
Wiederholung — kleinster Hüftwinkel, größter Ellbogen-Flare. Ein einziger verrutschter
Frame entschied damit über die ganze Wiederholung. In den 124 aufgezeichneten
Wiederholungen (`docs/messdaten/2026-09-09-reps.json`) ist das messbar: Wiederholungen
mit einem Erkennungsaussetzer melden einen Ellbogen-Flare von im Median **138°** — ein
Winkel, bei dem der Arm hinter dem Rücken stünde.

Seitdem gilt:

| Kennzahl | Verfahren | Warum |
|---|---|---|
| Hüftgerade, Nacken, Ellbogen-Flare | Perzentil über alle Frames (`formPercentile`, Standard 10) | Diese Werte sollen über eine saubere Wiederholung *ungefähr konstant* bleiben. Wer wirklich durchhängt, hängt in vielen Frames durch, nicht in einem. |
| Ellbogen-Tiefe | n-kleinster Wert (`depthOutlierFrames`, Standard 2) | Die Tiefe ist der **Umkehrpunkt einer Bewegung**, kein Plateau. Der Winkel läuft von 170° auf 90° und zurück; ein Perzentil über den ganzen Bogen würde die Tiefe systematisch zu flach schätzen — und zwar umso stärker, je langsamer jemand die Wiederholung ausführt. |

Beide Verfahren stehen in `src/pose/stats.ts`, die Begründung im Detail ebenfalls dort.

### Plausibilitätsprüfung: nicht jede gezählte Bewegung ist eine Wiederholung

Von denselben 124 aufgezeichneten Wiederholungen waren **24 (19 %) gar keine**:

- **8 unter 700 ms** (6 davon unter 500 ms) — körperlich unmöglich, das sind
  Doppelzählungen durch Winkelrauschen an der Schwelle.
- **16 über 8 Sekunden**, die längste 34 — dort hing der Zähler, während sich jemand
  hinlegte oder Pause machte. Alle Formwerte dieser Wiederholungen waren unbrauchbar.

`PushUpAnalyzer` verwirft solche Bewegungen jetzt, statt sie zu zählen
(`minRepDurationMs`, `maxRepDurationMs`, `minTrackedFrameRatio`). Eine verworfene
Bewegung verbraucht **keinen** Wiederholungsindex, wird aber als `discardedRep` gemeldet
und mit aufgezeichnet — sonst wäre von außen nicht unterscheidbar, ob jemand wenig
trainiert hat oder ob die Erkennung die Hälfte weggeworfen hat. `getDiscardCounts()`
liefert die Summen pro Grund.

Die Zeitüberschreitung wird bewusst **vor** der Sichtbarkeitsprüfung ausgewertet:
Eine Wiederholung, die genau deshalb hängt, weil das Tracking weggebrochen ist, würde
sonst nie ablaufen.

### Warum die Hüfte über das Knie gemessen wird, nicht über den Knöchel (10.09.2026)

Der Fehlalarm „Hüfte sackt durch", den chris vom ersten Tag an gemeldet hat, war ein
Messfehler, kein Formfehler:

```ts
// vorher
const hipStraightnessDeg = hip && ankle ? angleAtPoint(shoulder, hip, ankle) : null;
```

Beim Liegestütz steht der Fuß auf den Zehen. Der Knöchel liegt damit deutlich *unterhalb*
der Körperlinie Schulter–Hüfte–Knie — der Winkel Schulter–Hüfte–Knöchel ist also auch bei
kerzengeradem Rücken systematisch kleiner als 180°. In den Messdaten vom 09.09.2026
erreichten **0 von 20** sauber ausgeführten Wiederholungen die Schwelle von 160°, bei
einer Streubreite von nur 7°. Gemessen wird jetzt Schulter–Hüfte–**Knie**; das Knie liegt
auf der Körperlinie und ist zusätzlich zuverlässiger im Bild als der Fuß, der bei einem
tief vor der Person stehenden Handy oft ganz herausfällt.

Der zugehörige Test baut genau diese Situation nach (gerader Rücken, Fuß abgesenkt) und
prüft *beides*: dass die alte Messung daran gescheitert wäre und die neue nicht.

**Die Schwelle `minHipStraightnessDeg` (160°) ist bewusst unverändert geblieben.** Sie
misst seit dieser Änderung etwas anderes, alte Aufzeichnungen taugen also nicht mehr zur
Kalibrierung. Ob 160° jetzt erreichbar ist, sagt die nächste Aufzeichnung — Messung und
Schwelle im selben Schritt zu ändern, würde das Ergebnis unlesbar machen.

### Der Live-Hinweis kennt jetzt die Richtung

`liveCue()` wertete das Vorzeichen der Hüftabweichung nicht aus und konnte deshalb
**niemals** `HIPS_PIKING` melden — jede Abweichung hieß „sackt durch", auch ein
hochgestrecktes Gesäß. Die Auswertung am Ende der Wiederholung (`finishRep()`) machte es
von Anfang an richtig; jetzt sind beide einig.

### Die Nacken-Schwelle stammt aus Messungen, nicht aus Anatomie

`minNeckAngleDeg` stand auf 140° und schlug damit bei **93 % aller Wiederholungen** an.
Der Grund: Ein neutraler Nacken ergibt in dieser Kameraperspektive keine 180°. Die App
bittet die Person ausdrücklich, in die Kamera zu schauen — und genau das verkleinert den
Winkel Ohr–Schulter–Hüfte.

Aus 144 aufgezeichneten Wiederholungen:

| Schwelle | markiert insgesamt | markiert bei einer sauberen Serie |
|---|---|---|
| 140° (alt) | 93,1 % | 19 von 20 |
| 125° | 26,4 % | 0 von 20 |
| **115° (neu)** | **12,5 %** | **0 von 20** |
| 100° | 4,9 % | 0 von 20 |

115° lässt eine saubere Serie (gemessen 126–140°) mit 11° Luft durch und markiert
weiterhin die echten Ausreißer — im Datensatz kommen Werte bis herunter zu 59° vor, immer
zusammen mit anderen groben Fehlern.

#### `goodDepthElbowDeg`: 95° → 105° (10.09.2026)

Hier stand vorher: „Nicht angefasst. Diese Prüfung schlägt zwar ebenfalls oft an, aber zu
Recht — das ist eine echte Trainingsrückmeldung und kein Messfehler." **Das war falsch,**
und die Daten sagen auch, woran ich es hätte sehen können.

Über alle 176 aufgezeichneten Wiederholungen liegt der tiefste Punkt im Median bei 101°;
in den Sitzungen vom 09.09.2026 abends häufen sich die Werte auffällig eng zwischen 96°
und 104°. Bei 95° meldet die App damit **85 % aller Wiederholungen** als „nicht tief
genug", bei 105° sind es 17 %.

Dass das die Messung ist und nicht die Ausführung, zeigt die Streuung **innerhalb** einer
Sitzung: Am 09.09.2026 um 20:12 Uhr liegen 24 Wiederholungen am Stück zwischen 91° und
139°. Niemand ändert seine Tiefe im selben Satz um 48°. Der Grund ist die Perspektive: Am
Tiefpunkt zeigt der Unterarm fast auf die Kamera zu, und genau dann ist MediaPipes
Tiefenschätzung am schlechtesten — der Winkel fällt zu groß aus. Das ist derselbe
Fehlschluss wie beim Nackenwinkel eine Ebene höher, nur habe ich ihn dort erkannt und hier
nicht.

| Schwelle | markiert (alle 176) | markiert (ab 09.09. abends, 52 Reps) |
|---|---|---|
| 95° (alt) | 73 % | 85 % |
| 100° | 52 % | 40 % |
| **105° (neu)** | **39 %** | **17 %** |
| 110° | 31 % | 13 % |

Eine Meldung, die bei fast jeder Wiederholung erscheint, ist keine Rückmeldung mehr,
sondern Rauschen — man gewöhnt sich an sie und übersieht sie auch dann, wenn sie einmal
stimmt.

**Was 105° nicht ist: eine Aussage über richtige Ausführung.** Es ist ein empirischer Wert
für *diese* Kameraperspektive. Der saubere Weg wäre ein Tiefenmaß, das nicht am Unterarm
hängt — etwa die Schulterhöhe im Verhältnis zur Armlänge, die von der Unterarm-Verkürzung
unabhängig ist. Das steht als Punkt 1.2 im Backlog. Naheliegend wäre gewesen, die Schwelle
stattdessen aus der Kalibrierung abzuleiten (wie bei Hüfte und Nacken), aber das trägt
nicht: Der Messfehler am Tiefpunkt hat mit dem am Umkehrpunkt oben nichts zu tun, die
Grundhaltung sagt über ihn also nichts.

### Warum Wiederholungen verschluckt wurden (10.09.2026)

chris machte 14 Liegestütze, gezählt wurden 8. Dazu kamen zwei verworfene Abschnitte von
je 8 Sekunden — bei **lückenlosem Tracking**, 0 verlorene Frames. Bei einer mittleren
Wiederholungsdauer von 2,9 s stecken in 16 s Bewegung rund sechs Liegestütze: 8 + 6 = 14.
Die Rechnung geht exakt auf.

Ursache: Der Abschluss einer Wiederholung hing allein an `elbowUpDeg` (160°). Wer oben
nicht ganz durchstreckt — mit zunehmender Ermüdung völlig normal — schloss die
Wiederholung nie ab. Die nächste Abwärtsbewegung galt als Fortsetzung *derselben*
Wiederholung, mehrere Liegestütze verschmolzen zu einem überlangen „Rep", und der flog
schließlich am Zeitlimit raus. Drei echte Wiederholungen wurden so zu null.

Es gibt jetzt einen zweiten Weg, eine Wiederholung abzuschließen: Sobald es vom höchsten
erreichten Punkt wieder um `repReversalToleranceDeg` (15°) abwärts geht, war das eine
Wiederholung — unabhängig davon, wie weit jemand oben durchstreckt. Die nächste beginnt
sofort, statt in `'up'` zu warten.

**Die Falle dabei** (beim ersten Einbau prompt hineingetappt, der Test hat sie gefangen):
Der Rückweg `'ascending' → 'down'` bei `elbowAttemptDeg` (140°) war *immer zuerst* dran.
Wer bei 148° umkehrt, unterschreitet 140° schon nach 8° — lange bevor die 15°-Umkehr bei
133° erkannt wäre. Der Rückweg hat die Umkehrerkennung damit vollständig ausgehebelt und
ist deshalb entfallen. Ein echtes Nachwippen am tiefsten Punkt kommt dort gar nicht an:
Dafür müsste der Winkel erst über 140° steigen, sonst bleibt die Zustandsmaschine in
`'down'`.

Der Test dazu prüft beide Richtungen: drei Wiederholungen mit 148° Umkehrpunkt müssen
dreimal zählen, und mit abgeschalteter Umkehrerkennung (`repReversalToleranceDeg:
Infinity`) muss dieselbe Eingabe wieder verschmelzen — sonst würde der Test die neue
Logik gar nicht prüfen.

Begleitend angehoben: `maxRepDurationMs` von 8 auf 12 Sekunden. Echte Wiederholungen
dauern gemessen bis zu 5,3 s; 12 s fangen den hängenden Zähler weiterhin ab (dort standen
26, 30 und 34 Sekunden). Und `DiscardedRep` trägt jetzt den Ellbogen-Winkelbereich mit —
ohne den ist ein `TOO_LONG` nicht deutbar: 90–170° heißt „hier stecken mehrere echte
Wiederholungen drin", 150–170° heißt „die Person hat sich nicht bewegt".

### Die Hüft-Schwelle, jetzt aus knie-basierten Messungen

Nach der Umstellung auf das Knie ergab die erste Aufzeichnung: sauber ausgeführte
Wiederholungen bei **152–169°**, eine erkennbar abgekippte Hüfte bei **97°**.
`minHipStraightnessDeg` steht deshalb auf **145°** — 7° Luft unter der schlechtesten
sauberen Wiederholung, und die echte Abweichung wird mit großem Abstand markiert. Von 8
Wiederholungen halten damit 7 die Schwelle ein statt 2.

### Der Weg in die Position ist kein Liegestütz (10.09.2026)

chris stellt das Handy auf den Boden, geht zwei Schritte zurück und geht dann in die
Stützposition — dabei wurden ein bis zwei Wiederholungen gezählt, die keine waren. In der
Aufzeichnung vom 09.09.2026, 20:12 Uhr stehen genau drei solche Einträge:

| Zeit | Hüfte | Tiefe | was es war |
|---|---|---|---|
| 20:12:02 | 56° | 117° | in Position gehen |
| 20:12:06 | 88° | 130° | in Position gehen |
| 20:13:01 | 22° | 126° | wieder aufstehen |

Alle **21 echten** Wiederholungen derselben Sitzung liegen bei 158–169° Hüfte.

`PushUpAnalyzer` verwirft solche Bewegungen jetzt als `NOT_A_PLANK` — aber nur, wenn
**beide** Bedingungen zutreffen: Der Körper war nicht in Stützposition
(`minPlankHipStraightnessDeg`, 110°) **und** die Bewegung ging nicht in die Tiefe
(`notAPlankDepthDeg`, 95°).

Diese Tiefenschwelle ist seit dem 10.09.2026 bewusst **eine eigene Zahl** und nicht mehr
`goodDepthElbowDeg`. Als die Bewertungsschwelle auf 105° gelockert wurde, hätte die
gemeinsame Konstante lautlos auch das *Zählen* geändert. Eine Zahl, die über Punkte
entscheidet, darf nicht nebenbei entscheiden, ob eine Wiederholung überhaupt existiert.

Die Hüfte allein reicht als Kriterium nicht. In der Aufzeichnung davor steht eine echte
Wiederholung mit deutlich abgekippter Hüfte (97°) — das ist ein *schlechter* Liegestütz,
kein Nicht-Liegestütz, und muss gezählt und schlecht bewertet werden. Sie unterscheidet
sich vom Positionswechsel dadurch, dass sie in die Tiefe ging (85°). Gegen alle
vorhandenen Daten geprüft: Der Filter trifft alle drei Positionswechsel, lässt alle 21
echten Wiederholungen und die eine schlechte durch. Beide Richtungen stehen als Test.

War die Hüfte nie messbar (Unterkörper außerhalb des Bildes), greift die Prüfung gar
nicht — im Zweifel für den Sportler.

### Startposition: gezählt wird erst, wenn die Position steht (10.09.2026)

Der Filter oben fängt den Positionswechsel *nachträglich* ab - die Bewegung wird als
Wiederholung begonnen und am Ende verworfen. Das reicht nicht, sobald der Weg in die
Position zufällig auch tief genug geht: Dann greift die Und-Bedingung nicht mehr.

Deshalb gibt es jetzt eine Stufe davor: **Solange die Startposition nicht eingenommen und
zwei Sekunden ruhig gehalten wurde, läuft die Zustandsmaschine gar nicht.** Der Weg in die
Position kann damit gar keine Wiederholung mehr erzeugen, unabhängig davon, wie er
aussieht (`src/pose/startPosition.ts`).

**Drei Ursachen, nicht eine.** chris' genaue Beschreibung: Er geht **stehend** rückwärts
vom Handy weg, ist dabei nur teilweise im Bild - und hat schon die erste Zählung. Bis er
Hände und Füße aufgesetzt hat, die zweite. Das sind zwei verschiedene Fehler plus ein
dritter, der beide begünstigt:

1. **Halb außerhalb des Bildes.** MediaPipe liefert auch für Körperteile außerhalb des
   Bildes Koordinaten — *geschätzte*, teils mit normalisierten Werten jenseits von 0..1.
   Aussortieren würde man sie über den Sichtbarkeitswert — aber genau der kommt bei
   `react-native-mediapipe` **nie** in JS an (dokumentiert in `landmarks.ts`, war schon
   vorher bekannt: `allVisible()` ist auf dem echten Gerät wirkungslos). Der Zähler hat
   also mit erfundenen Armen gerechnet. Dagegen hilft jetzt `allInFrame()`: eine Landmarke
   außerhalb des Bildes ist keine Messung.
2. **Stehen sieht aus wie Stütz.** Winkel sind richtungslos. Wer aufrecht steht, hat
   genauso gestreckte Arme (Schulter–Ellbogen–Handgelenk rund 175°) und einen genauso
   geraden Körper (Schulter–Hüfte–Knie rund 180°) wie jemand im Stütz. Eine Prüfung nur auf
   diese beiden Winkel hätte zwei Sekunden ruhiges Stehen als „Startposition eingenommen"
   durchgewinkt — und den anschließenden Weg nach unten wieder als Wiederholung gezählt.
   Der Unterschied liegt im **Arm zum Rumpf** (Ellbogen–Schulter–Hüfte): beim Stehen hängt
   der Oberarm am Körper (5–25°), im Stütz steht er quer dazu (gemessen 58–101°). Schwelle:
   35°.
3. **Der Weg nach unten ist eine echte Armbeugung.** Hinknien und Hände aufsetzen beugt und
   streckt den Arm tatsächlich — für einen Zähler, der den Ellbogenwinkel verfolgt, nicht
   von einem Liegestütz zu unterscheiden. Dagegen hilft das Ruhighalten: Jeder Weg nach
   unten führt durch die Stützhaltung *hindurch*, aber niemand bleibt dabei zwei Sekunden
   lang innerhalb weniger Grad stehen. Das Haltefenster wandert bei einer langsamen
   Abwärtsbewegung mit, statt zu wachsen.

**Korrektur zu einer früheren Einschätzung in diesem README:** Hier stand, die Messdaten
zeigten lückenloses Tracking, das Skelett springe also nicht. Das war die falsche Frage an
die Daten. Der Kalibrier-Log zeichnet nur abgeschlossene und verworfene *Wiederholungen*
auf — dass die Person dabei halb außerhalb des Bildes war, konnte er gar nicht zeigen, weil
diese Information nirgends erfasst wurde. „0 verlorene Frames" hieß nur „`allVisible()` hat
nie Nein gesagt", und Nein sagen konnte es auf diesem Gerät nie.

#### „Ruhig halten" heißt nicht „unbewegt" (Nachbesserung, 10.09.2026)

Die erste Fassung war auf dem Gerät unbrauchbar. chris' Rückmeldung nach dem ersten Build:

> „Jegliche minimale Änderung und Rauschen des Algorithmus startet die Kalibrierung neu,
> das darf nicht sein. Sobald sich eine Linie minimal bewegt, obwohl man selbst still hält,
> läuft der Timer von vorne los und man kommt nie zu den Liegestützen."

Der Fehler steckte in der Kennzahl. Geprüft wurde die **Spannweite** (größter minus
kleinster Wert) über das ganze Haltefenster — bei 30 Bildern/s nach zwei Sekunden also der
Abstand der **beiden extremsten von rund 60 Frames**. Ein einziger verrutschter Frame
sprengt damit jede Toleranz, und genau die liefert MediaPipe mehrmals pro Sekunde. Das
Fenster wurde daraufhin vorne gekürzt — der Ausreißer fraß die gesammelte Haltezeit auf,
Frame für Frame.

Ein Extremwert ist die falsche Kennzahl für Rauschen. Dieselbe Erkenntnis wie bei der
Formbewertung (siehe `src/pose/stats.ts`), nur an einer Stelle, an der sie beim ersten Mal
niemand angewendet hat. Jetzt werden **zwei Dinge getrennt** geprüft, die vorher in einer
Zahl vermischt waren:

| | wie gemessen | Toleranz | wogegen |
|---|---|---|---|
| **Rauschen** | robuste Spannweite (10.–90. Perzentil) | 14° Ellbogen, 22° Hüfte | zittriges Tracking |
| **Wandern** | Median letztes Drittel minus Median erstes Drittel | 5° Ellbogen, 8° Hüfte | der langsame Weg nach unten |

Der Trick ist die zweite Zeile: Ein Median über rund 20 Frames ist gegen Rauschen praktisch
unempfindlich (der Zufallsfehler sinkt mit der Wurzel der Anzahl), reagiert aber sofort auf
eine echte Verschiebung. Deshalb darf die Rauschtoleranz großzügig sein, **ohne** dass der
Weg in die Position durchrutscht: Es darf rauschen, wie es will, solange es nicht wandert.

Dazu kommen zwei Nachsichtsspannen, damit ein Aussetzer nicht mehr alles kostet:

- **400 ms** für „keine Pose" und für Frames knapp unter einer Eintrittsschwelle. Ein
  Wackeln, das im Fenster ohnehin toleriert würde, darf nicht deshalb alles verwerfen, weil
  es zufällig auf der falschen Seite der Grenze gelandet ist.
- **120 ms** für Frames, die *deutlich* danebenliegen — 130°, wo eben noch 172° stand. Dass
  solche Sprünge Tracking-Fehler und keine Bewegung sind, steht in den Messdaten: Frames
  mit kurzem Aussetzer melden einen Ellbogen-Flare von im Median 138°, ein Winkel, bei dem
  der Arm hinter dem Rücken stünde. Über hundert Millisekunden kommt aber niemand in eine
  andere Haltung und wieder zurück — vier Frames sind ein Glitch, fünfzehn eine Bewegung.

Überbrückte Lücken zählen dabei **nicht** als Haltezeit (höchstens 150 ms je Lücke), sonst
wäre „eine Sekunde nicht erkannt" eine Sekunde geschenkt.

Verworfen wird das Fenster weiterhin, wenn die Position wirklich verlassen wird — Arme
gebeugt, Körper abgeknickt, aufrecht, oder Pose länger als die Nachsichtsspanne weg.

**Was daran noch geraten ist:** die Zahlen selbst. Wie unruhig das Tracking auf chris'
Gerät wirklich ist, weiß ich nicht — auf dem Handy gibt es kein Log (siehe CLAUDE.md).
Deshalb hält der `baseline`-Eintrag im Kalibrier-Log jetzt beides fest: die robuste
Spannweite *und* die rohe (`elbowSpreadDeg` / `elbowJitterDeg`), dazu das Wandern, die Zahl
der Neustarts und der überbrückten Aussetzer. `npm run analyze:reps` stellt sie
gegenüber. Klaffen robuste und rohe Spannweite weit auseinander, ist das Tracking unruhig
und nicht die Person; viele Neustarts bei kleinem Rauschen heißen, die Toleranzen sind
immer noch zu eng.

**Der Bildschirm sagt, woran es hakt.** „Ich sehe dich nicht" / „Arme durchstrecken" /
„Körper strecken" / „Du stehst noch" / „Ruhig halten", dazu ein Balken, der sich füllt, und
ein Ton, sobald es losgeht. Das ist Absicht: Wer davor liegt, kann sonst nur raten, warum
nichts passiert.

**Zwei Maßstäbe, weil die Fehlerrichtungen unterschiedlich viel kosten.** Für die
Formpunkte (Hüfte, Knie, Ohr) gilt ein Sicherheitsabstand von 2 % zum Bildrand — eine
angeschnittene Landmarke ist schon halb geraten, und ein Ausfall kostet dort nur *eine
Formnote*. Für den **Arm** zählt dagegen nur „nachweislich außerhalb des Bildes": Wird er
fälschlich ausgeschlossen, zählt die App **gar nichts mehr**, und man steht vor einem toten
Zähler, ohne dass ein Log zur Verfügung stünde.

**Der Bildschirm sagt jetzt, welcher Körperteil fehlt.** Vorher stand dort ein allgemeines
„Nicht vollständig im Bild – bitte zurücktreten", das nie erschien (die Prüfung dahinter war
wirkungslos). Jetzt gibt es zwei verschiedene Sätze, weil sie Gegenteiliges bedeuten:
„Arme nicht im Bild – es wird gerade nicht gezählt" und „Beine nicht im Bild – Haltung wird
nicht bewertet". Wer beim zweiten zurücktritt, macht es schlimmer — dann ragen womöglich
die Arme raus und es zählt gar nichts mehr.

Im Kalibrier-Log hält ein verworfener Abschnitt außerdem fest, **wie viele** der
ausgefallenen Frames am Bildausschnitt lagen (`outOfFrameFrames`, wird von
`npm run analyze:reps` ausgegeben). Ein `TRACKING_LOST` mit hohem Wert heißt „steh weiter
weg vom Handy", eines mit 0 heißt „MediaPipe hat die Pose verloren" — zwei völlig
verschiedene Ursachen, die sonst gleich aussehen.

**Nebenwirkung der Bildprüfung, die eigenständig zählt:** Auch die *Formwerte* rechnen
nicht mehr mit geschätzten Punkten. Ein Knie außerhalb des Bildes wurde bisher erfunden und
der Winkel Schulter–Hüfte–Knie daraus berechnet — das ist die wahrscheinlichste Quelle der
Hüftwerte, die innerhalb einer Sitzung zwischen 10° und 158° sprangen (siehe die
Sitzungstabelle unter „Kalibrier-Log auswerten"). Jetzt gilt: lieber gar keine Aussage als
eine geratene. `minHipStraightnessDeg` ist dann schlicht `null` und die Prüfung fällt aus.

**Was noch offen ist:** Der Arm-zu-Rumpf-Winkel braucht die Hüfte. Ist sie nicht im Bild,
entfällt die Stehen-Prüfung — dann könnte theoretisch wieder im Stehen scharf geschaltet
werden. Der physikalisch sauberere Weg wäre, die Rumpflage im Bild zu prüfen (waagerecht =
Stütz, senkrecht = Stehen). Das hängt aber daran, wie MediaPipes `worldLandmarks` gegenüber
dem Bild ausgerichtet sind, und das lässt sich nur auf einem echten Gerät nachweisen. Der
Wert wird deshalb bereits als `torsoHorizontalRatio` in der Grundhaltung mitgemessen (1 =
waagerecht, 0 = senkrecht) — bestätigt sich die Annahme über mehrere Aufzeichnungen, wird
daraus eine zweite, von der Hüfte unabhängige Bedingung.

**Notbremse:** Nach 30 Sekunden wird auch ohne erfolgreiches Halten scharf geschaltet -
dann mit den allgemeinen Schwellwerten. Ein Bildschirm, der unter ungünstigen Bedingungen
*nie* zu zählen anfängt, ist schlimmer als eine gelegentliche Fehlzählung.

**Kein Kopf-Rahmen.** Ursprünglich war ein kopfförmiger Rahmen geplant, in den man sich
hineinstellt. Zwei Gründe dagegen: Er hängt an Bildschirmkoordinaten und damit daran, wie
das Handy gerade steht - kippt es leicht, stimmt er nicht mehr. Und er verlangt, aus zwei
Metern Entfernung im Stütz liegend Details auf einem Handy am Boden zu erkennen. Das
Halten der Position braucht keinen Blick auf den Bildschirm und misst genau das, worauf es
ankommt: die eigene Haltung, nicht die Lage im Bild.

**Im Duell** hängt „bereit" jetzt daran statt an der Kameraberechtigung. Vorher konnte der
Countdown anlaufen, während ein Spieler noch zwei Schritte vom Handy entfernt stand - die
60 Sekunden liefen dann bereits.

### Persönliche Schwellwerte aus der Grundhaltung (10.09.2026)

Dieselben zwei Sekunden liefern die Messung, die den Fehlalarmen zu Hüfte und Kopfposition
die Grundlage entzieht. Eine Hüftgerade von 150° heißt bei der einen Person „leicht
durchgesackt" und bei der anderen „kerzengerade, nur flach von vorn gefilmt". Ohne
Bezugspunkt muss ein fester Schwellwert beides gleich behandeln - und genau daher kommen
die Meldungen, über die sich bisher jede Testperson beschwert hat.

Gemessen wird der Median über das Haltefenster:

| Wert | Wofür |
|---|---|
| Schulter-Hüfte-Knie | persönliche Schwelle für „Hüfte sackt durch" / „Po zu hoch" |
| Ohr-Schulter-Hüfte | persönliche Schwelle für „Kopfhaltung" |
| Ellbogenwinkel oben | nur aufgezeichnet, siehe unten |

Die Schwelle ist **Grundhaltung minus 20°** (Hüfte) bzw. **minus 25°** (Nacken). Die 20°
sind nicht geraten: Sauber ausgeführte Wiederholungen lagen in der Aufzeichnung vom
09.09.2026 bei 152-169°, eine erkennbar abgekippte Hüfte bei 97°. Eine Grundhaltung von
rund 165° minus 20° ergibt genau die 145°, die als allgemeiner Wert aus denselben Daten
kalibriert wurden - für diese Person ändert sich also nichts, und abweichen tut es nur da,
wo die Perspektive den Winkel staucht.

**Zwei bewusste Einschränkungen:**

1. **Die Kalibrierung lockert nur, sie verschärft nie.** Wessen Grundhaltung *besser* ist
   als der allgemeine Wert, wird trotzdem nach dem allgemeinen bewertet. Die beiden
   Fehlerrichtungen wiegen unterschiedlich schwer: Eine zu milde Schwelle bewertet eine
   schlechte Wiederholung zu gut, eine zu strenge nörgelt bei jeder guten - und Letzteres
   bringt Leute dazu, der App nicht mehr zu glauben. Gelockert wird höchstens um 25°, sonst
   würde ein Einstieg mit durchgesackter Hüfte das Durchsacken für den Rest der Sitzung als
   normal festschreiben.
2. **Die Ellbogen-Schwellen bleiben unangetastet.** Sie entscheiden, *ob* gezählt wird,
   nicht wie gut bewertet wird - ein Fehler dort kostet Wiederholungen, ein Fehler bei
   Hüfte oder Nacken nur Punkte. Und die Tiefe lässt sich aus einer gehaltenen Position
   ohnehin nicht ableiten, dafür bräuchte es eine vorgeführte Wiederholung. Der gemessene
   Wert wird trotzdem protokolliert, damit sich später **mit Daten** entscheiden lässt, ob
   es sich lohnt.

Die Grundhaltung landet als eigener Eintrag im Kalibrier-Log (`kind: 'baseline'`) und wird
von `npm run analyze:reps` mit ausgegeben - erst damit sind die Hüft- und Nackenwerte der
einzelnen Wiederholungen überhaupt deutbar.

### Kalibrier-Log auswerten

```bash
npm run analyze:reps                       # der eingecheckte Datensatz
node scripts/analyze-rep-log.js pfad.json  # eine neue Aufzeichnung
```

Das Skript beantwortet die drei Fragen, auf die es bei der Schwellenkalibrierung ankommt:

1. **Wie oft schlägt eine Prüfung an?** Alles jenseits von etwa 50 % ist keine Prüfung
   mehr, sondern eine Konstante. (Stand 09.09.2026: `HEAD_MISALIGNED` bei **93,5 %**.)
2. **Erreichen die Wiederholungen die Schwelle überhaupt je?** Liegt die Schwelle über
   dem 90. Perzentil aller je gemessenen Werte, ist sie nicht streng, sondern falsch.
   (Stand: Hüfte ≥ 160° in 11 von 124, Nacken ≥ 140° in 9 von 124.)
3. **Kippt die Hüftrichtung zwischen benachbarten Wiederholungen?** Ein Wechsel zwischen
   „sackt durch" und „zu hoch" bei nahezu gleichem Winkel ist der Fingerabdruck von
   Rauschen. (Stand: 43 % Wechsel, davon 24 bei ≤ 8° Unterschied.)

**Die Schwellen selbst sind bewusst noch nicht angepasst.** Erst müssen die Messfehler
raus — sonst kalibriert man auf den Fehler. Was noch offen ist, steht in
`docs/backlog.md`.

### Native Bugfix: MediaPipe erkannte auf dem echten Gerät gar keine Pose

Ursache dafür, dass auf dem echten Handy überhaupt keine Wiederholung gezählt wurde
(auch nach den JS-seitigen Fixes oben): `react-native-mediapipe`s natives Android-Modul
(`PoseDetectorHelper.kt`, Methode `detectLiveStream()`) hat die tatsächliche
Geräte-/Frame-Orientierung komplett ignoriert und stattdessen **immer** `Orientation.PORTRAIT`
fest verwendet (der echte Wert war einauskommentiert: `// this.imageRotation =
orientationToDegrees(orientation)`). Stimmt die angenommene Rotation nicht mit der
tatsächlichen Haltung des Handys überein, bekommt MediaPipes Pose-Modell ein
"falsch gedrehtes" Bild und erkennt in **jedem einzelnen Frame** keine Person — und weil
`DetectorListener.onEmpty()` (aufgerufen, wenn `landmarks().size == 0`) in
`PoseDetectionModule.kt` nie überschrieben wird, kommt in diesem Fall **überhaupt kein**
Event auf der JS-Seite an (auch kein Fehler) — daher blieb selbst das reine
Diagnose-Logging in `onResults` komplett stumm.

Behoben über [`patch-package`](https://github.com/ds300/patch-package): das Paket liegt als
Dev-Dependency in `package.json`, der Fix selbst steckt in
`patches/react-native-mediapipe+0.6.0.patch` und wird über das `postinstall`-Skript
(`"postinstall": "patch-package"`) automatisch nach jedem `npm install` erneut in
`node_modules` angewendet. Der Patch ersetzt die feste `Orientation.PORTRAIT`-Zuweisung
durch die tatsächlich übergebene `orientation`. **Das ist eine native Änderung** — nach
`npm install` ist ein vollständiger `expo prebuild --clean` + `npm run android` nötig,
reines Metro-Reload reicht hier nicht (siehe Kommando-Block unten).

### Native Bugfix 2: komprimiertes Modell-Asset + unsichtbarer Initialisierungsfehler

Zweite, wahrscheinlich eigentliche Ursache derselben Symptomatik — und der Grund, warum
sie so schwer zu finden war: MediaPipe lädt das `.task`-Modell über
`BaseOptions.setModelAssetPath()` per **Memory-Mapping** aus dem APK-Asset-Verzeichnis.
Das funktioniert nur, wenn das Asset **unkomprimiert** gepackt ist. AAPT komprimiert aber
jede Dateiendung, die es nicht kennt, und `.task` steht auf keiner Ausnahmeliste — weder
`react-native-mediapipe`s eigenes `build.gradle` noch Expos Android-Template setzen
`noCompress` dafür. Ergebnis: `PoseLandmarker.createFromOptions()` scheitert beim Start.

Warum davon nie etwas zu sehen war (die eigentliche Falle):
`setupPoseLandmarker()` läuft im **Konstruktor** von `PoseDetectorHelper` — also *bevor*
`createDetector` sein Promise auflöst und damit bevor die JS-Seite den Handle in ihrer
`detectorMap` registriert hat. Das ausgelöste `onError`-Event wird auf der JS-Seite per
Handle nachgeschlagen, findet nichts und wird **kommentarlos verworfen**. `poseLandmarker`
bleibt anschließend für immer `null`, und jeder weitere `poseLandmarker?.detectAsync(...)`
ist ein stiller No-op — kein Ergebnis, kein Fehler, kein `onEmpty`. Also exakt die
beobachtete totale Stille, dauerhaft.

Drei Gegenmaßnahmen, damit das weder auftritt noch je wieder unsichtbar bleibt:

1. `plugins/withUncompressedModelAssets.js` (neu, in `app.json` registriert) hängt einen
   `androidResources { noCompress "task" }`-Block an `android/app/build.gradle` an, damit
   das Modell unkomprimiert in der APK landet.
2. Der Patch lässt `createDetector` das Promise **ablehnen**, wenn der Helper nach dem
   Konstruktor keinen lebenden `poseLandmarker` hat (`isClosed()`), statt einen toten
   Handle zurückzugeben — `usePoseDetection` loggt eine solche Ablehnung bereits selbst.
3. Der Patch loggt außerdem `onError`-Events für unbekannte Handles, statt sie zu
   verwerfen — damit ist ein Setup-Fehler samt Meldung in der Metro-Konsole sichtbar.
4. Der Patch normalisiert die Rotation auf `[0, 360)`. `OrientationHelpers.orientationToDegrees`
   bildet `LANDSCAPE_RIGHT` auf **`-90`** ab, was `ImageProcessingOptions.setRotationDegrees()`
   ablehnt. Solange die Rotation hartkodiert auf `PORTRAIT` (= 0) stand, war das folgenlos —
   erst durch Fix 1 wurde dieser Wert überhaupt erreichbar, und `detectAsync` hat kein
   try/catch, der Wurf landete also ungefangen im Frame-Processor.

Zusätzlich verdrahtet derselbe Patch `DetectorListener.onEmpty()` (Kotlin) auf ein neues
`"onEmpty"`-Event, das über `usePoseDetection({ ..., onEmpty })` auch auf der JS-Seite
ankommt (siehe `onEmpty` in `src/screens/WorkoutScreen.tsx`, dev-only Logging). Das
unterscheidet zweifelsfrei zwei bisher identisch stille Fälle: "MediaPipe bekommt Frames,
findet aber keine Pose" (jetzt sichtbar als `[DIAG] onEmpty`-Logs) vs. "es kommen gar keine
Frames beim Detektor an" (dann bleiben auch die `onEmpty`-Logs aus). Temporär, siehe
Kommentare in `WorkoutScreen.tsx` zum Entfernen.

### Native Bugfix 3: der Frame-Processor rief MediaPipe nie auf

Die eigentliche Ursache. Auf dem Gerät war belegt: Der Detektor wurde erfolgreich erzeugt
(`createDetector` löst auf — mit Fix 2 oben würde es sonst ablehnen), das Modell lud also
sauber, und Frames erreichten den Frame-Processor (dessen eigenes
`changing frame orientation` wurde geloggt). Trotzdem feuerte weder `onResults` noch
`onEmpty` noch `onError` — und **eines davon muss** feuern, sobald `detectAsync` läuft.
Der Aufruf erreichte MediaPipe also gar nicht.

Grund: `PoseDetectionFrameProcessorPlugin.callback()` las den Detektor-Handle als
`params?.get("detectorHandle") as? Double`. Je nachdem, wie die Bridge die JS-Zahl
verpackt — unter der New Architecture (RN 0.86 ist new-arch-only) durchaus als `Int` oder
`Long` — liefert `as? Double` schlicht `null`, und die Funktion steigt in genau dieser
Zeile aus, bevor MediaPipe je gefragt wird. Kein Ergebnis, kein Fehler, keine Spur.
Jetzt: `as? Number)?.toInt()`.

Direkt daneben lag eine zweite Falle: `params["orientation"] as String` war ein
*ungeprüfter* Cast, der bei einem anderen Typ eine `ClassCastException` in den
Frame-Processor wirft — sichtbar nur in Logcat, nie in der Metro-Konsole. Jetzt `as?
String ?: return false`.

Damit so etwas nicht wieder unsichtbar bleibt, loggt der Frame-Processor jetzt zusätzlich
den Rückgabewert von `plugin.call(...)` (`true` = an MediaPipe übergeben, `false` = einer
der stillen Ausstiege), und das Modul gibt beim Laden eine Zeile mit der Patch-Version
aus — damit auf einen Blick belegt ist, dass der laufende Build den Patch überhaupt
enthält.

### Der `buffer`-Absturz: warum die App gar nicht erst startete

Ein Logcat-Mitschnitt hat gezeigt, dass die App beim Start abstürzte, **bevor auch nur
eine Zeile eigener Code lief**:

```
Process: com.pushupcoach.app
com.facebook.react.common.DebugServerException: The development server returned response error code: 500
"type":"UnableToResolveError", "targetModuleName":"buffer"
Unable to resolve module buffer from node_modules/react-native-svg/src/utils/fetchData.ts
```

`react-native-svg` importiert dort das Node-Modul `buffer`, ohne es als eigene Abhängigkeit
zu deklarieren. Metro behandelt einen nackten `buffer`-Import als Node-Builtin und
verweigert die Auflösung — womit das **gesamte Bundle** scheitert, nicht nur dieser eine
Codepfad. Das erklärt rückwirkend eine ganze Reihe scheinbar unerklärlicher Testläufe, in
denen keinerlei Diagnose-Ausgabe erschien: Es lief schlicht kein JavaScript.

Der Alias in `metro.config.js` behebt das zwar, aber nur solange diese Konfiguration
tatsächlich geladen ist **und** Metros Auflösungs-Cache frisch ist. Eine veraltete
Metro-Instanz (im betroffenen Log liefen Metro-Server auf Port 8081, 8082, 8083 *und* ein
Tunnel gleichzeitig) bringt den Fehler sofort zurück — und er sieht dann wie ein App-Bug
aus, nicht wie ein Bundler-Problem.

Deshalb ist der `buffer`-Import jetzt zusätzlich per `patches/react-native-svg+15.14.0.patch`
ganz entfernt: `decodeBase64Image` dekodiert base64 direkt über `atob` plus eine
UTF-8-Umwandlung. Das ist verhaltensgleich, betrifft ohnehin nur base64-SVG-Daten-URIs
(diese App nutzt `react-native-svg` nur für das Skelett-Overlay aus Linien und Kreisen) —
und macht die Fehlerklasse dauerhaft unmöglich. Der Metro-Alias bleibt als zweite
Absicherung bestehen, falls eine andere Bibliothek denselben Import mitbringt.

**Merke für die Fehlersuche:** Wenn gar keine erwartete Konsolenausgabe erscheint, zuerst
prüfen, ob das Bundle überhaupt lädt (`adb logcat` statt nur der Metro-Konsole) und ob
mehrere Metro-Instanzen laufen.

### Warum die Kamera-Orientierung festgenagelt ist

Im ersten Lauf, in dem die Erkennung nachweislich funktionierte, zeigte der Log eine
eindeutige Korrelation:

| Gemeldete `orientation` | Ergebnis |
|---|---|
| `portrait` | `[DIAG]` mit gültigen Winkeln — Erkennung läuft |
| `landscape-left` | `onEmpty` am Stück, über 500 Frames ohne jede Pose |

Sobald VisionCameras Lagesensor auf `landscape-left` umsprang, fand MediaPipe **gar keine
Person mehr**. Beim Liegestütz schwankt dieser Sensorwert ständig, weil das Handy bewegt
oder gekippt wird — die Erkennung fiel also im Betrieb regelmäßig komplett aus.

Da die App in `app.json` fest auf `orientation: "portrait"` gesperrt ist und sich die
Oberfläche nie dreht, ist `forceOutputOrientation: 'portrait'` hier nicht nur unschädlich,
sondern korrekt: MediaPipe bekommt eine stabile Rotation, und der `BaseViewCoordinator`
rechnet die Landmarks gegen genau die Ausrichtung um, die die Ansicht tatsächlich hat —
was nebenbei das Skelett-Overlay ruhigstellt.

Die Einstellung liegt zusammen mit Modellname und Konfidenz-Schwellen in
`src/pose/poseDetectionOptions.ts` und wird von allen drei Kamera-Screens (Training,
Boss-Modus, Duell) geteilt, damit eine Nachjustierung nicht in drei Dateien einzeln
nachgezogen werden muss.

### Kalibrierungs-Datensammlung (temporär, nur für die Entwicklung)

**`src/pose/calibrationLogger.ts`** sammelt die gemessenen Werte (`RepResult`: minimaler
Ellenbogenwinkel, Hüftgeradheit, Ellenbogen-Abspreizung, Nackenwinkel, Dauer, Form-Score)
jeder abgeschlossenen Wiederholung aus Training **und** Boss-Modus lokal (`AsyncStorage`),
damit `DEFAULT_THRESHOLDS` anhand echter Gerätedaten statt Schätzungen kalibriert werden
kann, solange die App noch in aktiver Entwicklung ist. Auf dem Home-Screen gibt es dafür
einen Button „🧪 Kalibrierungsdaten teilen (DEV)", der die gesammelten Daten als JSON über
das Betriebssystem-Teilen-Menü verschickt (z. B. per Mail an sich selbst, dann am PC
auswerten).

**Nach dem Übertragen löschen:** Langes Drücken auf denselben Knopf fragt nach und leert
den Log. Ohne das wächst er endlos weiter, und jede weitere Übertragung enthält alles noch
einmal mit. Bewusst kein zweiter Knopf daneben — Danebentippen würde Daten vernichten, die
sich nur durch ein weiteres Training wiederbeschaffen ließen.

Geteilt wird kompaktes JSON ohne Einrückung: Der Text geht als Intent-Extra an die
Ziel-App, und Android deckelt die Größe einer solchen Übergabe. Eingerückt wäre die Datei
rund ein Drittel größer, ohne dass ein Mensch sie deshalb liest — ausgewertet wird sie am
PC mit `npm run analyze:reps`.

**Wieder entfernen, sobald die Kalibrierung abgeschlossen ist:**
1. `src/pose/calibrationLogger.ts` löschen.
2. Die mit `DEV CALIBRATION` kommentierten Zeilen in `WorkoutScreen.tsx` und
   `BossFightScreen.tsx` entfernen (jeweils ein Import + ein Aufruf).
3. Den mit `DEV CALIBRATION` kommentierten Button + die zugehörigen Styles in
   `HomeScreen.tsx` entfernen.

Kein anderer Teil der App hängt von diesem Modul ab - die drei Schritte oben reichen.

### Drei Fallen im „ohne await"-Muster (10.09.2026)

An mehreren Stellen wird bewusst ohne `await` aufgerufen, damit ein Netzwerk- oder
Speicherproblem das Beenden eines Workouts nicht aufhält. Das ist richtig so — hat aber
drei Fallen, in die dieses Projekt teils schon getappt war:

**1. Lese-Ändern-Schreib-Rennen.** `calibrationLogger.append` lud den ganzen Log, hängte
einen Eintrag an und schrieb alles zurück. Zwei dicht aufeinanderfolgende Aufrufe — eine
verworfene Bewegung und die nächste gezählte Wiederholung liegen nur Frames auseinander —
lasen denselben Stand, und der zuerst geschriebene Eintrag ging verloren. Alle
Schreibvorgänge laufen jetzt nacheinander durch eine Promise-Kette. Der Test dazu benutzt
einen künstlich verzögerten Speicher; ohne die Verzögerung liefe jeder Aufruf durch, bevor
der nächste beginnt, und der Test bestünde auch mit kaputtem Code.

**2. Doppelt gutgeschriebene Liegestütze.** `flushPendingLeaderboardSync` und
`flushPendingNationsSync` laden die Warteschlange, schreiben jeden Eintrag gut und speichern
den Rest. Zwei gleichzeitige Läufe hätten dieselben Einträge doppelt gezählt — und das
lässt sich ganz normal auslösen: Der Aufruf nach einem beendeten Training läuft ohne
`await` weiter, und wer währenddessen zum Startbildschirm zurückkehrt, stößt dort den
nächsten an. Ein laufender Durchlauf wird jetzt mitbenutzt, statt ein zweiter gestartet.

**3. `useRef(new X())` im Kamera-Pfad.** Das Argument von `useRef` wird bei **jedem** Render
ausgewertet, auch wenn nur das erste Ergebnis behalten wird. Die Kamera-Bildschirme rendern
pro Kamerabild neu, es entstand also gut ein Dutzend sofort weggeworfener `PushUpAnalyzer`
pro Sekunde — genau in dem Pfad, der ohnehin am meisten zu tun hat. Dafür gibt es jetzt
`usePushUpAnalyzer()` (`src/pose/usePushUpAnalyzer.ts`), von allen drei Bildschirmen
benutzt.

## Wenn etwas abstürzt: Fehlergrenze und Fehlerbericht

**Das Problem, das das löst:** chris hat eine Installation, und das ist der Release-Build —
kein Metro, kein Kabel, kein Logcat (siehe CLAUDE.md). Stürzte bisher irgendein Bildschirm
ab, riss React den kompletten Baum ab und übrig blieb eine **weiße Fläche**. Was bei mir
ankam, war „die App geht nicht", und jede Fehlersuche begann bei null — eine Runde pro
Build.

Jetzt greifen zwei Netze:

**1. `ErrorBoundary`** (`src/components/ErrorBoundary.tsx`) fängt Fehler beim *Zeichnen* ab
und zeigt: was passiert ist, einen Knopf „Fehlerbericht teilen", einen Knopf „Nochmal
versuchen" — und den Satz, der nach einem Absturz als Erstes gebraucht wird: *„Dein
Trainingsverlauf ist davon nicht betroffen."*

**2. `installGlobalErrorHandler()`** (`src/diagnostics/globalErrorHandler.ts`) fängt alles
*außerhalb* des Zeichnens: Knopf-Handler, Zeitgeber, den Kamera-Frame-Pfad, nicht
abgefangene Zusagen. In dieser App sitzt dort das meiste — die Posenerkennung läuft
ausschließlich in Rückrufaktionen. Der bisherige Behandler wird aufgehoben und danach
weiter aufgerufen, nicht ersetzt: Ihn zu verschlucken würde aus einem sichtbaren Absturz
eine App machen, die einfach einfriert.

Beides landet in `src/diagnostics/errorLog.ts` — Meldung, Aufrufliste, Ort, Zeit,
App-Version. Auf dem Startbildschirm erscheint **nur dann** ein roter Knopf, wenn wirklich
etwas aufgezeichnet wurde (lang drücken löscht, wie beim Kalibrier-Log).

**Zum Datenschutz:** Aufgezeichnet werden keine Nutzerdaten — kein Name, keine E-Mail,
keine Trainingsdaten. Eine Aufrufliste *kann* theoretisch Variableninhalte enthalten,
deshalb geht der Bericht ausschließlich über den Teilen-Dialog: chris sieht vor dem
Abschicken, was drinsteht, und entscheidet an wen. Nichts verlässt das Gerät von allein.

**Zwei Entwurfsentscheidungen mit Begründung:**

- `recordError()` wirft **nie** selbst. Sie läuft in einem Fehlerbehandler — würde sie bei
  vollem Speicher ihrerseits werfen, entstünde aus einem behandelbaren Fehler ein Absturz,
  und zwar genau in dem Moment, in dem die App sich gerade fängt.
- Beim Überlauf werden die **ältesten** Einträge behalten. Bei einem Fehler, der sich bei
  jedem Frame wiederholt, zeigt der erste die Ursache und alle folgenden nur deren Folgen.
  Der Bericht sagt dazu, wenn die Aufzeichnung voll war.

**Geprüft, nicht behauptet:** 12 Tests, darunter einer, der die Fehlergrenze wirklich einen
Fehler fangen lässt — eine Fehlergrenze ist der klassische Fall von Code, der nie läuft und
dessen Versagen genau dann auffällt, wenn man ihn gebraucht hätte. Dazu wurde in der
Web-Vorschau ein echter Renderfehler erzwungen (`Array.prototype.map` gekapert) und
nachgesehen, dass tatsächlich der Fehlerbildschirm erscheint statt einer weißen Fläche.

## Ein Ort für Abstände, Rundungen und Schriftgrößen

`src/theme/layout.ts`. Jede Abstands-, Rundungs- und Schriftzahl der App läuft durch
`space()`, `radius()` oder `font()` — und ganz oben in der Datei stehen drei Faktoren:

```ts
const SPACING_SCALE = 1;   // 1.15 = überall 15 % luftiger
const RADIUS_SCALE  = 1;   // 0.25 = fast eckig
const FONT_SCALE    = 1;   // 1.1  = alle Texte größer
```

**Eine Zahl ändert die ganze App.** Vorher standen 626 Werte als Literale in 20
StyleSheets: „alles etwas luftiger" hieß, jede Stelle einzeln anzufassen und dabei
Dutzende zu übersehen. Zusammen mit `npm run web` (Ergebnis in ein bis zwei Sekunden im
Browser) ist das der Design-Weg, um den es die ganze Zeit ging.

**Drei getrennte Faktoren, weil es drei unabhängige Fragen sind.** „Zu gedrängt" hat nichts
mit „zu rund" zu tun, und wer größere Schrift will, will deshalb keine größeren Abstände.

### Warum die Übernahme nichts verändert hat

Die Umstellung war bewusst **wirkungsneutral**: `space(16)` ergibt bei Faktor 1 exakt die
16, die vorher dort stand. Das ist nicht behauptet, sondern gemessen — acht Bildschirme
wurden vor und nach dem Umbau im Browser aufgenommen und Pixel für Pixel verglichen:

| Bildschirm | Abweichung |
|---|---|
| Start, Training, Boss, Profil, Shop, Rangliste | **0 von 1.512.000 Pixeln** |
| Effekt-Werkstatt | 0,2 % — laufende Animationen |
| Länderspiel | 0,08 % — die mitlaufende Countdown-Anzeige |

Die beiden Abweichungen sind keine Layout-Änderungen: Zwei Aufnahmen **derselben** Version
unterscheiden sich an genau denselben zwei Stellen in derselben Größenordnung.

### Was bewusst nicht gemacht wurde

Es wäre naheliegend gewesen, bei der Gelegenheit aufzuräumen. Die App benutzt heute 2, 4,
6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32 und 48 — praktisch jede gerade Zahl. Eine
strengere Stufung (nur 4, 8, 16, 24, 32) wäre sauberer, verschiebt aber überall die Optik.
Dasselbe gilt für benannte Maße wie `cardRadius`: Karten benutzen heute 14, 16, 18 und 20
als Rundung, ein gemeinsamer Name hieße, sich für einen davon zu entscheiden.

Beides sind **Design-Entscheidungen** — und die gehören chris, sobald er sie im Browser
vergleichen kann. Sie nebenbei in einem Umbau mitzunehmen, dessen ganzer Zweck
Wirkungsneutralität war, hätte aus einer prüfbaren Änderung eine stille Umgestaltung
gemacht.

Ein Test hält beide Zusagen fest (`src/theme/__tests__/layout.test.ts`): dass die
eingecheckten Faktoren neutral stehen — beim Vorführen des Hebels wäre ein Demo-Wert fast
im Commit gelandet — und dass in den Haupt-Bildschirmen keine nackten Zahlen zurückkehren.

## Web-Vorschau: Layout am PC ändern, ohne Gradle und ohne Handy

```bash
npm run web
```

Öffnet die App im Browser mit Sofort-Reload. Jede Änderung an Layout, Abständen, Farben,
Texten oder Animationen ist in ein bis zwei Sekunden sichtbar — statt eines
Gradle-Builds und eines Handys.

**Was funktioniert:** alle Bildschirme, Kacheln, Listen, die Effekt-Werkstatt, Missionen,
Shop, Profil, Länderspiel. Auch die Anzeigen, die im Training **über** dem Kamerabild
liegen (Zähler, Form-Hinweis, Startpositions-Overlay) — dahinter liegt statt der Kamera
eine ruhige dunkle Fläche.

**Was nicht funktioniert und auch nicht soll:** Kamera, Posenerkennung, Zählen,
Google-Anmeldung, Benachrichtigungen. Die Web-Vorschau ist ein *Design*-Werkzeug, kein
Testgerät. Was gezählt wird, entscheidet weiterhin nur das Handy.

### Wie das ohne zweite Codebasis geht

Drei native Pakete gibt es im Browser nicht. Für `platform === 'web'` leitet
`metro.config.js` sie auf Attrappen in `src/web-stubs/` um; der Android-Build sieht davon
nichts und benutzt weiterhin die echten Pakete.

Der eigentliche Blocker war `react-native-vision-camera`: Es wirft schon **beim Import**
„VisionCamera currently does not work on web" — nicht erst beim Benutzen. Ohne die
Umleitung bleibt die ganze Vorschau weiß, auch auf Bildschirmen ohne Kamera. Dazu kamen
zwei kleinere: `expo-secure-store` gibt es auf dem Web nicht (das Profil weicht dort auf
AsyncStorage aus — **nur** für die Vorschau, unverschlüsselt; auf dem Handy bleibt es beim
Schlüsselbund des Betriebssystems), und geplante Benachrichtigungen sind dort ein stilles
Nichts statt eines Fehlers.

### Was die Vorschau sofort eingebracht hat

Zwei echte Fehler in der frisch gebauten Effekt-Werkstatt, die weder `tsc` noch die Tests
finden konnten — beide wären erst chris auf dem Handy aufgefallen, nach einem kompletten
Release-Build:

1. **Flammen und Blitze lagen mitten auf dem Avatar** statt an seinem Rand, also unsichtbar
   hinter dem Ring. Ursache: Der Kasten, der sie auf ihre Kreisbahn dreht, zentriert seinen
   Inhalt — er muss ihn oben am Rand halten, denn der Radius *ist* die halbe Kastenbreite.
2. **Die Effektebene lag über dem Avatar** statt dahinter und dämpfte Zahl und Foto. Auf
   dem Handy entscheidet die Reihenfolge der Geschwister, im Browser aber nicht: CSS malt
   jedes *positionierte* Element über seine statischen Geschwister, unabhängig von der
   Reihenfolge. Behoben mit einem ausdrücklichen `zIndex`, der auf beiden Plattformen gilt.

### Und wo sie an ihre Grenze kommt

„Flammen" liest sich in einem **Standbild** wie ein Blütenblatt, nicht wie Feuer. Ich habe
die Silhouette dreimal überarbeitet und dabei gemerkt: Das ist die falsche Frage an ein
Standbild. Feuer erkennt man am **Flackern**, nicht an der Form — ein eingefrorener
Einzelbild-Ausschnitt jeder Flammenanimation sieht aus wie ein Klecks. Dasselbe gilt für
„Blitze", die die meiste Zeit aus sind.

Ehrlich gesagt: **Leuchten, Lichtlauf, Funken und Aura kann ich am Standbild beurteilen,
Flammen und Blitze nicht.** Die entscheidet, wer sie sich in Bewegung ansieht — am Handy
oder mit `npm run web`. Bleiben sie auch dort unbefriedigend, ist das das Argument für
Lottie (siehe `docs/grafik-plan.md`), und dann mit Grund statt auf Verdacht.

## Effekt-Werkstatt (Werkzeug, kein Spielinhalt)

Erreichbar über den Startbildschirm: **🎨 Effekt-Werkstatt (DEV)**.

**Wofür.** Bis hierher lief jede optische Änderung so: Ich baue etwas, chris baut die App
neu, schaut es an, beschreibt in Worten was ihm nicht passt, ich rate was gemeint ist. Eine
Runde kostet einen Build und einen Abend.

Dieser Bildschirm dreht das um. Alle Rahmen-Effekte laufen **gleichzeitig auf dem Handy**,
mit Reglern für Stärke, Tempo und Größe sowie Umschaltern für Rang und Rahmen-Theme. Unten
steht die Auswahl als eine Zeile:

```
Aura · Stärke 70 % · Tempo 40 % · Größe 96 px · Rang Challenger
```

Die schickt chris per „Auswahl teilen" — und ich setze genau das ein, statt zu raten.

**Sieben Effekte** (`src/ranking/frameEffects.ts`): Ohne (Vergleichsmaßstab), Leuchten,
Lichtlauf, Funken, Flammen, Blitze, Aura.

**Warum das keine Bilddateien sind.** Ausführlich in `docs/grafik-plan.md`, kurz: keine
neue native Abhängigkeit (`react-native-svg`, `expo-linear-gradient` und die Animationen von
React Native waren längst da — also kein `npm install`, kein Prebuild, kein neues
Gradle-Risiko), die Rangfarbe kommt automatisch mit, es bleibt bei 36 px genauso scharf wie
bei 140 px, und „etwas weniger grell" ist ein Zahlenwert statt einer neuen Runde beim
Bildgenerator.

**Wie animiert wird.** Ausschließlich `transform` und `opacity` über den **Native-Treiber**
(`useNativeDriver: true`); die Formen selbst (Flammenzunge, Blitz, Aura-Verlauf) sind
statisches SVG. Der naheliegendere Weg — die SVG-Pfade selbst animieren (Reanimated +
`useAnimatedProps`) — läuft auf dem JS-Thread, und zwar ausgerechnet dort, wo bei dieser App
schon die Posenerkennung rechnet. Was das kostet: Eine Flamme kann ihre *Form* nicht
verändern, nur Größe, Lage und Deckkraft. Für mehrere Zungen mit versetzten Phasen reicht
das; für eine echte, sich verformende Flamme wäre Lottie der richtige Weg.

**Zwei Fallen, die beim Bauen zugeschlagen haben** (beide stehen als Kommentar im Code):

- Ein Teilchen mit `translateY` nach außen schieben und *dann* drehen dreht um den
  Mittelpunkt des **Teilchens**, nicht um den des Avatars. Richtig ist ein quadratischer
  Kasten, der sich dreht, mit dem Teilchen oben mittig — der Radius ist dann die halbe
  Kastenbreite.
- `Animated.delay` **innerhalb** von `Animated.loop` wartet bei *jedem* Durchlauf erneut;
  aus gleichmäßigem Kreisen wird Stottern. Gewollt ist eine einmalige Phasenverschiebung,
  also ein `setTimeout` vor dem Start der Schleife.

**Der Schieberegler ist selbst gebaut** (`src/components/Slider.tsx`). React Native bringt
seit Jahren keinen mit, und `@react-native-community/slider` wäre eine **native**
Abhängigkeit — für einen Regler in einem Werkzeug-Bildschirm der falsche Preis, und es
widerspräche genau der Begründung, mit der die Effekte ohne neue Abhängigkeit auskommen.

**Nicht hinter `__DEV__`**, aus demselben Grund wie der Kalibrier-Knopf: chris hat nur eine
Installation, und das ist der Release-Build (siehe CLAUDE.md). Ein Werkzeug, das genau die
Person nicht erreicht, für die es gebaut wurde, wäre sinnlos.

**Getestet** wird, was sich ohne Gerät testen lässt: die Rechnung hinter den Reglern
(`src/ranking/__tests__/frameEffects.test.ts`) und dass jeder Effekt und der ganze
Bildschirm sich überhaupt rendern lassen, auch an beiden Reglergrenzen
(`src/components/__tests__/FrameEffectLayer.test.tsx`,
`src/screens/__tests__/EffectWorkshopScreen.test.tsx`). Das sind genau die Fehler, die `tsc`
klaglos durchlässt und die sonst erst auf dem Gerät auffliegen — nach einem kompletten
Release-Build. Ob es *gut aussieht*, kann kein Test sagen; dafür ist der Bildschirm da.

## Tests & Typecheck

```bash
npm test          # Jest — Unit-Tests für Rep-Zählung, Form-Scoring, Punkte/Level, Streak,
                  #        Länderspiel-Zeitplan und die Wächter-Tests fürs Regelwerk
npm run typecheck # tsc --noEmit
```

Die Kernlogik (`src/pose/formAnalysis.ts`, `src/gamification/points.ts`,
`src/storage/workoutStorage.ts`) ist bewusst UI- und Native-Code-frei gehalten, damit sie
ganz ohne Gerät/Simulator getestet werden kann. Ein synthetischer Pose-Builder
(`src/pose/testing/poseBuilder.ts`) erzeugt dafür 33-Punkt-Skelette mit exakt
kontrollierten Winkeln.

**Hinweis zur Verifikation:** Diese Cloud-Sandbox hat kein Android SDK und keine
Kamera/kein physisches Gerät, daher konnte der eigentliche native Android-Build hier
nicht bis zum Ende durchlaufen werden — dein `npm run android` bei dir ist der erste
echte End-to-End-Test. Was hier tatsächlich verifiziert wurde:

- `tsc --noEmit` und alle Unit-Tests laufen grün.
- `expo prebuild` wurde real ausgeführt: das generierte `android/`-Projekt hat die
  richtige Kamera-Berechtigung im Manifest, die richtige `applicationId`, und das
  MediaPipe-Modell korrekt unter `android/app/src/main/assets/` gebündelt.
- Der komplette Metro/Babel-Bundling-Schritt (der auch beim nativen Build läuft, nicht
  nur im Browser) wurde real durchlaufen — dabei kamen **fünf fehlende
  `@babel/plugin-*`-Pakete** zum Vorschein, die `react-native-worklets-core`s
  Kamera-Frame-Prozessor-Transform braucht, aber die nicht automatisch mitinstalliert
  wurden. Alle fünf sind jetzt in `package.json` als `devDependencies` ergänzt — ohne
  diesen Fund hätte vermutlich dein erster `npm run android` mit einer kryptischen
  "Cannot find module '@babel/plugin-transform-...'"-Fehlermeldung abgebrochen.
- Eine Browser-Vorschau (`expo start --web`) ist mit MediaPipe **nicht mehr möglich**
  (`react-native-vision-camera` verweigert bewusst die Web-Plattform) — das ist normales,
  erwartetes Verhalten der Bibliothek und betrifft den echten Android-Build nicht.

Was noch aussteht: der eigentliche native Gradle-Compile-Schritt, echtes
Kamera-Tracking, und ob die Zähl-/Bewertungslogik sich auf einem echten Körper richtig
anfühlt (Kalibrierung).

## Google-Anmeldung einrichten

Die App bietet jetzt optional „Mit Google anmelden" auf dem Home-Screen (Profilbild,
Name, E-Mail) — zur Personalisierung und als Grundlage für das später geplante
Online-Ranking (siehe Roadmap). Es gibt noch kein eigenes Backend, also auch keinen
echten Account und keine Cloud-Synchronisierung: Das Profil wird nur lokal und
**verschlüsselt** (`expo-secure-store`, also Android Keystore / iOS Keychain — nicht die
unverschlüsselte `AsyncStorage`, die sonst für die Trainingshistorie genutzt wird) auf
dem Gerät gespeichert. Anmelden ist komplett optional, die App funktioniert ohne genauso.

Die im Code hinterlegten Platzhalter-IDs gehören zu keinem echten Google-Projekt — damit
„Mit Google anmelden" bei dir funktioniert, brauchst du einmalig eigene OAuth-Client-IDs:

1. **Google Cloud Console öffnen**: https://console.cloud.google.com/ → neues Projekt
   anlegen (oder ein bestehendes wählen).
2. **OAuth-Zustimmungsbildschirm** einrichten (APIs & Dienste →
   OAuth-Zustimmungsbildschirm): externen Nutzertyp wählen. Alle Feldwerte (App-Name,
   Support-E-Mail, Startseite, Datenschutz-/Nutzungsbedingungen-Link, autorisierte
   Domain) stehen fertig zum Eintragen in
   [`docs/play-store-listing.md`](docs/play-store-listing.md) → Abschnitt
   „Google-OAuth-Zustimmungsbildschirm" — nur die Kontakt-E-Mail musst du dort noch
   ersetzen. Für eigene Tests reicht der „Testing"-Modus mit deiner E-Mail als
   Testnutzer — für die Play-Store-Veröffentlichung muss er später auf „In Produktion"
   gestellt werden (die verwendeten Scopes sind nicht „sensibel", daher entfällt Googles
   aufwändige Verifizierungsprüfung).
3. **Android-OAuth-Client anlegen** (APIs & Dienste → Anmeldedaten → + Anmeldedaten
   erstellen → OAuth-Client-ID → Android):
   - Paketname: `com.pushupcoach.app` (`app.json` → `android.package` — das ist aktuell
     ein Platzhalter, siehe „Play-Store-Veröffentlichung" unten, warum er sich später
     nicht mehr ändern lässt).
   - SHA-1-Fingerabdruck deines Debug-Keystores (zum lokalen Testen):
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
     (Android Studio legt diesen Debug-Keystore beim ersten Build automatisch mit
     Standard-Passwort `android` an.)
   - Für den späteren Play-Store-Release brauchst du zusätzlich einen **zweiten**
     Android-Client mit dem SHA-1 deines Release-Keystores (siehe unten) — unterschiedliche
     Keystores haben unterschiedliche SHA-1-Werte, das ist der häufigste
     Google-Sign-In-Stolperstein beim Wechsel von Debug- zu Release-Build.
4. **Web-OAuth-Client anlegen** (gleicher Dialog, Typ „Web-Anwendung", kein Redirect-URI
   nötig): Das ist die ID, die `@react-native-google-signin/google-signin` intern als
   `webClientId` braucht — auch auf Android, zusätzlich zum Android-Client aus Schritt 3
   (ein Google-Detail, keine Fehlkonfiguration deinerseits). Trag sie in `app.json` unter
   `expo.extra.googleSignInWebClientId` ein (ersetzt
   `REPLACE_WITH_YOUR_WEB_CLIENT_ID...`).
5. **(nur falls du auch für iOS baust) iOS-OAuth-Client anlegen**: Bundle-ID
   `com.pushupcoach.app`, liefert eine Client-ID der Form
   `123-abc.apps.googleusercontent.com`. Die „umgedrehte" Form davon
   (`com.googleusercontent.apps.123-abc`) trägst du in `app.json` unter
   `expo.plugins` → `@react-native-google-signin/google-signin` → `iosUrlScheme` ein
   (ersetzt `com.googleusercontent.apps.REPLACE_WITH_YOUR_IOS_CLIENT_ID`).
6. Danach `npm run prebuild` (bzw. `npm run android`/`npm run ios`) erneut ausführen,
   damit die neuen Werte in den nativen Build einfließen.

Solange die Platzhalter noch drinstehen, bricht „Mit Google anmelden" mit einem Fehler
ab — das ist erwartet und kein Bug.

## Ranking-System einrichten

**Status: Freundschaftsspiel *und* Ranked spielbar, dazu eine Rangliste (Gesamt/Woche/Liga/Freunde) mit Profil-Ansicht, sobald Firebase eingerichtet ist.**
Fertig und getestet: LP-/Rangsystem, Uhrzeit-Abgleich, Spieler-Avatare mit Rang-Rahmen,
der komplette Duell-Ablauf (Home-Screen → „Freundschaftsspiel" per Einladungscode oder
„Ranked" per Skill-based Matchmaking → synchronisierter 60-Sekunden-Kampf mit Kamera +
Live-Gegner-Zähler → Ergebnis inkl. LP-Änderung bei Ranked). Beide Modi teilen sich
denselben `DuelScreen`/`DuelResultScreen` (Parameter `isRanked` steuert nur, ob am Ende
LP verrechnet wird).

### Spieler-Avatare & Rang-Rahmen

Datenmodell steht (`src/ranking/avatar.ts`): ein Avatar ist entweder ein Icon aus einer
festen Auswahl oder ein eigenes Foto (Selfie) - `PlayerAvatar = {type:'icon', iconId} |
{type:'photo', photoUrl}`. Neue Spieler starten mit dem eigenen Google-Profilbild als
Foto-Avatar (`avatarFromGooglePhoto`), fallback auf ein Platzhalter-Icon. **Die
eigentliche Icon-/Bild-Gestaltung kommt in einem eigenen Schritt** - die
Platzhalter-Icons in `AVATAR_ICON_IDS` sind bewusst nur ein Platzhalter-Set (Ionicons),
der Typ `AvatarIconId` bleibt aber stabil, wenn die richtigen Icons kommen.

`RankFrame.tsx` zeichnet um jeden Avatar einen Rahmen, der sich mit dem Rang optisch
steigert (`src/ranking/rankFrameStyle.ts`, reine Konfiguration + eigene Tests):
Bronze/Silber sind ein schlichter, matter Farbring; Gold bekommt einen echten
Farbverlauf; Diamant zusätzlich ein Leuchten (Glow); Challenger einen mehrfarbigen
Farbverlauf, das stärkste Leuchten *und* ein leichtes Pulsieren. Wird überall verwendet,
wo ein Spieler im Duell auftaucht (Lobby, Duell-HUD, Ergebnis-Screen) - sobald es echte
Icons/Fotos gibt, ändert sich nur `AvatarContent` in `RankFrame.tsx`, der Rahmen bleibt.

### Freundschaftsspiel-Duell (bereits implementiert)

- **`src/duel/duelCode.ts`**: 6-stelliger, mündlich teilbarer Code (ohne verwechselbare
  Zeichen wie 0/O, 1/I/L), rein getestet.
- **`src/duel/duelSession.ts`**: die eigentliche Realtime-Database-Logik - Duell
  erstellen/beitreten (per Transaktion, verhindert doppeltes Beitreten/mehr als 2
  Spieler), "bereit"-Markierung (sobald beide bereit sind, setzt *eine* der beiden
  Transaktionen den gemeinsamen `startsAtServerTime`-Zeitpunkt - berechnet aus der
  geschätzten Serverzeit, nicht aus der eigenen, potenziell ungenauen Gerätezeit, siehe
  `clockSync.ts`), Live-Wiederholungszähler, Endergebnis.
- **`DuelLobbyScreen`**: „Duell erstellen" (zeigt den Code zum Teilen) oder „Mit Code
  beitreten". Lädt/erstellt dabei automatisch das Firestore-Spielerprofil
  (`playerProfileStore.ts`) inkl. Start-LP.
- **`DuelScreen`**: identische Kamera-/Zähl-Logik wie im Solo-Training
  (`PushUpAnalyzer`, siehe unten „Faire Zählung"), aber mit eigenem HUD: eigener Zähler
  oben links, **nur der Punktestand** (keine Kamera!) des Gegners oben rechts, dazu ein
  synchronisierter Countdown und 60-Sekunden-Timer.
- **`DuelResultScreen`**: wartet, bis beide Spieler fertig sind, zeigt den Vergleich;
  bei einem Ranked-Duell zusätzlich die LP-Änderung.
- **Google-Anmeldung ↔ Firebase-Anmeldung verknüpft**: `AuthContext` meldet nach dem
  Google-Login jetzt zusätzlich bei Firebase Auth an (`firebaseAuthBridge.ts`,
  `signInWithCredential` mit dem Google-ID-Token) - nötig, damit die
  Security Rules (`request.auth`) überhaupt greifen. Wichtig: die Firebase-uid ist
  *nicht* dieselbe ID wie die lokale Google-Profil-ID - für alles Ranking-Bezogene
  zählt ausschließlich die Firebase-uid.
- **`useDuelIdentity()`** (`src/ranking/useDuelIdentity.ts`): die gemeinsame
  Voraussetzung jedes Ranking-Screens (Firebase eingerichtet? Google angemeldet? mit
  Firebase verknüpft? Spielerprofil geladen/angelegt?) an einer Stelle gebündelt -
  sowohl `DuelLobbyScreen` als auch `RankedMatchmakingScreen` nutzen ihn.

### Ranked-Matchmaking (bereits implementiert)

Wie im README-Abschnitt weiter unten skizziert: rein client-seitig, kein Cloud
Function nötig, bleibt im kostenlosen Firebase-Tarif.

- **`src/ranking/matchmaking.ts`**: reine Suchradius-Logik, getestet - Radius startet
  bei ±100 LP, wächst alle 5 Sekunden um 50, deckelt bei ±600.
- **`src/ranking/matchmakingQueue.ts`**: Firestore-Warteschlange (`rankedQueue/{uid}`).
  Jeder wartende Spieler sucht *gleichzeitig* selbst nach anderen wartenden Spielern
  innerhalb seines aktuellen Radius (`findCandidates`, Query über `status`+`lp`+
  `queuedAtMs` - Composite-Index dafür liegt fertig in `firestore.indexes.json`) und
  versucht, den ältesten Wartenden per Firestore-Transaktion zu "claimen"
  (`tryClaimCandidate` - falls zwei Spieler gleichzeitig denselben Kandidaten
  beanspruchen, gewinnt nur eine Transaktion, die andere merkt das und sucht weiter).
  Wer erfolgreich claimt, erstellt das eigentliche Duell (dieselbe
  `duelSession.ts`-Logik wie beim Freundschaftsspiel) und ist damit fertig; wer
  geclaimt *wurde*, bemerkt das über einen Listener auf die eigene Warteschlangen-
  Position und tritt dem erzeugten Duell bei.
- **`RankedMatchmakingScreen`**: „Gegner suchen" → wartet (mit Abbrechen-Möglichkeit) →
  navigiert automatisch zum `DuelScreen`, sobald ein Gegner gefunden wurde (durch
  eigenes Claimen oder weil man selbst geclaimt wurde).

### Rangliste (bereits implementiert)

Eigener Menüpunkt auf dem Home-Screen („Rangliste", `LeaderboardScreen.tsx`) mit vier
Unter-Tabs, alle über `useDuelIdentity()` genau wie Freundschaftsspiel/Ranked gegatet
(Firebase eingerichtet + mit Google angemeldet nötig, da es eine Firestore-uid braucht):

- **Gesamt**: alle jemals absolvierten Liegestütze, über alle Spieler hinweg, absteigend
  sortiert (`players.totalReps`).
- **Diese Woche**: dasselbe, aber nur die aktuelle (Montag-basierte) Woche
  (`players.weeklyReps`).
- **Meine Liga**: alle Spieler in derselben Rang-Stufe (Bronze/Silber/Gold/Diamant/
  Challenger, siehe „LP-/Rangsystem") wie man selbst, nach LP sortiert - eine
  Bestenliste unter Gleichgesinnten statt der gesamten Spielerbasis.
- **Freunde** (per Ein/Aus-Schalter oben auf dem Screen ausblendbar, siehe
  „Freundesliste" unten): ich selbst + alle, die ich per Freundescode hinzugefügt habe,
  nach Gesamt-Liegestützen sortiert.

Ein Tap auf eine beliebige Zeile öffnet das (bei anderen Spielern schreibgeschützte)
Profil dieser Person, siehe „Profil-Screen & Level 1-50".

**Datenmodell** (`src/ranking/playerProfile.ts`, dieselben `players/{uid}`-Dokumente wie
fürs LP-System): zwei neue Felder, `totalReps` und `weeklyReps` + `weeklyBucketKey`.
Kein Cloud Function nötig, wie beim Rest des Ranking-Systems - dafür ein paar bewusste
Vereinfachungen:

- **Sync statt Live-Berechnung**: `src/ranking/leaderboardSync.ts` wird nach jeder
  lokal gespeicherten Session (Solo-Training *und* Boss-Modus, `WorkoutScreen`/
  `BossFightScreen`) aufgerufen - best-effort und *nicht* abgewartet
  (`syncLeaderboardProgress(...).catch(() => {})`), damit ein Netzwerkproblem nie das
  Beenden eines Workouts verzögert. Ein No-op, wenn Firebase nicht eingerichtet oder
  der Nutzer nicht angemeldet ist - die Ranglisten sind wie der Rest des
  Ranking-Systems **opt-in per Google-Anmeldung**, rein lokales Training ohne Anmeldung
  taucht dort nicht auf.
- **Wochen-Reset ohne Cron-Job**: `weeklyReps` gilt für die Woche, die in
  `weeklyBucketKey` steht. Landet ein Sync in einer *neuen* Woche, wird `weeklyReps`
  bei diesem Schreibzugriff "faul" auf nur die neuen Reps zurückgesetzt statt addiert
  (`syncTrainingProgress` in `playerProfileStore.ts`, per Firestore-Transaktion für
  Konsistenz bei z. B. zwei Geräten desselben Nutzers). Für die Wochen-Bestenliste
  selbst reicht das aber nicht: ein Spieler, der diese Woche noch gar nicht trainiert
  hat, hätte in seinem Dokument noch den (veralteten) Stand der Vorwoche stehen -
  deshalb filtert die Wochen-Abfrage zusätzlich auf
  `weeklyBucketKey == aktuelle Woche` (composite Index in `firestore.indexes.json`,
  Collection `players`, Felder `weeklyBucketKey` ASC + `weeklyReps` DESC).
- **Liga-Abfrage ohne gespeichertes Tier-Feld**: die Liga wird nicht separat
  gespeichert, sondern direkt über die LP-Spanne der Stufe gefiltert
  (`where('lp', '>=', tier.minLp)`, ggf. `where('lp', '<=', tier.maxLp)`,
  `orderBy('lp', 'desc')`) - dieselbe Art Query wie schon beim
  Ranked-Matchmaking-Suchradius, kein zusätzlicher Index nötig (Bereichsfilter +
  Sortierung auf demselben Feld).
- **Bekannte Grenze**: jede Bestenliste (außer "Freunde", die naturgemäß klein bleibt)
  zeigt nur die Top 50 (`LEADERBOARD_LIMIT` in `leaderboardStore.ts`); steht man selbst
  nicht darunter, gibt es aktuell keine Anzeige der eigenen Platzierung ("du bist Rang
  137") - das würde eine laufend gepflegte Rang-Zählung brauchen (typischerweise eine
  Cloud Function), die hier bewusst nicht gebaut wurde. Für später vorgemerkt.

#### Rangliste-Sync-Queue (Offline-Absicherung, bereits implementiert)

`syncLeaderboardProgress` (leaderboardSync.ts) ist fire-and-forget - ohne Absicherung
würde eine Session, die ohne Internet endet (z. B. Boss-Kampf im Flugmodus), ihre Reps
einfach nie in der Online-Rangliste sehen, ohne dass der Nutzer etwas davon merkt.
Stattdessen:

- Schlägt der Firestore-Schreibzugriff fehl, landet `{ reps, points, finishedAtIso }`
  in `src/ranking/leaderboardSyncQueue.ts` (AsyncStorage) statt verloren zu gehen.
  `finishedAtIso` ist bewusst der Zeitpunkt der *ursprünglichen* Session, nicht des
  (späteren) Nachhol-Versuchs - sonst würde eine Sonntagabend-Session, die erst
  Dienstag nachgeholt wird, fälschlich in der falschen Woche gezählt.
- Nachgeholt wird automatisch bei jedem folgenden erfolgreichen Sync, außerdem explizit
  bei jedem Fokussieren von Home-Screen *und* Rangliste-Screen
  (`flushPendingLeaderboardSync`) - das sind ohnehin die Momente, in denen der Nutzer
  vermutlich gerade online ist. Bricht ein Nachhol-Durchlauf bei einem Eintrag ab
  (vermutlich generelles Netzwerkproblem), wird der Rest für später aufgehoben statt
  jeden einzelnen Eintrag erneut erfolglos zu versuchen.
- Ein kleiner Hinweistext auf dem Rangliste-Screen ("X Sessions warten noch auf
  Synchronisierung") macht sichtbar, dass noch etwas aussteht, statt es unsichtbar im
  Hintergrund zu lassen.

#### Freundesliste (bereits implementiert)

- **`src/ranking/friendsStore.ts`**: bewusst *einseitig* ("Folgen" statt
  "Anfreunden mit Bestätigung") - ich trage jemanden per 6-stelligem Freundescode
  (`players/{uid}.friendCode`, generiert mit demselben Generator wie
  Freundschaftsspiel-Einladungscodes, `duelCode.ts`) in meine eigene
  `players/{myUid}/friends`-Subcollection ein. Kein Cloud Function nötig (jeder schreibt
  nur seine eigene Subcollection, siehe `firestore.rules`), aber auch keine
  Zustimmung/Benachrichtigung der anderen Seite - eine bewusste Vereinfachung, passend
  zum Rest dieses Ranking-Systems (auch Duelle laufen ohne Anfrage-Schritt).
- **Ein/Aus-Schalter** (`src/ranking/friendsFeatureFlag.ts`, AsyncStorage, Standard: an):
  oben auf dem Rangliste-Screen, jederzeit umschaltbar - falls sich die Freundesliste im
  Alltag doch als unnötig herausstellt, lässt sie sich ohne App-Update ausblenden, ohne
  den Code oder die schon gesammelten Freunde zu verlieren.

### Architekturentscheidungen (mit Begründung)

- **Backend: Firebase.** `@react-native-firebase/app` + `auth` + `firestore` sind
  bereits installiert. Firebase Auth übernimmt dabei direkt euren bestehenden
  Google-Login (`auth().signInWithCredential(GoogleAuthProvider.credential(idToken))`)
  — kein zweiter Login-Flow nötig.
- **Firestore** für dauerhafte/abfragbare Daten: Spielerprofile (LP, Rang,
  Siege/Niederlagen), Matchmaking-Warteschlange, abgeschlossene Duelle (Historie).
- **Firebase Realtime Database (RTDB)** wird für den *laufenden* Duell-Zustand
  empfohlen (beide Live-Zähler + Startzeitpunkt) statt Firestore — RTDB hat mit
  `.info/serverTimeOffset` eine eingebaute, wartungsfreie Server-Zeit-Differenz, genau
  das, was für den synchronisierten Start gebraucht wird (Firestore hat das nicht,
  man müsste es sich selbst bauen). `src/ranking/clockSync.ts` ist bewusst
  Backend-unabhängig geschrieben (nimmt nur eine „Serverzeit" als Zahl entgegen) und
  funktioniert mit beidem — die Empfehlung ist aber, für die Live-Zähler-Synchronisierung
  auf RTDB zu setzen, sobald die Duell-Screens gebaut werden.
- **Kein Cloud-Function-Zwang fürs MVP.** Matchmaking (zwei Spieler mit ähnlichem LP
  zusammenbringen) ist eigentlich ein Server-Koordinationsproblem — die *gängige
  Praxis* dafür ist eine Cloud Function, die die Warteschlange periodisch paart (race-
  conditionsicher). Für den Start reicht aber ein rein client-seitiger Ansatz:
  ein Spieler schreibt einen Warteschlangen-Eintrag (LP + Zeitstempel), ein anderer
  Spieler sucht per Firestore-Query nach einem Eintrag mit ähnlichem LP (Suchradius
  wächst mit Wartezeit) und "claimt" ihn per Firestore-Transaktion (verhindert, dass
  zwei Spieler denselben Eintrag gleichzeitig beanspruchen). Bleibt komplett im
  kostenlosen Firebase-Spark-Tarif. **Empfehlung für später** (mehr gleichzeitige
  Spieler): auf eine Cloud Function umziehen, sobald es eng wird — Blaze-Tarif
  (Pay-as-you-go), aber die kostenlose Kontingent-Grenze ist bei geringem Volumen
  i. d. R. ausreichend.
- **Skill-based Matchmaking**: Suchradius startet eng (z. B. ±100 LP) und weitet sich
  alle paar Sekunden, damit auch abseits der Stoßzeiten irgendwann ein Gegner gefunden
  wird — Standardmuster in Ranked-Systemen (Wartezeit vs. Fairness-Trade-off).
- **Freundschaftsspiel vs. Ranked getrennt** (wie gewünscht): Freundschaftsspiele
  laufen über einen Einladungslink/-code (kein Matchmaking, kein LP-Effekt, sofort mit
  einer bestimmten Person spielbar); Ranked nutzt das oben beschriebene
  Skill-Matchmaking und wirkt sich auf LP/Rang aus.

### LP-/Rangsystem (bereits implementiert)

Elo-inspiriert, siehe `src/ranking/lp.ts` (voll getestet, `npm test` deckt alle
Grenzfälle ab):

- Sieg bringt **12–35 LP**, abhängig davon, wie erwartet der Sieg war (Außenseiter-Sieg
  gegen einen deutlich stärkeren Gegner bringt mehr als ein Favoriten-Sieg gegen einen
  deutlich schwächeren).
- Niederlage kostet **40–60 % der LP, die der Gegner für diesen Sieg bekommen hat** —
  nie so viel wie der Sieg selbst gebracht hätte, damit der Aufstieg nicht unnötig zäh
  wird (genau wie gewünscht).
- Ränge (`src/ranking/ranks.ts`): **Bronze** (0–499 LP) → **Silber** (500–999) →
  **Gold** (1000–1499) → **Diamant** (1500–1999) → **Challenger** (2000+, offen nach
  oben, Rang untereinander nach LP sortiert). Der Rang ist reine Ableitung der LP — kein
  Extra-Feld, kein Aufstiegs-/Abstiegs-Sonderfall nötig, Auf- *und* Abstieg passieren
  automatisch, sobald die LP eine Stufengrenze über- bzw. unterschreiten.
- Neue Ranked-Spieler starten bei 0 LP in Bronze (keine separaten Platzierungsspiele —
  bewusst einfach gehalten fürs MVP).

### Uhrzeit-Abgleich zwischen den Handys (bereits implementiert)

`src/ranking/clockSync.ts`: klassischer NTP-Ansatz — Anfrage senden, Serverzeit
empfangen, daraus Zeit-Offset zum eigenen Gerät schätzen (mehrere Messungen möglich,
die mit der kürzesten Netzwerklaufzeit „gewinnt"). Wichtig zu verstehen: die eigentliche
Fehlerquelle sind **nicht Zeitzonen** — `Date.now()` liefert immer UTC-Millisekunden,
unabhängig von der Zeitzonen-Einstellung des Geräts —, sondern schlicht ungenau gehende
Handy-Uhren plus Netzwerklaufzeit. Sobald beide Geräte ihren Offset zur Serverzeit
kennen, berechnet jedes Gerät den exakt gleichen Startzeitpunkt in seiner *eigenen*
Lokalzeit — beide 60-Sekunden-Countdowns enden dann zur selben realen Sekunde.

### Faire Zählung / Anti-Cheat — ehrliche Grenzen

**Klarstellung**: Es wird ausschließlich der **Zählerstand** (eine Zahl) an den
Gegner übertragen, kein Kamerabild und kein Video. Jeder Spieler sieht nur sein
eigenes Kamerabild + eigenen Zähler oben links, und den **Punktestand** des Gegners
oben rechts — nicht dessen Kamera. Das ist ohnehin die einzig sinnvolle Architektur:
Video-Streaming zwischen zwei Handys in Echtzeit wäre technisch deutlich aufwändiger
(Bandbreite, Latenz, WebRTC-artige Infrastruktur) und hätte mit Firebase in dieser
Form gar nicht ins günstige/einfache Backend-Konzept gepasst. RTDB überträgt also nur
kleine Zahlen-Updates (`duels/{duelId}/players/{uid}/reps`) — leichtgewichtig und
schnell.

Die Wiederholungszählung selbst nutzt dieselbe geprüfte Zustandsmaschine wie im
Solo-Training (`src/pose/formAnalysis.ts`) — nichts Neues zu bauen, und beide Spieler
unterliegen exakt denselben Regeln. Was das **nicht** abdeckt: ein manipuliertes Gerät
(gerootet, modifizierter Client) könnte theoretisch gefälschte Zählerstände an den
Server melden — und weil (anders als in meiner ersten Zusammenfassung fälschlich
behauptet) der Gegner das Kamerabild nicht sieht, gibt es **keine visuelle
Gegenkontrolle** durch den Mitspieler. Echte, wasserdichte Prüfung würde bedeuten, die
Kamera-/Pose-Daten laufend zum Server zu streamen und dort serverseitig zu validieren
— das sprengt für diese App Bandbreite, Infrastruktur und Kosten bei Weitem und ist
nicht geplant. Realistische Abschwächungen fürs MVP (geplant, noch nicht
implementiert):

- **Plausibilitätsprüfung beim Server-Empfang**: eine Obergrenze für
  Wiederholungen/Sekunde (physiologisch unmöglich schnelle Serien verwerfen) sowie ein
  Mindestabstand zwischen zwei Zähler-Updates.
- **Melden-Button** nach dem Duell ("Gegner wirkte verdächtig") — kein technischer,
  aber ein einfacher sozialer Mechanismus, wie ihn auch andere Casual-Ranked-Systeme
  ohne harte Anti-Cheat-Prüfung nutzen; auffällige Muster (viele Meldungen gegen
  denselben Spieler) könnten später manuell oder automatisiert geprüft werden.

Kurz gesagt: Die Zählung ist genauso fair/genau wie im Solo-Modus (gleiche Logik), aber
*nicht* hieb- und stichfest gegen einen absichtlich manipulierten Client — das ist eine
bewusste, transparent kommunizierte Grenze für ein Hobby-Projekt, kein Versehen.

### Sicherheit: was die Regeln erzwingen (10.09.2026)

Durchsicht aus Angreifersicht — nicht „wie baue ich einen Server", sondern „was kann
jemand mit einem manipulierten Client, einem geklauten Duellcode oder einem zweiten
Handy anrichten, und was davon lässt sich ohne Cloud Functions abstellen". Gefunden und
behoben wurden sechs Punkte:

| | Was war offen | Was jetzt gilt |
|---|---|---|
| **H1** | Die RTDB-Regeln prüften `playerIds`, `duelSession.ts` schreibt aber `players` — der Zugriff war damit für **alle** gesperrt, Duelle konnten gar nicht funktionieren. Zusätzlich fehlte ein Fall zum Beitreten in ein fremdes Duell. | `database.rules.json` prüft `players`; Anlegen, Beitreten (nur solange < 2 Spieler) und Schreiben als eingetragener Teilnehmer sind die drei erlaubten Fälle. |
| **H2** | Das `.write`-Recht am ganzen Duell-Knoten machte die feingranularen Regeln darunter wirkungslos (`.write` vererbt sich in der RTDB nach unten und lässt sich tiefer **nicht** entziehen). Ein Teilnehmer konnte den Zählerstand seines Gegners setzen — und damit Sieg, Niederlage und LP bestimmen. | Der Schutz steht komplett in `.validate` (das gilt auf **jeder** Ebene und lässt sich von oben nicht aushebeln): `reps`, `ready`, `finished`, `finishedReps` darf nur der Spieler selbst ändern; jeder andere darf sie ausschließlich unverändert durchreichen — genau das, was die Transaktionen brauchen, und mehr nicht. `lp`, `displayName`, `tier` sind nach dem Eintragen für **alle** unveränderlich. |
| **H3** | `rankedQueue`: `allow update: if request.auth != null` — jeder eingeloggte Nutzer durfte jedes Feld jedes fremden Warteschlangen-Eintrags überschreiben, auch das `lp`, mit dem die Gegnersuche arbeitet. | Für **Fremde** ist nur noch genau der Übergang erlaubt, den `tryClaimCandidate` braucht: `status` von `waiting` auf `matched` plus `matchedDuelCode`, sonst kein Feld. Der Besitzer darf seinen eigenen Eintrag weiterhin komplett neu setzen — `joinQueue` schreibt mit `setDoc` ohne Merge, und auf einem übrig gebliebenen Eintrag (App mitten in der Suche beendet) ist das ein Update, kein Create. |
| **H4** | `players/{uid}`: `allow write: if request.auth.uid == uid` — der eigene Datensatz war völlig frei beschreibbar (LP auf 99999, Rekorde erfinden, Freundescode wechseln). | Zähler und Rekorde wachsen nur (`totalReps`, `totalPoints`, `wins`, `losses`, `bestDayReps`, `bestSessionReps`, `longestStreakDays`), und zwar in Schritten, die eine echte Trainingseinheit bzw. ein echtes Duell hergibt (≤ 5000 Liegestütze je Sync, Punkte höchstens 15 je neu dazugekommenem Liegestütz, LP höchstens ±40, Siege/Niederlagen höchstens +1). `uid` und `friendCode` sind unveränderlich, Löschen ist gesperrt (sonst ließe sich jede „wächst nur"-Regel über löschen + neu anlegen umgehen). |
| **M1** | Beim Länderspiel konnte jeder jederzeit ein `result` eintragen — also vor Eventende einen Wunschsieger veröffentlichen. | Ein Ergebnis darf frühestens nach `endsAtMs` entstehen, der Zeitraum lässt sich nach dem Anlegen nicht mehr verschieben, und `startsAtMs` muss zur Dokument-ID (dem Starttag) passen. Ein veröffentlichtes Ergebnis ist endgültig. Teilnehmer-`reps` wachsen nur und nur in realistischen Schritten. |
| **M2** | Duell- und Freundescodes kommen aus `Math.random()`. | Bewusst so belassen: Ein erratener Code bringt jemandem nur, in ein fremdes Duell zu geraten oder als Freund aufzutauchen — kein Datenzugriff, kein LP-Gewinn. Ein kryptografisch sicherer Generator wäre hier Aufwand ohne Schutzgewinn. |

Sauber war dagegen: keine Zugangsdaten im Repository (`google-services.json`, Keystore
und `*.jks` sind gitignored, der Keystore liegt außerhalb des Projekts), und die
Diagnose-Ausgaben hängen alle an `__DEV__`, landen also nicht im Release-Build.

**Was die Regeln bewusst NICHT leisten:** Dieses Projekt hat keine Cloud Functions —
es gibt also niemanden außer den Clients selbst, der schreibt. Die Regeln können damit
nicht garantieren, dass ein Wert *stimmt*; sie erzwingen nur, dass er sich ausschließlich
so verändern kann, wie die App ihn verändert. Wer sich die Mühe macht, über viele kleine
Schreibzugriffe unehrliche Werte aufzubauen, wird davon nicht aufgehalten. Der nächste
belastbare Schritt dagegen wäre **Firebase App Check** (Play Integrity): Damit lehnt
Firebase Anfragen ab, die nicht aus der echten, unveränderten App kommen. Das ist reine
Konsolen-Einrichtung plus ein Abhängigkeits-Paket und braucht keinen Server — aber es
gehört in einen eigenen Schritt, weil es ohne korrekte Einrichtung **alle** Anfragen
blockiert.

**Prüfen lassen sich die Regeln hier nicht.** Dafür bräuchte es die Firebase-Emulator-Suite
(`@firebase/rules-unit-testing`), also einen laufenden Emulator. `npx jest src/security`
prüft stattdessen, dass die bewusst gesetzten Einschränkungen im Regelwerk **stehen** —
das fängt ein versehentliches Zurückfallen ab, ersetzt aber keine echte Auswertung. Nach
dem Deployen einmal im **Rules Playground** der Firebase-Konsole gegenprüfen
(Firestore → Regeln → „Regelsimulator"), mindestens diese vier Fälle:

1. `players/fremde-uid` als anderer Nutzer schreiben → muss **verweigert** werden.
2. `players/eigene-uid` mit `totalReps` kleiner als bisher → muss **verweigert** werden.
3. `rankedQueue/fremde-uid` mit `{status: 'matched', matchedDuelCode: 'ABC123'}` auf
   einem Eintrag mit `status: 'waiting'` → muss **erlaubt** werden (sonst funktioniert
   das Ranked-Matchmaking nicht mehr).
4. `nationsEvents/<Starttag>` mit `result` **vor** `endsAtMs` → muss **verweigert** werden.

### Firebase-Projekt einrichten

> **Ausführliche Anleitung mit allen Klicks, Befehlen und Stolperstellen:**
> [`docs/firebase-einrichten.md`](docs/firebase-einrichten.md). Der Abschnitt hier ist die
> Kurzfassung. Prüfen lässt sich der Stand jederzeit mit `npm run firebase:check` — das
> Skript liest `google-services.json` und `app.json` und nennt bei jedem Problem den
> konkreten nächsten Schritt.


1. https://console.firebase.google.com/ → neues Projekt anlegen.
2. **Android-App registrieren** (Paketname wie in `app.json` → `android.package`) →
   `google-services.json` herunterladen → ins **Projekt-Wurzelverzeichnis** legen
   (nicht nach `android/` — das wird bei jedem Prebuild neu erzeugt und automatisch
   dorthin kopiert, siehe `plugins/withFirebaseConfig.js`). Die Datei ist bereits in
   `.gitignore` eingetragen, wird also nie versehentlich committet.
3. **(nur falls du auch für iOS baust)** iOS-App registrieren (Bundle-ID wie
   `ios.bundleIdentifier`) → `GoogleService-Info.plist` herunterladen → ebenfalls ins
   Projekt-Wurzelverzeichnis (auch bereits gitignored).
4. **Firestore aktivieren** (Build → Firestore Database → Datenbank erstellen,
   Produktionsmodus) und Regeln + Indexe deployen — entweder per Firebase-CLI
   (`firebase deploy --only firestore:rules,firestore:indexes`, braucht einmalig
   `firebase init`) oder `firestore.rules` im Firebase-Console-Regel-Editor einfügen
   und die beiden Composite-Indexe aus `firestore.indexes.json` manuell im
   Firestore-Tab „Indexe" anlegen: Collection `rankedQueue` (Felder `status` ASC,
   `lp` ASC, `queuedAtMs` ASC - nötig für die Ranked-Matchmaking-Suche) und Collection
   `players` (Felder `weeklyBucketKey` ASC, `weeklyReps` DESC - nötig für die
   Wochen-Rangliste, siehe „Rangliste").
5. **Realtime Database aktivieren** (Build → Realtime Database → Datenbank erstellen)
   und `database.rules.json` genauso deployen/einfügen.
6. Danach `npm run prebuild` (bzw. `npm run android`) erneut ausführen — ab jetzt sind
   `expo.extra.firebaseConfigured` automatisch `true` und alle Firebase-Aufrufe im Code
   sicher nutzbar (vorher zeigt die App an entsprechender Stelle nur einen
   „Noch nicht eingerichtet"-Hinweis, stürzt aber nirgends ab).

## Boss-Modus (Offline-Solo, bereits implementiert)

Dritter Modus neben Ranked/Freundschaftsspiel, aber bewusst komplett **offline** - kein
Firebase, kein Google-Login nötig, funktioniert also für jeden sofort. Home-Screen →
„Boss-Modus".

- **`src/bossmode/bossDefinitions.ts`** (rein, getestet): Boss 1-4 haben exakt die
  vorgegebenen 100/120/150/180 HP. Ab Boss 5 wächst die zum Sieg nötige Anzahl
  Wiederholungen abwechselnd um 2 bzw. 3 (im Schnitt „2-3 mehr" wie gewünscht) -
  `bossMaxHp(n)` übersetzt das zurück in HP. Jeder Liegestütz zieht pauschal
  **15 HP** ab (`REP_DAMAGE_HP`), unabhängig vom Form-Score - eine bewusste
  Vereinfachung, damit die Kampf-Mechanik leicht verständlich bleibt.
- **`src/bossmode/bossProgressStorage.ts`**: aktueller Boss + seine verbleibenden HP
  werden nach jeder Wiederholung lokal gespeichert (`AsyncStorage`, wie die
  Trainingshistorie) - schafft man einen Boss nicht in einer Sitzung, geht es beim
  nächsten Mal exakt mit den übrigen HP weiter, wie gewünscht.
- **`BossFightScreen`**: dieselbe geprüfte Kamera-/Zähllogik wie im normalen Training
  (`PushUpAnalyzer`) - der Boss-Modus ist nur eine andere Verpackung desselben
  Trainings, die Wiederholungen zählen also ganz normal fürs Trainingsverlauf,
  Punkte/Level und Auszeichnungen mit (identischer Abschluss-Ablauf wie
  `WorkoutScreen`, landet ebenfalls im `SummaryScreen`).
- **Boss besiegt** → kurzes Banner, danach automatisch weiter zum nächsten (stärkeren)
  Boss bei voller Lebensanzeige - kein Bruch im Trainingsfluss.

### Personen-Freistellung - versucht, auf echtem Gerät gescheitert, wieder vereinfacht

Es gab einen Versuch, den Nutzer per echter Personen-Segmentierung vor dem Boss
freizustellen (Skia-Frame-Processor + ein separates TFLite-„Selfie Segmenter"-Modell,
siehe Git-Historie für die Details). Auf einem echten Android-Gerät zeigte sich das
aber als Sackgasse:

- `useSkiaFrameProcessor`s interne `<Canvas>`-Komponente ist unter React Natives neuer
  Architektur (die dieses Projekt durchgehend nutzt) offiziell **nicht unterstützt**
  (Warnung direkt aus `@shopify/react-native-skia`).
- Das TFLite-Modell scheiterte beim Laden mit
  `TFLite: Failed to allocate memory for input/output tensors! Status: unresolved-ops` -
  es nutzt Ops, die der Standard-Interpreter von `react-native-fast-tflite` nicht ohne
  Weiteres auflösen konnte.
- `getNativeBuffer()` (von VisionCamera für den Skia-Frame-Processor benötigt) verlangt
  Android-`HardwareBuffer`, verfügbar erst ab API 26 - der Prebuild-Default lag bei 24
  (siehe „minSdkVersion" unten, das ist inzwischen unabhängig davon korrigiert).

Drei kaputte, voneinander unabhängige native Bausteine gleichzeitig, für ein Feature,
bei dem der Nutzer selbst vorschlug, es einfach durch eine halbtransparente Kamera über
dem Boss zu ersetzen - **also genau das getan**. `src/bossmode/useBossFightCamera.ts`
ist komplett weg; `BossFightScreen.tsx` nutzt jetzt exakt denselben
`usePoseDetection()`/`<MediapipeCamera>`-Aufbau wie `WorkoutScreen.tsx`, nur mit einer
`opacity: 0.55` auf der Kamera-Ansicht, damit das (aktuell noch als eingefärbtes
Platzhalter-Icon gezeichnete) Boss-Artwork dahinter durchscheint - kein Segmentierungs-
Modell, kein Skia-Compositing, kein Nitro-Boxing mehr nötig.

Damit sind `react-native-fast-tflite`, `react-native-nitro-modules` und
`vision-camera-resize-plugin` komplett aus dem Projekt entfernt (nicht mehr in
`package.json`, taucht auch nicht mehr in der nativen Autolinking-Modulliste auf) -
drei weniger potenziell instabile native Module im Gradle-Build.
`@shopify/react-native-skia` bleibt zwar noch als transitive Abhängigkeit von
`react-native-vision-camera` selbst installiert (dessen eigene, optionale
Skia-Frame-Processor-Unterstützung), wird aber von diesem Projekt an keiner Stelle mehr
aktiv aufgerufen.

**Boss-Grafiken**: aktuell weiterhin ein einfaches, eingefärbtes Platzhalter-Icon
(Totenkopf) - die eigentliche Gestaltung kommt wie besprochen in einem eigenen Schritt.

## Länderspiel (bereits implementiert)

Ein zeitlich begrenztes Event: Jeder Spieler wählt ein Land, und alle Liegestütze, die er
im Eventzeitraum macht, zählen für dieses Land. Am Ende gewinnt das Land mit den meisten
Liegestützen; das Ergebnis wird mit Datum, Sieger, Liegestützen, Spielerzahl und Schnitt
je Spieler veröffentlicht.

Erreichbar über die Kachel **„Länderspiel"** auf dem Startbildschirm.

### Zeitraum einstellen

Alles Zeitliche steckt in `DEFAULT_NATIONS_SCHEDULE` (`src/nations/nationsEvent.ts`).
Aktuell: **jede Woche Freitag 00:00 bis Sonntag 24:00**, drei volle Tage.

```ts
export const DEFAULT_NATIONS_SCHEDULE: NationsEventSchedule = {
  utcOffsetMinutes: 120,        // Zeitzone des Events (Deutschland: 60 Winter / 120 Sommer)
  startHour: 0,                 // Startstunde in dieser Zone
  durationDays: 3,              // volle Tage
  repeat: { mode: 'weekly', startWeekday: 5 },   // 5 = Freitag
};
```

Für **„alle drei Tage für drei Tage"** wird nur `repeat` ausgetauscht — sonst nichts:

```ts
  repeat: { mode: 'everyNDays', anchorDate: '2026-09-11', periodDays: 3 },
```

`anchorDate` ist der erste Starttag; ab dann läuft der Rhythmus durch. Ist `periodDays`
größer als `durationDays`, entsteht eine Pause zwischen den Events; sind beide gleich,
läuft es lückenlos. Beide Modi sind mit Tests abgedeckt
(`src/nations/__tests__/nationsEvent.test.ts`).

**Zeitzone:** Das Fenster gilt für alle Spieler im selben Augenblick, unabhängig davon, wo
ihr Handy steht — sonst hätte jemand mit einer anderen Zeitzone länger Zeit. `utcOffsetMinutes`
wird **nicht** automatisch auf Sommerzeit umgestellt: Zweimal im Jahr beginnt und endet das
Event dadurch eine Stunde verschoben, bis der Wert angepasst wird. Bewusst so gelassen,
statt eine Zeitzonen-Bibliothek einzubauen — Hermes (die JS-Engine der App) liefert `Intl`
mit Zeitzonendaten nicht zuverlässig mit, und ein Drei-Tage-Event verträgt eine Stunde
Versatz.

### Anmeldung vor dem Start

Man kann sich anmelden, **sobald das vorherige Event vorbei ist** — also deutlich früher
als einen Tag vor dem Start. Wer am Montag in die App schaut, muss nicht bis Donnerstag
warten, um sein Land zu wählen. Der Bildschirm zeigt dann „Startet in 3 Tage 5 Std." und
darunter „Anmeldung läuft".

Soll die Anmeldung enger sein, gibt es dafür eine Einstellung:

```ts
registrationOpensDaysBefore: 1,   // Anmeldung öffnet genau einen Tag vor dem Start
```

Ohne diesen Wert ist sie durchgehend offen (Standard). Mit gesetztem Wert zeigt der
Bildschirm vorher nur den Termin und „Anmeldung öffnet in …".

Welche Phase gerade gilt, entscheidet `activeNationsEvent` — bewusst in der getesteten
Logik und nicht im Bildschirm, denn davon hängt ab, welchem Event Liegestütze
gutgeschrieben werden.

### Länderwahl

Die Auswahl ist eine durchsuchbare Vollbild-Liste mit Flagge, Name und Ländercode. Gesucht
wird ohne Rücksicht auf Groß-/Kleinschreibung, Umlaute und Akzente: „osterreich" findet
Österreich, „cote" findet Côte d'Ivoire. Treffer sind nach Nähe sortiert, nicht
alphabetisch — bei „de" steht Deutschland oben und nicht Bangladesch.

Die Flaggen sind **keine Bilddateien**, sondern werden aus dem Ländercode gerechnet
(`flagEmoji` in `src/nations/countries.ts`): Unicode kodiert Flaggen als Buchstabenpaar,
`D` + `E` ergibt 🇩🇪. Deshalb liegen im Projekt keine 200 Bilder herum, die Liste
funktioniert offline, und die APK wird davon kein Byte größer. Stellt ein Gerät Flaggen
nicht dar, erscheinen die beiden Buchstaben — deshalb steht der Ländername im UI immer
daneben und nie nur die Flagge.

**Die Wahl ist unumkehrbar** bis zum Ende des Events. Darauf wird zweimal hingewiesen
(vor dem Öffnen der Liste und im Bestätigungsdialog), und sie ist nicht nur in der App
gesperrt, sondern in `firestore.rules` erzwungen:

```
allow update: if ... && request.resource.data.countryCode == resource.data.countryCode;
```

Auch ein zweites Gerät oder eine ältere App-Version kann die Wahl damit nicht umbiegen.
Ein neues Event bedeutet eine neue, wieder freie Wahl.

### Datenmodell und Auswertung

```
nationsEvents/{eventId}                      Eckdaten + (nach Ende) das Ergebnis
nationsEvents/{eventId}/participants/{uid}   Land und Liegestütze EINES Spielers
```

Pro Spieler ein eigenes Dokument statt eines Zählers pro Land: So schreibt jeder Client
ausschließlich sein eigenes Dokument — dieselbe Regel, die schon für `players/{uid}` gilt.
Ein gemeinsamer Länder-Zähler müsste für alle schreibbar sein und wäre von jedem beliebig
manipulierbar. Die Länder-Tabelle entsteht stattdessen beim Lesen (`computeStandings`),
ganz ohne Cloud Function.

**Wer sich anmeldet, aber nichts macht, zählt nicht.** Gezählt werden nur Spieler mit
mindestens einer Wiederholung — für den Schnitt, für die Spielerzahl des Siegers und für
die Gesamtzahl im veröffentlichten Ergebnis. Ein Land, aus dem sich nur jemand angemeldet
hat, steht weiterhin in der Tabelle, aber mit dem Vermerk „X angemeldet, noch nichts
beigetragen" statt einer irreführenden „0 Spieler · ⌀ 0"-Zeile.

**Schnitt je Spieler:** Gezählt werden nur Spieler mit mindestens einer Wiederholung.
Sonst würde jede Anmeldung ohne Training den Schnitt eines Landes drücken, und ein Land
mit vielen Karteileichen stünde schlechter da als eines mit wenigen Aktiven — obwohl beide
gleich viel geleistet haben. Wer sich nur angemeldet hat, steht in `registeredPlayers`.
Gleichstand bei den Liegestützen entscheidet der höhere Schnitt.

**Veröffentlichung ohne Server:** Es gibt keine Cloud Function, die zum Eventende einen
Cron-Job ausführt. Stattdessen schreibt der erste Client, der nach dem Ende hinschaut, das
Ergebnis fest (`loadOrFinalizeResult`) — dasselbe „faule" Muster, das `syncTrainingProgress`
schon für den Wochenwechsel der Rangliste benutzt. Einmal festgeschrieben ändert es sich
nicht mehr, auch wenn später noch ein verspäteter Offline-Sync eintrudelt.

### Offline

Wie beim Rest der App darf fehlendes Internet nichts kaputtmachen:

- Die Länderwahl liegt zusätzlich lokal (`nationsChoiceStore.ts`), ist also auch ohne Netz
  sichtbar.
- Gutschriften, die nicht durchkommen, landen in `nationsSyncQueue.ts` und werden beim
  nächsten Öffnen des Startbildschirms nachgeholt.
- Maßgeblich ist der Zeitpunkt der **Session**, nicht der des Hochladens. Wer Sonntagabend
  ohne Internet trainiert und erst Dienstag online geht, bekommt die Liegestütze trotzdem
  dem Sonntags-Event gutgeschrieben. Das Event-Fenster wird in der Warteschlange
  mitgespeichert statt später neu berechnet — sonst würde eine zwischenzeitliche Änderung
  am Zeitplan die alte Session plötzlich einem anderen Event zuordnen.

### Ohne eingerichtetes Ranking-System

Die **Länderwahl funktioniert auch dann**, wenn Firebase noch nicht eingerichtet oder der
Nutzer nicht angemeldet ist: Sie wird lokal gespeichert (`nationsChoiceStore.ts`), und
`refresh` trägt sie nach, sobald beides vorhanden ist — ohne dass jemand sie erneut treffen
müsste. Der Bildschirm sagt das auch: „Deine Länderwahl ist trotzdem schon gespeichert und
wird automatisch übernommen."

Was ohne Firebase **nicht** geht, ist das Zusammenzählen über mehrere Spieler — also
Zwischenstand und veröffentlichte Ergebnisse. Dafür steht statt der Tabelle ein Hinweis.

### Voraussetzung für die Wertung

Zwischenstand und Ergebnisse brauchen Firebase und die Google-Anmeldung (wie Rangliste und
Duelle), siehe „Ranking-System einrichten". Nach dem Einrichten müssen die Regeln neu
deployt werden:

```bash
firebase deploy --only firestore:rules
```

## Missionen & Münzen (bereits implementiert)

Komplett offline (kein Backend nötig): tägliche und wöchentliche Missionen mit
Münzen-Belohnung, dazu eine optionale tägliche Erinnerung, die auf die noch offenen
Missionen hinweist statt nur einen generischen Text zu zeigen. Alles auf dem
Home-Screen, Karte „Missionen".

- **`src/gamification/missions.ts`** (rein, getestet): feste Liste von 6 Missionen
  (`MISSION_DEFINITIONS`), je mit Zeitraum (täglich/wöchentlich), Ziel-Kennzahl,
  Zielwert und Münz-Belohnung:
  - *Täglich*: „Tagesziel" (30 Liegestütze, egal in welchem Modus, 20 Münzen), „Perfekte
    Form" (10 makellose Liegestütze **im Boss-Modus**, 30 Münzen — bewusst als Anreiz,
    den Offline-Modus für sauberes Techniktraining zu nutzen), „Täglich dabei" (App
    einmal öffnen, 10 Münzen).
  - *Wöchentlich* (Montag-basierte Woche): „Wochenziel" (250 Liegestütze — bewusst mehr
    als 7×30=210, damit es eine echte Zusatzleistung ist, nicht nur das Tagesziel
    hochgerechnet, 100 Münzen), „Geselligkeit" (3 Freundschaftsspiele abschließen, 60
    Münzen), „Ranglisten-Grind" (3 Ranglistenspiele abschließen, 60 Münzen).
  - `computeMissions()` berechnet Fortschritt/Abschluss aus den lokalen
    `WorkoutSession`s (für Liegestütz-Missionen) und einem neuen lokalen Duell-Protokoll
    (für die beiden Duell-Missionen, s.u.) - reine Funktion, keine Seiteneffekte.
- **`src/duel/duelLog.ts`**: Duell-Ergebnisse selbst leben in Firebase Realtime Database
  (`duelSession.ts`) und werden sonst nirgends lokal gespeichert - für die beiden
  Wochenmissionen reicht ein einfaches, lokales Protokoll „wann wurde ein Duell
  abgeschlossen, war es Ranked?", das `DuelResultScreen` bei jedem abgeschlossenen Duell
  (Sieg/Niederlage/Unentschieden zählen alle) einmalig einträgt.
- **`src/gamification/currencyStore.ts`**: Münz-Guthaben in `AsyncStorage`, plus ein
  Beleg-Ledger (`claimReward`/`claimCompletedMissions`), das sich jede
  Zeitraum+Missions-Kombination merkt, die schon ausgezahlt wurde - dadurch ist das
  Einlösen **idempotent** und kann gefahrlos von mehreren Stellen aus aufgerufen werden
  (Home-Screen bei jedem Fokussieren, `WorkoutScreen`/`BossFightScreen` direkt nach dem
  Speichern einer Session), ohne doppelt auszuzahlen.
- **Sofort-Feedback**: `WorkoutScreen`/`BossFightScreen` lösen direkt nach dem Speichern
  einer Session alle inzwischen abgeschlossenen Missionen ein und reichen
  `coinsEarned`/`newlyCompletedMissions` an den `SummaryScreen` weiter, der das genau wie
  neu freigeschaltete Abzeichen als eigene Karte feiert ("+30 Münzen verdient!").
  Duell-basierte Wochenmissionen werden dagegen erst beim nächsten Aufruf des
  Home-Screens sichtbar eingelöst (kein Extra-Popup direkt im `DuelResultScreen`, um den
  Umfang dort nicht unnötig zu vergrößern).
- **Tägliche Erinnerung**: `src/notifications/dailyReminder.ts` kann jetzt einen
  beliebigen Text statt eines festen Standardtexts verwenden. Der Home-Screen baut
  diesen Text (`buildDailyReminderBody()`) aus der noch offenen Tages-Mission und
  plant die Erinnerung bei jedem Fokussieren neu (`refreshDailyReminderContent()`),
  solange sie aktiv ist. **Ehrliche Einschränkung**: eine lokale, wiederkehrende
  Push-Benachrichtigung kann ihren Text nicht im Moment des Auslösens neu berechnen -
  der Text ist also nur so aktuell wie der letzte App-Aufruf, nicht exakt der
  Fortschritt um 18 Uhr selbst. Für echte Live-Aktualität bräuchte es einen
  Background-Task (z.B. `expo-task-manager` + Background Fetch), der hier bewusst noch
  nicht eingebaut wurde (siehe Ideen unten).

### Streak: Schonfrist für den laufenden Tag (10.09.2026)

Die Trainings-Streak braucht keinen täglichen Job — `computeStats()` läuft bei jedem
Öffnen über die lokalen Sessions und zählt vom heutigen Tag rückwärts, solange ein Tag
entweder ein Training oder einen eingesetzten Freeze hat. Sie ist damit immer aktuell,
ganz ohne Hintergrundaufgabe.

Eine Sache stimmte dabei aber nicht: Ohne Training am heutigen Tag brach die Zählung
sofort ab. Nach zehn Trainingstagen in Folge stand um 00:01 Uhr „0 Tage Streak" auf dem
Startbildschirm — bevor überhaupt jemand die Gelegenheit zum Trainieren hatte. Der
laufende Tag ist keine Lücke, er ist nur noch nicht vorbei. `computeStats()` beginnt
deshalb bei *gestern*, wenn heute noch nichts eingetragen ist.

`streakFreezeStore.ts` setzte genau das schon voraus (es friert „heute" nie ein, mit
Verweis auf `computeStats`) — bis zu dieser Änderung widersprachen sich die beiden
Module. Abgedeckt von vier Tests in `src/storage/__tests__/workoutStorage.test.ts`
(„computeStats Streak: Schonfrist für den laufenden Tag").

### Login-Streak-Bonus (bereits implementiert)

„Täglich dabei" zahlt nicht mehr jeden Tag denselben festen Betrag - `src/gamification/
loginStreak.ts` führt einen eigenen, von der Trainings-Streak (`computeStats().
currentStreakDays`, die einen echten Satz Liegestütze braucht) getrennten
Login-Streak: einfach die App an aufeinanderfolgenden Kalendertagen öffnen reicht.
`coinsForLoginStreak()` zahlt an den ersten 5 Tagen steigend 10/15/20/25/30 Münzen,
danach gedeckelt bei 30 - schnell spürbar, ohne dass ein sehr langer Streak einzelne
Tage absurd wertvoll macht. Der Home-Screen übergibt den tatsächlichen Betrag als
`rewardOverride` an `claimCompletedMissions` (siehe currencyStore.ts), da die Mission
selbst weiterhin einen statischen `rewardCoins`-Wert als Fallback trägt.

## Münz-Shop (bereits implementiert)

Ausgabe-Seite zur Münz-Ökonomie oben - endlich ein Grund, die gesammelten Münzen auch
auszugeben. Neuer Menüpunkt „Münz-Shop" (`ShopScreen.tsx`) mit drei Kategorien:

- **Streak-Rettung** (60 Münzen, `src/gamification/streakFreezeStore.ts`): schützt die
  Trainings-Streak automatisch vor dem nächsten verpassten Tag - genau wie in bekannten
  Streak-Systemen wird ein gehaltener Freeze beim ersten echten Rückschlag automatisch
  und endgültig verbraucht, man muss ihn nicht manuell auf einen bestimmten Tag
  anwenden. Rein lokal (kein Firestore, keine Anmeldung nötig) - `computeStats()` bekommt
  dafür einen neuen optionalen `frozenDayKeys`-Parameter, der einen Tag ohne Training
  trotzdem als "Streak lief weiter" zählt (nur für die *aktuelle* Streak, nicht für den
  historischen `longestStreakDays`-Rekord). Der Home-Screen versucht das bei jedem
  Fokussieren automatisch (`reconcileStreakFreezes`) und zeigt bei einer frisch
  eingesetzten Rettung eine kurze Banner-Meldung.
- **Avatare** (100 Münzen je Icon, 7 Stück aus dem bestehenden Platzhalter-Set): einmal
  gekauft, sofort ausgerüstet (`players/{uid}.avatar`) und damit überall sichtbar, wo
  `RankFrame` auftaucht (Rangliste, Profil, Duelle). Ein bewusst *gewähltes* Icon gilt
  jetzt als echte Personalisierung und wird auch angezeigt (`RankFrame.tsx`s
  `AvatarContent`) - nur der eine kostenlose Start-Avatar (Flamme) zeigt weiterhin die
  aktuelle Rang-Punktzahl (LP) statt eines Icons, wie ursprünglich gewünscht.
- **Rahmen-Themes** (250 Münzen, 5 Farbvarianten, `src/ranking/frameThemes.ts`): färben
  nur den Rang-Rahmen um (`RankFrame`s `gradientColors`), Ringdicke/Glow/Pulsieren
  bleiben von der Rang-Stufe bestimmt - der Rahmen kommuniziert also weiterhin ehrlich
  den erreichten Rang, das Theme ist reine Personalisierung obendrauf. Gespeichert als
  `players/{uid}.frameThemeId`, damit auch andere es in Rangliste/Duellen sehen.

**Preis-Philosophie**: als Maßstab dient, wie viele Münzen ein einigermaßen aktiver
Tag/eine Woche realistisch einbringt (siehe „Missionen & Münzen" oben - grob 60-80
Münzen an einem vollen Tag, ~220 zusätzlich pro Woche). Die Streak-Rettung ist bewusst
am günstigsten - genau nach der eigenen Idee aus der Konzeptphase, sie ungefähr 3-4
Tage Login-Bonus kosten zu lassen: die ersten 4 Tage Login-Bonus ergeben 10+15+20+25=70
Münzen, 60 ist die runde Zahl knapp darunter. Avatare sind reine, günstige
Sammel-Kosmetik (~1-2 Tage). Rahmen-Themes sind sichtbarer (überall wo `RankFrame`
auftaucht) und daher spürbar teurer (~3-5 Tage) - ein glaubwürdiges "Flex"-Item, ohne
eine ganze Woche Grind zu verlangen.

**Bekannte Grenze**: welche Avatare/Rahmen-Themes man schon besitzt, wird rein lokal
gespeichert (`src/gamification/inventoryStore.ts`) - eine Neuinstallation verliert den
Kaufverlauf der Kosmetik (nicht aber die Münzen selbst oder das aktuell ausgerüstete
Icon/Theme, die in Firestore liegen). Für ein Hobby-Projekt akzeptabel; ein sauberer Fix
wäre, den Besitz zusätzlich in Firestore zu spiegeln.

## Profil-Screen & Level 1-50 (bereits implementiert)

Neuer Menüpunkt „Mein Profil" (`ProfileScreen.tsx`) - zeigt Gesamt-Liegestütze, Reps
diese Woche, Level+XP-Balken, Bestleistungen/Abzeichen-Anzahl (nur fürs eigene Profil,
da das reine Lokaldaten sind) sowie - falls angemeldet - Rang/LP, Sieg/Niederlage-Bilanz
und den eigenen Freundescode. Ein Tap auf eine andere Person in der Rangliste öffnet
dasselbe Profil schreibgeschützt für sie, aus den in Firestore ohnehin schon
synchronisierten Feldern (`totalReps`, `weeklyReps`, `totalPoints`, `lp`, `wins`,
`losses`, `avatar`, `frameThemeId`) - dafür synct `syncTrainingProgress`
(playerProfileStore.ts) jetzt zusätzlich `totalPoints`, nicht nur `totalReps`.

### Bestleistungen und Durchschnittswerte (10.09.2026)

Das Profil zeigt zwei zusätzliche Karten. Alle Werte kommen aus `computeStats`
(`src/storage/workoutStorage.ts`) und sind dort mit Tests abgedeckt.

**Bestleistungen**

| Wert | Bedeutung |
|---|---|
| Meiste an einem Tag | Alle Sessions eines **Kalendertages** zusammengezählt, mit Datum |
| Beste Session | Meiste Liegestütze in einem einzelnen Training |
| Längste Streak | Längste je erreichte Serie aufeinanderfolgender Trainingstage |
| Bester Form-Score | Bester Schnitt einer einzelnen Session |

**Auf einen Blick**

| Wert | Bedeutung |
|---|---|
| Trainingstage | Kalendertage, an denen überhaupt trainiert wurde |
| Schnitt je Trainingstag | Liegestütze / Trainingstage — **Ruhetage zählen nicht als Null mit** |
| Form-Score im Schnitt | Über *alle* Wiederholungen, nicht der Schnitt der Session-Schnitte |
| Trainings gesamt | Anzahl Sessions |

Drei Entscheidungen dahinter, die leicht anders ausfallen könnten:

- **Tag ≠ Session.** Wer dreimal am Tag zehn Liegestütze macht, hat 30 an dem Tag
  geschafft — seine beste *Session* bleibt 10. Für „wie viel schaffe ich am Tag" ist die
  Tagessumme die Zahl, die zählt, deshalb stehen beide Werte nebeneinander.
- **Lokaler Kalendertag, nicht UTC.** Ein Training um 23:30 in Berlin ist für den Nutzer
  noch „heute", in UTC aber schon morgen — sonst würde es auf den Folgetag rutschen und
  die Tagesbestleistung zerreißen. Dieselbe Regel wie bei der Streak (`localDayKey`).
- **Form-Score nach Wiederholungen gewichtet.** Eine Session mit 2 Wiederholungen darf
  nicht so schwer wiegen wie eine mit 40. Der Schnitt der Session-Schnitte wäre in einem
  Beispiel aus den Tests 75, richtig gewichtet sind es 98.

Bei Gleichstand behält die Tagesbestleistung den **früheren** Tag — sonst springt das
angezeigte Datum bei jedem gleich guten Tag auf ein neues.

**Auch auf fremden Profilen.** `syncTrainingProgress` synchronisiert `bestDayReps`,
`bestSessionReps` und `longestStreakDays` in `players/{uid}` mit, sodass ein Tap auf jemanden
in der Rangliste dessen Rekorde zeigt. Zusammengeführt wird als **Höchstwert**, nie nach
unten: Wer die App neu installiert und damit seine lokale Historie verliert, soll nicht auch
noch seine Online-Rekorde auf die frische, niedrige Historie zurückgesetzt bekommen. Profile,
die seit dieser Änderung noch nicht trainiert haben, haben die Felder noch nicht — dann bleibt
die Karte weg, statt überall Nullen anzuzeigen.

Auf dem Startbildschirm steht „Bester Tag" jetzt ebenfalls in der Bestleistungen-Karte,
damit beide Ansichten dasselbe zeigen.

**Level-Kurve** (`src/gamification/points.ts`, ersetzt die frühere flache "alle 250
Punkte ein Level"-Kurve): Level 1-50, gedeckelt. Level N zu erreichen kostet
`100 + (N-2)*25` Punkte mehr als Level N-1 (Level 2 kostet 100, Level 3 kostet 125, ...,
Level 50 kostet 1300) - frühe Level gehen schnell, Level 50 ist ein echtes,
mehrmonatiges Fernziel (bei einem durchgehaltenen Tagesziel von 30 Liegestützen/Tag ca.
3-4 Monate). Die alte Kurve hätte Level 50 schon nach ~1000 Liegestützen erreicht - zu
schnell für einen Wert, der sich wie ein echter Deckel anfühlen soll. Dieselbe Kurve
speist weiterhin den Level-Balken auf dem Home-Screen, es gibt also nur ein einziges,
konsistentes Level pro Nutzer statt zweier widersprüchlicher Zahlen.

## Play-Store-Veröffentlichung

Ziel ist ein signiertes `.aab` (Android App Bundle — der Play Store verlangt zwingend
dieses Format, nicht die `.apk`, die du bisher zum Testen genutzt hast). Das lässt sich
nicht vollständig automatisieren, weil dabei ein privater Schlüssel entsteht, den nur du
besitzen darfst — ich kann und darf ihn nicht für dich erzeugen oder aufbewahren.

1. **Paketname/Bundle-ID final festlegen**: `com.pushupcoach.app` (`app.json` →
   `android.package`/`ios.bundleIdentifier`) ist aktuell nur ein Platzhalter. Einmal im
   Play Store veröffentlicht, lässt sich der Android-Paketname **nicht mehr ändern** —
   vorher final entscheiden.
2. **Release-Keystore erzeugen** (einmalig, **im Projekt-Wurzelverzeichnis**; Verlust
   bedeutet, dass die App nie wieder aktualisiert werden kann):
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias pushup-coach \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   `release.keystore` **niemals committen** (liegt bereits in `.gitignore` via
   `*.jks`/`*.keystore`) — zusätzlich an einem zweiten, sicheren Ort aufbewahren
   (Passwort-Manager, externes Backup).
3. **Signing-Daten hinterlegen**: `keystore.properties.example` (liegt im
   Projekt-Wurzelverzeichnis, ist Teil des Repos) zu `keystore.properties` kopieren und
   die echten Passwörter/den Alias eintragen:
   ```bash
   cp keystore.properties.example keystore.properties
   ```
   `keystore.properties` ist bereits in `.gitignore` — wird also **nie** committet. Mehr
   musst du hier nicht tun: `plugins/withReleaseSigning.js` trägt bei jedem
   `npm run prebuild`/`npm run android` automatisch einen `signingConfigs.release`-Block
   in das (sonst bei jedem Prebuild neu generierte, daher nicht von Hand editierbare)
   `android/app/build.gradle` ein, der diese Datei ausliest. Ohne `keystore.properties`
   fällt der Release-Build automatisch auf den Debug-Schlüssel zurück (baut weiterhin,
   ist dann aber nicht Play-Store-signiert) — nichts bricht, wenn du diesen Schritt
   vorerst überspringst.
4. **SHA-1 des Release-Keystores ermitteln** (`keytool -list -v -keystore
   release.keystore -alias pushup-coach`) und wie oben beschrieben einen zweiten
   Android-OAuth-Client dafür in der Google Cloud Console anlegen, sonst funktioniert
   „Mit Google anmelden" im signierten Release-Build nicht.
5. **Bundle bauen**: `npm run prebuild && cd android && ./gradlew bundleRelease` →
   Ergebnis unter `android/app/build/outputs/bundle/release/app-release.aab`.
6. **Play Console**: Datenschutzerklärung (URL, siehe unten), Data-Safety-Formular,
   Inhaltsbewertung und Store-Eintrag (Titel/Beschreibung/Kategorie) — alle Texte fertig
   in [`docs/play-store-listing.md`](docs/play-store-listing.md), interner Test →
   geschlossener Test → Produktion.

### Datenschutzerklärung & Nutzungsbedingungen (Privacy Policy / ToS)

Pflicht für jede Play-Store-App, sobald Berechtigungen wie Kamera oder eine
Google-Anmeldung genutzt werden. Beide Texte liegen bereits fertig im Repo —
`docs/index.html` (Datenschutzerklärung) und `docs/terms.html` (Nutzungsbedingungen),
beides eigenständige statische HTML-Seiten, kein Build-Schritt nötig.

**So bekommst du die öffentlichen URLs für die Play Console** (Pflichtfeld):

1. In **beiden** Dateien die Platzhalter-Kontaktadresse `KONTAKT-E-MAIL@ersetzen.de`
   durch eine echte, erreichbare E-Mail-Adresse ersetzen (die Play Console verlangt eine
   Kontaktmöglichkeit für Datenschutzanfragen). Ich habe hier bewusst einen Platzhalter
   gelassen statt eine E-Mail-Adresse zu raten oder automatisch einzusetzen.
2. Im GitHub-Repo: **Settings → Pages → Build and deployment → Source: „Deploy from a
   branch"**, Branch auf diesen Branch (bzw. später `main`) und Ordner `/docs` stellen,
   speichern.
3. Die URLs stehen danach fest (GitHub leitet sie deterministisch aus Konto-/Repo-Namen
   ab) und sind bereits überall dort eingetragen, wo sie gebraucht werden
   (`docs/play-store-listing.md`, Google-OAuth-Zustimmungsbildschirm-Werte oben):
   - Datenschutzerklärung: `https://crispybaconfries.github.io/Test-App-push-ups1/`
   - Nutzungsbedingungen: `https://crispybaconfries.github.io/Test-App-push-ups1/terms.html`

### Data-Safety-Formular & Inhaltsbewertung (Play Console)

Fertig als Frage/Antwort-Tabellen in
[`docs/play-store-listing.md`](docs/play-store-listing.md) — genau in der Reihenfolge,
in der die Play Console sie abfragt: welche Datentypen erfasst werden (Kamera nur
on-device/sofort verworfen, Kontodaten nur lokal verschlüsselt, nichts an Dritte
geteilt), sowie die komplette IARC-Inhaltsbewertung (Gewalt/Sexualität/Glücksspiel/etc.
— bei dieser App überall „Nein").

## Projektstruktur

```
src/
  pose/
    blazePoseLandmarks.ts   33-Punkt-Indizes (BlazePose-Standard, kein Native-Import)
    landmarks.ts             Winkel-/Sichtbarkeits-Hilfsfunktionen
    formAnalysis.ts           Zustandsmaschine + Form-Scoring (PushUpAnalyzer)
    stats.ts                  robuste Statistik (Perzentil / n-kleinster Wert) fuer die Formwerte
    feedbackText.ts            deutsche Texte für Form-Hinweise
    testing/poseBuilder.ts     synthetischer Pose-Generator für Tests
  components/
    SkeletonOverlay.tsx        SVG-Strichmännchen über der Kamera
    RepHud.tsx                  Rep-Zähler, Score, Live-Hinweis
    ProgressBar.tsx, LevelProgressBar.tsx   animierte Fortschrittsbalken
  audio/repSounds.ts            zwei Bestätigungstöne (expo-audio), siehe oben
  notifications/dailyReminder.ts  optionale tägliche Erinnerung (expo-notifications)
  auth/
    types.ts                 lokales Profil-Datenmodell (id/name/email/photoUrl)
    mapGoogleUser.ts           reine Mapping-Funktion Google-User → lokales Profil (testbar)
    profileStorage.ts           verschlüsselte Ablage/Lesen/Löschen (expo-secure-store)
    googleSignInConfig.ts       einmaliges GoogleSignin.configure() (webClientId aus app.json)
    AuthContext.tsx              React-Context: signIn/signOut/Status, für HomeScreen
  ranking/
    lp.ts                      LP-Vergabe (Elo-inspiriert, 12-35 Gewinn / 40-60% Verlust)
    ranks.ts                     Bronze/Silber/Gold/Diamant/Challenger, reine Ableitung der LP
    rankFrameStyle.ts             Rahmen-Optik je Rang (Dicke/Farbverlauf/Glow/Pulsieren), testbar
    clockSync.ts                  NTP-artiger Uhrzeit-Abgleich für den synchronisierten Duell-Start
    avatar.ts                     Avatar-Datenmodell (Icon-Auswahl oder eigenes Foto)
    playerProfile.ts               Firestore-Dokumenttyp players/{uid} + Default-Erstellung
    playerProfileStore.ts           Firestore-Lesen/Schreiben inkl. LP-Anwendung nach einem Duell + Rangliste-Sync
    matchmaking.ts                  Suchradius-Logik fürs Ranked-Matchmaking, testbar
    matchmakingQueue.ts               Firestore-Warteschlange: beitreten/suchen/claimen
    useDuelIdentity.ts                gemeinsamer Hook: Firebase/Anmeldung/Spielerprofil-Voraussetzung
    leaderboardSync.ts                schreibt Session-Reps/-Punkte best-effort in players/{uid} (Gesamt/Woche)
    leaderboardSyncQueue.ts            AsyncStorage-Warteschlange für fehlgeschlagene Syncs (Offline-Absicherung)
    leaderboardStore.ts                Firestore-Abfragen für die vier Rangliste-Tabs (Gesamt/Woche/Liga/Freunde)
    friendsStore.ts                    Freundescode-Suche + einseitiges Hinzufügen (players/{uid}/friends)
    friendsFeatureFlag.ts               Ein/Aus-Schalter für den Freunde-Tab (AsyncStorage)
    frameThemes.ts                       Käufliche Rahmen-Farbthemes (reine Konfiguration)
  duel/
    duelCode.ts                   6-stelliger Einladungscode fürs Freundschaftsspiel, testbar
    duelSession.ts                  Realtime-Database-Logik: erstellen/beitreten/bereit/Live-Zähler
    duelLog.ts                       lokales Protokoll abgeschlossener Duelle (fürs Wochenmissionen-Tracking)
  firebase/
    firebaseConfig.ts              isFirebaseConfigured() - liest expo.extra.firebaseConfigured
    firebaseAuthBridge.ts           Google-Anmeldung → Firebase Auth (für Security Rules nötig)
  bossmode/
    bossDefinitions.ts              Boss-HP-Formel (Boss 1-4 fest, danach +2/+3 Reps je Boss), testbar
    bossProgressStorage.ts            aktueller Boss + Rest-HP (AsyncStorage, überlebt App-Neustarts)
  components/RankFrame.tsx        Avatar + Rang-Rahmen, überall im Ranking-System verwendet
  screens/
    HomeScreen.tsx      Menü + Level/Challenges/Bestleistungen-Übersicht
    WorkoutScreen.tsx    Kamera + Skelett-Overlay + Zähl-/Bewertungslogik (Kernscreen)
    CameraScreen.tsx     einfacher Kamera-Test ohne Auswertung (expo-camera)
    AchievementsScreen.tsx  Abzeichen-Liste (freigeschaltet/gesperrt + Fortschritt)
    SummaryScreen.tsx, HistoryScreen.tsx
    DuelLobbyScreen.tsx      Freundschaftsspiel: Duell erstellen (Code zeigen) oder beitreten
    RankedMatchmakingScreen.tsx  Ranked: Gegner suchen (Skill-based Matchmaking)
    DuelScreen.tsx             Kamera-Duell: eigener Zähler + Gegner-Punktestand, synced Countdown/Timer
    DuelResultScreen.tsx        Ergebnis-Vergleich, LP-Änderung bei Ranked-Duellen
    BossFightScreen.tsx           Offline-Solo: Kamera + Boss-Lebensbalken, kein Backend nötig
    LeaderboardScreen.tsx           Rangliste: Gesamt/Diese Woche/Meine Liga/Freunde als Unter-Tabs
    ShopScreen.tsx                    Münz-Shop: Streak-Rettung, Avatare, Rahmen-Themes
    ProfileScreen.tsx                  Eigenes oder fremdes Profil: Level/XP, Reps gesamt/Woche, Freundescode
  nations/                      Länderspiel (Event-Zeitfenster, Länderliste, Auswertung)
    nationsEvent.ts             Zeitfenster + Tabelle + Ergebnis - reines TS, voll getestet
    countries.ts                Länder + aus dem Code gerechnete Flaggen + Suche
    nationsStore.ts             Firestore: Beitritt, Gutschrift, Tabelle, Ergebnisse
    nationsSync.ts              Gutschrift nach einer Session (+ Warteschlange offline)
    nationsChoiceStore.ts       lokal gemerkte Länderwahl
  storage/workoutStorage.ts    lokale Session-Historie (AsyncStorage) + Statistiken + Streak (mit Freeze-Support)
  gamification/
    points.ts       Punkte-/Level-Berechnung (Level 1-50, gedeckelt), testbar
    badges.ts         Abzeichen-Definitionen + Freischalt-Logik (reine Funktionen, testbar)
    missions.ts        Missions-Definitionen + Tages-/Wochen-Fortschritt (reine Funktionen, testbar)
    currencyStore.ts    Münz-Guthaben + Beleg-Ledger fürs einmalige Einlösen jeder Mission (AsyncStorage)
    loginStreak.ts        Login-Streak (getrennt von der Trainings-Streak) + dynamischer Münz-Bonus, testbar
    streakFreezeStore.ts    Streak-Rettung: gehaltene Freezes + welche Tage schon eingefroren wurden (AsyncStorage)
    shop.ts                 Shop-Katalog (Preise/Kategorien), reine Konfiguration
    inventoryStore.ts         Besitz gekaufter Kosmetik (AsyncStorage) + Kauf-/Ausrüsten-Orchestrierung
  navigation/RootNavigator.tsx
plugins/
  withPoseLandmarkerModel.js   Config-Plugin: bündelt das .task-Modell nativ
  withUncompressedModelAssets.js  Config-Plugin: noCompress "task", sonst kann MediaPipe das Modell nicht laden
  withAndroidAbiFilter.js         Config-Plugin: baut nur arm64-v8a (kuerzere Bauzeit, kleinere APK)
  withCmakeSuppressRegeneration.js Config-Plugin: schaltet CMakes RERUN_CMAKE-Regel ab (Release-Build von VisionCamera)
  withReleaseSigning.js          Config-Plugin: trägt Release-Signing aus keystore.properties in build.gradle ein
  withFirebaseConfig.js            Config-Plugin: bindet Firebase nur ein, wenn google-services.json/GoogleService-Info.plist existieren
keystore.properties.example       Vorlage für keystore.properties (echte Datei bleibt ungetrackt)
firestore.rules, firestore.indexes.json, database.rules.json  Security-Rules + Composite-Index fürs Ranking-System, deploybereit
docs/
  index.html                     Datenschutzerklärung, fertig zum Hosten via GitHub Pages
  terms.html                       Nutzungsbedingungen, selbes Hosting
  play-store-listing.md            Store-Eintrag/Data-Safety/Inhaltsbewertung/OAuth-Felder, fertig zum Copy-Paste
scripts/
  download-pose-model.js        lädt das MediaPipe-Modell herunter
  generate-rep-sounds.js          erzeugt assets/sounds/*.wav (synthetische Töne)
```

## Roadmap (spielerische Weiterentwicklung)

Die App ist bewusst so gebaut, dass jede Wiederholung als `RepResult` (Form-Score +
konkrete Fehler) vorliegt und in `WorkoutSession`s gebündelt lokal gespeichert wird — das
ist die Grundlage für alles Folgende:

1. **Punkte & Level** ✅ umgesetzt (`src/gamification/points.ts`): Form-Score bestimmt
   Punkte pro Wiederholung, mit Bonus für perfekte Ausführung.
2. **Missionen & Münzen** ✅ umgesetzt (`src/gamification/missions.ts`,
   `currencyStore.ts`): tägliche/wöchentliche Missionen mit Münzen-Belohnung, dazu eine
   optionale tägliche Erinnerung um 18 Uhr (lokale Push-Benachrichtigung,
   `expo-notifications`, nur nach expliziter Erlaubnis) — siehe „Missionen & Münzen" für
   alle Details.
3. **Badges/Auszeichnungen** ✅ umgesetzt (`src/gamification/badges.ts`,
   `AchievementsScreen.tsx`): 6 Meilensteine (10/100/500 Liegestütze, 3-/7-Tage-Streak,
   perfekte Session) — ein neu freigeschaltetes Abzeichen wird direkt nach dem Workout
   auf dem Zusammenfassungs-Screen gefeiert.
4. **Online-Ranking-Modus** ✅ umgesetzt (Freundschaftsspiel *und* Ranked): ein
   60-Sekunden-Kopf-an-Kopf-Duell — wer schafft in der Zeit mehr (saubere) Liegestütze,
   jeder sieht sein eigenes Kamerabild + Zähler oben links, **nur den Punktestand** (kein
   Kamerabild) des Gegners oben rechts. Per Einladungscode gegen einen Freund
   (`DuelLobbyScreen`) oder per Skill-based Matchmaking gegen einen ähnlich starken
   Gegner (`RankedMatchmakingScreen`) — beide münden in denselben `DuelScreen` →
   `DuelResultScreen` (inkl. LP-Änderung bei Ranked), Spieler-Avatare mit Rang-Rahmen
   inklusive — siehe „Ranking-System einrichten" für alle Details.
5. **Leaderboards** ✅ umgesetzt (`LeaderboardScreen.tsx`, `src/ranking/leaderboardStore.ts`/
   `leaderboardSync.ts`): baut auf Punkt 4 auf (dieselbe Backend-Anbindung) - vier Tabs
   (Gesamt-Liegestütze, diese Woche, eigene Liga, Freunde per Code), mit Offline-Sync-
   Warteschlange und Profil-Ansicht per Tap - siehe „Rangliste" für alle Details.
6. **Boss-Modus** ✅ umgesetzt (`src/bossmode/`, `BossFightScreen.tsx`): Offline-Solo
   gegen immer stärkere Bosse - Boss 1-4 mit 100/120/150/180 HP, danach steigt die
   nötige Wiederholungszahl abwechselnd um 2/3 pro Boss; ein Liegestütz zieht 15 HP ab.
   Nicht besiegte Bosse merken sich ihre Rest-HP lokal fürs nächste Mal. Zählt normal
   fürs Trainingsverlauf/Punkte/Auszeichnungen mit; die Kamera läuft halbtransparent
   über dem Boss-Artwork (eine versuchte echte Personen-Freistellung per TFLite/Skia
   scheiterte auf einem echten Gerät an drei getrennten nativen Problemen und wurde
   wieder verworfen) — siehe „Boss-Modus" für Details.
7. **Münz-Shop & Profil** ✅ umgesetzt (`ShopScreen.tsx`, `ProfileScreen.tsx`): Streak-
   Rettung/Avatare/Rahmen-Themes gegen Münzen, dazu ein Profil-Screen mit Level 1-50
   (eigene, gedeckelte XP-Kurve) und Gesamt-/Wochen-Liegestützen, für sich selbst und
   - schreibgeschützt - für andere Spieler aus der Rangliste - siehe „Münz-Shop" und
   „Profil-Screen & Level 1-50".

Punkte 1–3 und 6 sind reine On-Device-Features ohne Backend; Punkte 4–5 und 7 (mit
Ausnahme der rein lokalen Streak-Rettung) brauchen eins (siehe „Ranking-System
einrichten").
