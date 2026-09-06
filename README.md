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
   OAuth-Zustimmungsbildschirm): externen Nutzertyp wählen, App-Namen/Support-E-Mail
   ausfüllen. Für eigene Tests reicht der „Testing"-Modus mit deiner E-Mail als
   Testnutzer — für die Play-Store-Veröffentlichung muss er später auf „In Produktion"
   gestellt und von Google verifiziert werden.
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
6. **Play Console**: Datenschutzerklärung (URL, siehe unten), Data-Safety-Formular
   (siehe unten), Store-Eintrag (Screenshots/Beschreibung), interner Test →
   geschlossener Test → Produktion.

### Datenschutzerklärung (Privacy Policy)

Pflicht für jede Play-Store-App, sobald Berechtigungen wie Kamera oder eine
Google-Anmeldung genutzt werden. Der fertige Text liegt bereits im Repo unter
`docs/index.html` (eigenständige, statische HTML-Seite, kein Build-Schritt nötig) —
zusammengefasst:

- **Kamerabilder**: werden ausschließlich lokal auf dem Gerät verarbeitet
  (MediaPipe-Posenerkennung on-device), verlassen das Gerät nie, werden nicht
  gespeichert oder hochgeladen.
- **Trainingsdaten** (Wiederholungen, Datum/Uhrzeit, Form-Score, Punkte): nur lokal auf
  dem Gerät gespeichert (`AsyncStorage`) — kein Server, keine Übertragung an Dritte.
- **Google-Kontodaten** (Name, E-Mail, Profilbild) bei optionaler Anmeldung: nur lokal
  und verschlüsselt gespeichert (`expo-secure-store`), keine Übertragung an einen
  eigenen Server (existiert noch nicht) und keine Weitergabe an Dritte.
- **Benachrichtigungen**: nur lokal geplante Erinnerungen, kein Push-Server.
- Keine Werbung, kein Tracking, keine Analytics-SDKs.

**Damit du eine öffentliche URL für die Play Console bekommst** (Pflichtfeld):

1. In `docs/index.html` die Platzhalter-Kontaktadresse `KONTAKT-E-MAIL@ersetzen.de`
   durch eine echte, erreichbare E-Mail-Adresse ersetzen (die Play Console verlangt eine
   Kontaktmöglichkeit für Datenschutzanfragen). Ich habe hier bewusst einen Platzhalter
   gelassen statt eine E-Mail-Adresse zu raten oder automatisch einzusetzen.
2. Im GitHub-Repo: **Settings → Pages → Build and deployment → Source: „Deploy from a
   branch"**, Branch auf diesen Branch (bzw. später `main`) und Ordner `/docs` stellen,
   speichern.
3. GitHub zeigt dir danach die fertige URL (Form
   `https://<dein-github-name>.github.io/<repo-name>/`) — genau diese URL in der Play
   Console beim Store-Eintrag unter „Datenschutzerklärung" eintragen.

### Data-Safety-Formular (Play Console)

Passend zur obigen Liste: „Kamera" und „Name/E-Mail-Adresse/Profilbild" jeweils als
gesammelte Datenkategorie mit Zweck „App-Funktionalität" angeben, jeweils **nicht**
geteilt; bei der Kamera zusätzlich angeben, dass die Verarbeitung ausschließlich
on-device erfolgt. Keine Kategorie für Werbung/Analytics ankreuzen, solange kein
entsprechendes SDK eingebaut ist.

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
  screens/
    HomeScreen.tsx      Menü + Level/Challenges/Bestleistungen-Übersicht
    WorkoutScreen.tsx    Kamera + Skelett-Overlay + Zähl-/Bewertungslogik (Kernscreen)
    CameraScreen.tsx     einfacher Kamera-Test ohne Auswertung (expo-camera)
    AchievementsScreen.tsx  Abzeichen-Liste (freigeschaltet/gesperrt + Fortschritt)
    SummaryScreen.tsx, HistoryScreen.tsx
  storage/workoutStorage.ts    lokale Session-Historie (AsyncStorage) + Statistiken
  gamification/
    points.ts       Punkte-/Level-Berechnung
    badges.ts         Abzeichen-Definitionen + Freischalt-Logik (reine Funktionen, testbar)
    challenges.ts      Tages-/Wochenziel-Fortschritt (reine Funktionen, testbar)
  navigation/RootNavigator.tsx
plugins/
  withPoseLandmarkerModel.js   Config-Plugin: bündelt das .task-Modell nativ
  withReleaseSigning.js          Config-Plugin: trägt Release-Signing aus keystore.properties in build.gradle ein
keystore.properties.example       Vorlage für keystore.properties (echte Datei bleibt ungetrackt)
docs/index.html                     Datenschutzerklärung, fertig zum Hosten via GitHub Pages
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
4. **Online-Ranking-Modus (geplant, noch nicht begonnen)**: ein 60-Sekunden-Kopf-an-Kopf-
   Duell — wer schafft in der Zeit mehr (saubere) Liegestütze. Braucht zwingend ein
   Backend: Nutzerkonten, Matchmaking (zwei Spieler gleichzeitig finden), einen
   Realtime-Layer für den Live-Punktestand (z. B. Firebase, Supabase Realtime oder ein
   eigenes WebSocket-Backend) und serverseitig validierte Ergebnisse (ein Rep-Count, der
   nur lokal auf dem Gerät entsteht, ist sonst leicht zu manipulieren). Das ist ein
   eigenes Architektur-Thema (Anbieter, Datenmodell, Authentifizierung,
   Anti-Cheat/Validierung der Wiederholungszählung) und sollte in einem eigenen Gespräch
   geplant werden, bevor loscodiert wird.
5. **Leaderboards**: baut auf Punkt 4 auf (braucht dieselbe Backend-Anbindung mit
   serverseitig validierten Scores).

Punkte 1–3 sind reine On-Device-Features ohne Backend; Punkte 4–5 brauchen eins.
