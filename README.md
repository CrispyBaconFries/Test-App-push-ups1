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

Auf der Startseite außerdem: ein Level-Fortschrittsbalken, Tages-/Wochenziel
(„Herausforderungen", Standard 30 Liegestütze/Tag bzw. 150/Woche,
`src/gamification/challenges.ts`) mit optionaler täglicher Erinnerung (lokale
Push-Benachrichtigung um 18 Uhr, `src/notifications/dailyReminder.ts`) und eine
Bestleistungen-Übersicht (beste Session, bester Form-Score, längste Streak jemals).

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

**Variante B — eine echte, verschickbare APK-Datei:**

```bash
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
```

Die fertige Datei liegt danach unter:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Das ist eine ganz normale APK-Datei, die du z. B. per Kabel, Cloud-Speicher oder Messenger
aufs Handy bekommst. Dort antippen → **Installieren**. Falls das System das erste Mal
blockiert: **Einstellungen → Apps → [Datei-App, z. B. "Dateien"] → Unbekannte Apps
installieren** → erlauben, dann erneut versuchen. Das ist normal für Apps außerhalb des
Play Stores und für einen reinen Test-Build so gedacht (kein Play-Store-Signing nötig).

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
| Ranking-System (Freundschaftsspiel fertig, Ranked in Arbeit) | `@react-native-firebase` (app/auth/firestore/database) als Backend; LP-/Rangsystem, Uhrzeit-Abgleich, Spieler-Avatare mit Rang-Rahmen und das komplette Freundschaftsspiel-Duell (Lobby/Kamera-Duell/Ergebnis) bereits fertig — siehe „Ranking-System einrichten" |
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

## Tests & Typecheck

