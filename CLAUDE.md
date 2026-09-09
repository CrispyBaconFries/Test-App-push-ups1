@AGENTS.md

# Entwicklungsmaschine von chris (Windows, StudioProjects\Test-App-push-ups1)

- **JDK 17 (für `JAVA_HOME` bei jedem nativen Rebuild) ist bereits installiert unter:**
  `C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot`
  Vor jedem `expo prebuild --clean` + `npm run android` in derselben PowerShell-Sitzung setzen:
  ```powershell
  $env:JAVA_HOME = "C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
  ```
  Falls der Build mit "JAVA_HOME is set to an invalid directory" fehlschlägt, ist entweder dieser
  Pfad durch ein JDK-Update veraltet, oder `$env:JAVA_HOME` wurde in der aktuellen Sitzung nicht
  (erneut) gesetzt — NICHT sofort ein neues JDK vorschlagen/installieren lassen, sondern zuerst mit
  `Get-ChildItem "C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium"` prüfen, ob sich nur die
  Versionsnummer geändert hat.
- Warum JDK 17 nötig ist (nicht die von Android Studio mitgelieferte JBR, aktuell JDK 25): siehe
  `plugins/withGradleJavaHome.js` — AGP/Prefab bricht auf JDK 22+ mit einer harmlosen
  "WARNING: A restricted method..."-Zeile den Build ab.

# Feste Anweisung: Befehle immer vollständig ausgeben

Wenn chris etwas selbst ausführen muss, gehören die **kompletten** Befehle in die Antwort —
kein „einfach neu laden", keine ausgelassenen Zwischenschritte, keine Platzhalter.

- **Nie Platzhalter wie `<DEIN-PFAD>`.** Das wurde schon einmal wörtlich eingefügt; die spitzen
  Klammern sind in `cmd.exe` Umleitungszeichen und erzeugten einen „Syntaxfehler". Immer den
  echten Wert einsetzen (JDK-Pfad und Branch-Name stehen in dieser Datei).
- **Ein Befehl pro Codeblock.** Mehrere Befehle in einer Zeile sind schon einmal
  zusammengerutscht und wurden dadurch beide nicht ausgeführt.
- **`$env:JAVA_HOME` gehört in jeden Block mit Gradle-Beteiligung**, weil es nur für die
  jeweilige PowerShell-Sitzung gilt.
- Dazusagen, **was danach zu erwarten ist** (welche Log-Zeile, welche Ausgabe) — sonst lässt
  sich nicht unterscheiden, ob ein Schritt gewirkt hat.
- Ändert ein Commit nichts am App-Verhalten (z. B. nur Dokumentation), das **ausdrücklich sagen**,
  statt einen unnötigen Rebuild anzustoßen.

# Feste Anweisung: eine App, ein Befehl

chris hat **nur eine Installation** auf dem Handy, und das ist die Vorzeige-App
(Release). Sie soll immer dem aktuellen Codestand entsprechen. Die Entwickler-App
(Debug + Metro) wird **nicht** benutzt — sie war nur nötig, um `console.log`-Ausgaben
live zu sehen, und das ist mein Werkzeugproblem, nicht seins.

**Nach jeder Änderung genau diese vier Blöcke ausgeben, sonst nichts:**

```powershell
cd C:\Users\chris\StudioProjects\Test-App-push-ups1
```

```powershell
git pull origin claude/pushup-form-analysis-app-npj2a0
```

```powershell
$env:JAVA_HOME = "C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
```

```powershell
npm run android:release
```

Ändert ein Commit nichts am App-Verhalten (z. B. nur Dokumentation), das **ausdrücklich
sagen**, statt einen unnötigen Rebuild anzustoßen.

Bei nativen Änderungen (Patches in `patches/`, Config-Plugins, `app.json`, native
Abhängigkeiten) kommen davor `npm install` und `npx expo prebuild --clean` dazu. Hat sich
eine Datei in `patches/` geändert, gehört das Entfernen des betroffenen Pakets mit in den
Block — sonst hält npm es für „up to date", installiert es nicht neu, und patch-package
scheitert daran, den neuen Patch auf die noch alt-gepatchten Dateien anzuwenden:

```powershell
Remove-Item -Recurse -Force node_modules\react-native-mediapipe
```

Ebenso gehört nach einer Patch-Änderung `npm run clean:native` dazu, weil der
CMake-Zustand in `node_modules/<paket>/android/.cxx/` sonst veraltet weiterlebt (siehe
README, „build.ninja still dirty").

# Feste Anweisung: keine Diagnose über console.log planen

Im Release-Build ist `__DEV__` false — alle `if (__DEV__) console.log(...)`-Zeilen laufen
dort nicht. Und chris hat kein Metro, kein Kabel und kein Logcat offen. Eine Anleitung wie
„schau ins Log" ist damit wertlos und kostet ihn eine Runde.

Alles, was ich zur Diagnose brauche, gehört stattdessen an einen dieser beiden Orte:

- **In den Kalibrier-Log** (`src/pose/calibrationLogger.ts`) — der Knopf „🧪
  Kalibrierungsdaten teilen (DEV)" auf dem HomeScreen ist bewusst *nicht* `__DEV__`-
  abhängig und funktioniert deshalb auch in der Vorzeige-App. Auswertung am PC mit
  `npm run analyze:reps`.
- **Sichtbar in die App selbst**, wenn chris es während des Trainings braucht.

Nur wenn ich ausdrücklich Live-Logs brauche, darf ich die Debug-Variante vorschlagen — und
dann mit dem Hinweis, dass sie die Vorzeige-App ersetzt (gleiche `applicationId`,
`com.pushupcoach.app`) und mit `npm run android:release` wieder zurückgeholt wird. Ein
`applicationIdSuffix` für den Debug-Build wäre die Alternative, hat aber Folgen für die
spätere Firebase-/Google-Sign-In-Einrichtung, die auf den Paketnamen ausgestellt ist —
chris hat das bewusst abgelehnt.
