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

# Feste Anweisung: jede Änderung gilt für BEIDE Builds

Es gibt zwei Installationen desselben Codes, und beide sollen immer auf demselben Stand sein:

| | Entwickler-App (Debug) | Vorzeige-App (Release) |
|---|---|---|
| Bauen | `npm run android` | `npm run android:release` |
| JS-Bundle | wird von Metro geladen | steckt in der APK |
| Ohne PC nutzbar | nein | ja |
| Reine JS-Änderung | Metro-Reload reicht | **voller Rebuild nötig** |

**Nach JEDER Änderung beide Befehlsblöcke ausgeben**, ohne Nachfrage, damit chris beide
Installationen aktualisieren kann. Der wichtigste Fallstrick dabei: Die Vorzeige-App hat kein
Fast Refresh — auch eine reine JS-Änderung erfordert dort `npm run android:release`. Nur den
Metro-Reload zu nennen, lässt die Vorzeige-App still auf einem alten Stand zurück.

Vorlage (JS-only-Änderung):

```powershell
git pull origin claude/pushup-form-analysis-app-npj2a0
# Entwickler-App: Metro neu starten
npx expo start --dev-client --clear
# Vorzeige-App: neu bauen und installieren
$env:JAVA_HOME = "C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
npm run android:release
```

Bei nativen Änderungen (Patches in `patches/`, Config-Plugins, `app.json`, native Abhängigkeiten)
zusätzlich `npm install` und `npx expo prebuild --clean` davor, und die Entwickler-App über
`npm run android` statt nur Metro neu bauen.

**Wenn sich eine Datei in `patches/` geändert hat**, gehört das Entfernen des betroffenen Pakets
mit in den Befehlsblock — sonst hält npm es für „up to date", installiert es nicht neu, und
patch-package scheitert daran, den neuen Patch auf die noch alt-gepatchten Dateien anzuwenden:

```powershell
Remove-Item -Recurse -Force node_modules\react-native-mediapipe
npm install
```

Ebenso gehört nach einer Patch-Änderung `npm run clean:native` dazu, weil der CMake-Zustand in
`node_modules/<paket>/android/.cxx/` sonst veraltet weiterlebt (siehe README, „build.ninja still
dirty").

**Hinweis zur Koexistenz:** Beide Builds nutzen dieselbe `applicationId`
(`com.pushupcoach.app`), können also nicht gleichzeitig auf dem Gerät liegen — die zuletzt
installierte ersetzt die andere. Soll das geändert werden, braucht der Debug-Build einen
`applicationIdSuffix` (Konvention: `.dev`); das hat Folgen für die spätere Firebase-/
Google-Sign-In-Einrichtung, die auf den Paketnamen ausgestellt ist.
