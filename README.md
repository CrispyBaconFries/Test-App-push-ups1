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

### Personen-Freistellung ("echtes" Video-Ausschneiden)

Die anfängliche Version (halbtransparentes Icon über opaker Kamera) wurde durch eine
echte Personen-Freistellung ersetzt - der Nutzer wird als Video-Ausschnitt vor dem Boss
freigestellt, statt nur ein Overlay mit reduzierter Deckkraft zu sein.

**Warum eine zweite ML-Bibliothek nötig war**: `react-native-mediapipe@0.6.0` (bereits
für die Pose-Erkennung im Einsatz) bietet zwar eine `shouldOutputSegmentationMasks`-Option,
deren Ergebnis ist aber in der installierten Version auf beiden Plattformen toter Code
(Android liefert in `ConvertHelpers.kt` immer ein leeres Array zurück, iOS hat die
Konvertierung in `PdConvertHelpers.swift` auskommentiert). Ein Patch der Bibliothek selbst
wäre blind riskant gewesen; stattdessen läuft die Segmentierung über eine zweite,
unabhängige Pipeline:

- **`react-native-fast-tflite`** (`useTensorflowModel`) lädt Googles offizielles
  „Selfie Segmenter"-TFLite-Modell (`assets/models/selfie_segmenter.tflite`,
  per `npm run model:download` geladen wie das Pose-Modell, `256×256×3` RGB rein,
  `256×256×1` Personen-Konfidenz raus) und führt es synchron (`runSync`) direkt im
  Frame Processor aus.
- **`@shopify/react-native-skia`** (`useSkiaFrameProcessor`) zeichnet pro Frame: das
  Kamerabild (auf ein zentriertes Quadrat zugeschnitten, wie es das Modell erwartet)
  in einen Layer, danach die Maske als `Alpha_8`-Bild mit `BlendMode.DstIn` darüber -
  das lässt nur die als „Person" erkannten Pixel übrig. Alles andere bleibt transparent,
  sodass der `Boss`-Platzhalter (jetzt in voller Deckkraft, `src/screens/BossFightScreen.tsx`)
  dahinter durchscheint.
- **`react-native-reanimated`** musste zusätzlich installiert werden: VisionCamera
  rendert das Skia-Frame-Processor-Ergebnis intern über eine eigene
  `SkiaCameraCanvas`-Komponente, die `useFrameCallback` aus Reanimated nutzt - ohne
  Reanimated käme also gar kein Bild auf den Schirm, obwohl Skia selbst Reanimated nur
  als optionale Peer-Dependency deklariert. Bewusst `3.19.1` (nicht 4.x) gewählt, weil
  Reanimated 4 ein eigenes `react-native-worklets`-Paket verlangt, das mit dem hier
  bereits genutzten (und unabhängigen) `react-native-worklets-core` kollidieren würde.
- **`vision-camera-resize-plugin`** verkleinert/konvertiert den quadratischen
  Kamera-Ausschnitt synchron auf die vom Modell erwartete `256×256`-Auflösung.
- **`react-native-nitro-modules`**: `react-native-fast-tflite` baut auf Nitro Modules
  auf; da VisionCamera v4 einen anderen (nicht Nitro-basierten) Worklet-Runtime nutzt,
  muss das geladene Modell explizit mit `NitroModules.box()` auf dem JS-Thread verpackt
  und im Worklet wieder mit `.unbox()` entpackt werden (offiziell so von
  `react-native-fast-tflite` dokumentiert).

Die neue Logik sitzt in **`src/bossmode/useBossFightCamera.ts`**, das zusätzlich zur
Segmentierung auch die Pose-Erkennung für die Wiederholungszählung übernimmt - eine
`<Camera>`-Komponente kann nämlich nur *einen* Frame Processor gleichzeitig haben.
Da `react-native-mediapipe`'s eigener `usePoseDetection()`-Hook nicht neben einem
zweiten Frame Processor lief, ruft dieser Hook das intern von der Bibliothek unter dem
Namen `"poseDetection"` registrierte native Plugin direkt auf (`VisionCameraProxy.
initFrameProcessorPlugin('poseDetection', {})`) und repliziert die (kleine) Menge an
Native-Modul-/Event-Emitter-Plumbing, die der Hook sonst kapselt. Das ist bewusst eine
Abhängigkeit von einem undokumentierten Implementierungsdetail statt einer öffentlichen
API - ein künftiges Upgrade von `react-native-mediapipe`, das diesen Plugin-Namen oder
die native `PoseDetection`-Modul-Form ändert, würde diese Datei brechen.

**Bekannte Einschränkung**: Das Modell sieht nur ein zentriertes Quadrat des
(im Portrait-Modus nicht quadratischen) Kamerabilds - Freistellung und Zuschnitt
passieren nur in diesem Quadrat, die Ränder (oben/unten bei Portrait) zeigen also nie
Kamerabild, sondern immer den Boss dahinter.

**Nicht verifiziert - wichtigster offener Punkt**: Diese gesamte Pipeline (Skia-Compositing,
TFLite-Inferenz, Nitro-Boxing, das Zusammenspiel zweier verschiedener Worklet-Runtimes
`react-native-worklets-core` + Reanimated, und ob VisionCamera's natives Kamera-View
tatsächlich transparent statt opak rendert) konnte in dieser Sandbox **nicht auf einem
echten Gerät getestet werden** (kein Android-SDK, kein Xcode, kein physisches Gerät
verfügbar) - nur `tsc --noEmit`, `jest` und `expo prebuild` (Struktur-/Manifest-Prüfung)
liefen erfolgreich durch. Das tatsächliche visuelle Ergebnis, Timing/Performance auf dem
Gerät und ob die Freistellung wie erwartet aussieht, müssen beim ersten echten Build
geprüft werden - das ist die riskanteste, am wenigsten abgesicherte Änderung in diesem
Projekt bisher.

**Boss-Grafiken**: aktuell ein einfaches, eingefärbtes Platzhalter-Icon (Totenkopf) -
die eigentliche Gestaltung kommt wie besprochen in einem eigenen Schritt.

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
    useBossFightCamera.ts             Kamera-Hook: Pose-Erkennung + Skia/TFLite-Personenfreistellung
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
   fürs Trainingsverlauf/Punkte/Auszeichnungen mit; echte Personen-Freistellung per
   TFLite/Skia (noch nicht auf echtem Gerät getestet) — siehe „Boss-Modus" für Details
   und die offenen Punkte.
7. **Münz-Shop & Profil** ✅ umgesetzt (`ShopScreen.tsx`, `ProfileScreen.tsx`): Streak-
   Rettung/Avatare/Rahmen-Themes gegen Münzen, dazu ein Profil-Screen mit Level 1-50
   (eigene, gedeckelte XP-Kurve) und Gesamt-/Wochen-Liegestützen, für sich selbst und
   - schreibgeschützt - für andere Spieler aus der Rangliste - siehe „Münz-Shop" und
   „Profil-Screen & Level 1-50".

Punkte 1–3 und 6 sind reine On-Device-Features ohne Backend; Punkte 4–5 und 7 (mit
Ausnahme der rein lokalen Streak-Rettung) brauchen eins (siehe „Ranking-System
einrichten").
