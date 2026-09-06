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