```bash
npm test          # Jest — Unit-Tests für Rep-Zählung, Form-Scoring, Punkte/Level, Streak
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

**Status: Freundschaftsspiel-Duell spielbar (sobald Firebase eingerichtet ist),
Ranked-Matchmaking folgt als Nächstes.** Fertig und getestet: das LP-/Rang-
Punktesystem, der Uhrzeit-Abgleich, Spieler-Avatare mit Rang-Rahmen, und jetzt auch
der komplette Duell-Ablauf über einen Einladungscode: Home-Screen → „Freundschaftsspiel"
→ Duell erstellen/beitreten (`DuelLobbyScreen`) → synchronisierter 60-Sekunden-Kampf
mit Kamera + Live-Gegner-Zähler (`DuelScreen`) → Ergebnis (`DuelResultScreen`). Noch
offen: die Skill-based-Matchmaking-Warteschlange für den „Ranked"-Modus (der eigentliche
Duell-Screen ist bereits so gebaut, dass er beides bedient, siehe `isRanked`-Parameter).

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
  bei einem Ranked-Duell (aktuell noch nicht erreichbar, siehe „Noch offen" oben) auch
  die LP-Änderung.
- **Google-Anmeldung ↔ Firebase-Anmeldung verknüpft**: `AuthContext` meldet nach dem
  Google-Login jetzt zusätzlich bei Firebase Auth an (`firebaseAuthBridge.ts`,
  `signInWithCredential` mit dem Google-ID-Token) - nötig, damit die
  Security Rules (`request.auth`) überhaupt greifen. Wichtig: die Firebase-uid ist
  *nicht* dieselbe ID wie die lokale Google-Profil-ID - für alles Ranking-Bezogene
  zählt ausschließlich die Firebase-uid.

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

### Firebase-Projekt einrichten

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
   Produktionsmodus) und die Regeln aus `firestore.rules` deployen — entweder per
   Firebase-CLI (`firebase deploy --only firestore:rules`, braucht einmalig
   `firebase init`) oder die Datei einfach im Firebase-Console-Regel-Editor einfügen.
5. **Realtime Database aktivieren** (Build → Realtime Database → Datenbank erstellen)
   und `database.rules.json` genauso deployen/einfügen.
6. Danach `npm run prebuild` (bzw. `npm run android`) erneut ausführen — ab jetzt sind
   `expo.extra.firebaseConfigured` automatisch `true` und alle Firebase-Aufrufe im Code
   sicher nutzbar (vorher zeigt die App an entsprechender Stelle nur einen
   „Noch nicht eingerichtet"-Hinweis, stürzt aber nirgends ab).

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
    playerProfileStore.ts           Firestore-Lesen/Schreiben inkl. LP-Anwendung nach einem Duell
  duel/
    duelCode.ts                   6-stelliger Einladungscode fürs Freundschaftsspiel, testbar
    duelSession.ts                  Realtime-Database-Logik: erstellen/beitreten/bereit/Live-Zähler
  firebase/
    firebaseConfig.ts              isFirebaseConfigured() - liest expo.extra.firebaseConfigured
    firebaseAuthBridge.ts           Google-Anmeldung → Firebase Auth (für Security Rules nötig)
  components/RankFrame.tsx        Avatar + Rang-Rahmen, überall im Ranking-System verwendet
  screens/
    HomeScreen.tsx      Menü + Level/Challenges/Bestleistungen-Übersicht
    WorkoutScreen.tsx    Kamera + Skelett-Overlay + Zähl-/Bewertungslogik (Kernscreen)
    CameraScreen.tsx     einfacher Kamera-Test ohne Auswertung (expo-camera)
    AchievementsScreen.tsx  Abzeichen-Liste (freigeschaltet/gesperrt + Fortschritt)
    SummaryScreen.tsx, HistoryScreen.tsx
    DuelLobbyScreen.tsx      Freundschaftsspiel: Duell erstellen (Code zeigen) oder beitreten
    DuelScreen.tsx             Kamera-Duell: eigener Zähler + Gegner-Punktestand, synced Countdown/Timer
    DuelResultScreen.tsx        Ergebnis-Vergleich, LP-Änderung bei Ranked-Duellen
  storage/workoutStorage.ts    lokale Session-Historie (AsyncStorage) + Statistiken
  gamification/
    points.ts       Punkte-/Level-Berechnung
    badges.ts         Abzeichen-Definitionen + Freischalt-Logik (reine Funktionen, testbar)
    challenges.ts      Tages-/Wochenziel-Fortschritt (reine Funktionen, testbar)
  navigation/RootNavigator.tsx
plugins/
  withPoseLandmarkerModel.js   Config-Plugin: bündelt das .task-Modell nativ
  withReleaseSigning.js          Config-Plugin: trägt Release-Signing aus keystore.properties in build.gradle ein
  withFirebaseConfig.js            Config-Plugin: bindet Firebase nur ein, wenn google-services.json/GoogleService-Info.plist existieren
keystore.properties.example       Vorlage für keystore.properties (echte Datei bleibt ungetrackt)
firestore.rules, database.rules.json  Security-Rules-Entwürfe fürs Ranking-System, deploybereit
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
2. **Tägliche/wöchentliche Challenges** ✅ umgesetzt (`src/gamification/challenges.ts`):
   Tagesziel (30 Liegestütze) und Wochenziel (150) mit Fortschrittsbalken auf dem
   Home-Screen, dazu eine optionale tägliche Erinnerung um 18 Uhr (lokale
   Push-Benachrichtigung, `expo-notifications`, nur nach expliziter Erlaubnis).
3. **Badges/Auszeichnungen** ✅ umgesetzt (`src/gamification/badges.ts`,
   `AchievementsScreen.tsx`): 6 Meilensteine (10/100/500 Liegestütze, 3-/7-Tage-Streak,
   perfekte Session) — ein neu freigeschaltetes Abzeichen wird direkt nach dem Workout
   auf dem Zusammenfassungs-Screen gefeiert.
4. **Online-Ranking-Modus** — Freundschaftsspiel ✅ umgesetzt, Ranked 🚧 in Arbeit: ein
   60-Sekunden-Kopf-an-Kopf-Duell — wer schafft in der Zeit mehr (saubere) Liegestütze,
   jeder sieht sein eigenes Kamerabild + Zähler oben links, **nur den Punktestand** (kein
   Kamerabild) des Gegners oben rechts. Per Einladungscode gegen einen Freund spielbar
   ist bereits fertig (`DuelLobbyScreen` → `DuelScreen` → `DuelResultScreen`,
   Spieler-Avatare mit Rang-Rahmen inklusive) — siehe „Ranking-System einrichten" für
   alle Details. Noch offen: die Skill-based-Matchmaking-Warteschlange für den
   „Ranked"-Modus (der Duell-Screen selbst unterstützt beide Modi bereits, nur die
   Gegner-Suche für Ranked fehlt noch).
5. **Leaderboards**: baut auf Punkt 4 auf (dieselbe Backend-Anbindung, serverseitig
   validierte Scores).

Punkte 1–3 sind reine On-Device-Features ohne Backend; Punkte 4–5 brauchen eins (siehe
„Ranking-System einrichten").
