# Firebase einrichten — jeder Klick einzeln

Für: Rangliste, Ranglisten-Duelle, Freundschaftsspiele, Freundesliste und die Wertung im
Länderspiel. **Alles andere** (Training, Zählung, Formanalyse, Boss-Modus, Missionen,
Münz-Shop, Streak, Länderwahl) läuft ohne Firebase weiter.

25–40 Minuten. 0 €, keine Kreditkarte.

> **Google benennt Menüpunkte in der Konsole gelegentlich um.** Wo das wahrscheinlich ist,
> steht unten „falls anders benannt: …". Wenn du einen Punkt trotzdem nicht findest, sag
> mir **wörtlich**, was auf deinem Bildschirm steht — dann suche ich ihn mit dir.

---

## Die Landkarte: welche Datei wohin, und was du änderst

| Datei | Wo genau | Änderst du etwas darin? | In Git? |
|---|---|---|---|
| `google-services.json` | `C:\Users\chris\StudioProjects\Test-App-push-ups1\google-services.json` | **Nein.** Niemals von Hand anfassen. Nur ersetzen. | Nein (gitignored) |
| `app.json` | `C:\Users\chris\StudioProjects\Test-App-push-ups1\app.json` | **Ja, eine Zeile** — aber das macht `npm run firebase:fix` für dich | Ja |
| `firestore.rules`, `database.rules.json`, `firestore.indexes.json` | Projektordner | **Nein.** Liegen fertig da, werden nur hochgeladen | Ja |
| `.firebaserc` | Projektordner | **Nein.** Legt `firebase use --add` selbst an | Nein (gitignored) |

Drei Dinge, die immer wieder schiefgehen, und darum vorweg:

1. **`google-services.json` gehört NICHT nach `android\`.** Dieser Ordner wird bei jedem
   Prebuild komplett gelöscht und neu erzeugt. Die Datei gehört ins Wurzelverzeichnis,
   direkt neben `app.json`. Ein Config-Plugin kopiert sie beim Bauen an die richtige
   Stelle.
2. **Du lädst `google-services.json` insgesamt dreimal herunter** (Schritt 2, 4 und 6).
   Jedes Mal ersetzt die neue die alte. Die Dateien sehen identisch aus, sind es aber
   nicht — in jeder steckt ein Eintrag mehr.
3. **Gebaut wird erst am Ende** (Schritt 9). Zwischendurch nicht bauen, das kostet nur
   Zeit.

---

## Schritt 1 — Firebase-Projekt anlegen

**Wo:** https://console.firebase.google.com/

**Was du siehst:** Nach dem Anmelden mit deinem Google-Konto eine Seite mit Kacheln. Wenn
du noch nie ein Firebase-Projekt hattest, ist da nur eine Kachel mit einem großen Plus und
dem Text **„Firebase-Projekt erstellen"**.

**Was du tust:**

1. Auf die Plus-Kachel klicken.
2. **Projektname:** `Liegestuetz-Coach` eintippen.
   Darunter blendet Firebase eine graue Zeile ein wie `liegestuetz-coach-a1b2c`. Das ist
   die Projekt-ID, die vergibt Firebase selbst. **Nicht ändern**, sie muss weltweit
   eindeutig sein.
3. Häkchen bei den Nutzungsbedingungen setzen → **Weiter**.
4. Nächste Seite: **„Google Analytics für dieses Projekt aktivieren"** — den Schalter auf
   **Aus** stellen. Die App braucht es nicht, und es spart einen Einrichtungsschritt.
5. **Projekt erstellen** → warten (ca. 30 Sekunden) → **Weiter**.

**Fertig, wenn:** Du auf einer Seite landest, die oben links den Projektnamen zeigt und
links eine Leiste mit **Projektübersicht** ganz oben hat.

---

## Schritt 2 — Android-App registrieren und Datei ablegen

**Wo:** Auf der Seite, auf der du gerade gelandet bist (Projektübersicht). In der Mitte
steht sinngemäß **„Jetzt loslegen: Füge Firebase zu deiner App hinzu"** und darunter eine
Reihe runder Symbole: ein Apfel (iOS), ein Android-Roboter, spitze Klammern `</>` (Web),
und Unity/Flutter.

**Was du tust:**

1. Auf das **Android-Symbol** klicken (der grüne Roboter).

2. Es öffnet sich ein Formular mit vier Feldern. Nur das erste ist Pflicht:

   | Feld auf dem Bildschirm | Was du einträgst |
   |---|---|
   | **Android-Paketname** | `com.pushupcoach.app` |
   | **App-Alias (optional)** | `Liegestütz Coach` (oder leer lassen) |
   | **SHA-1-Zertifikat zur Fehlerbehebung (optional)** | **Leer lassen.** Kommt in Schritt 4. |

   ⚠️ Der Paketname muss **zeichengenau** `com.pushupcoach.app` sein. Kein Großbuchstabe,
   kein Bindestrich, kein `.android` hinten dran. Er lässt sich später nicht ändern.

3. **App registrieren** klicken.

4. Nächste Seite: **„Konfigurationsdatei herunterladen"** mit einem Knopf
   **google-services.json herunterladen**. Draufklicken. Die Datei landet in
   `C:\Users\chris\Downloads\`.

5. Die restlichen Seiten des Assistenten (**„Firebase SDK hinzufügen"**,
   **„App ausführen, um die Installation zu überprüfen"**) **überspringen**. Klick dich mit
   **Weiter** durch bis **Weiter zur Konsole**. Alles, was dort steht, ist im Repository
   schon erledigt.

**Datei an den richtigen Ort bringen.** PowerShell öffnen und diese beiden Befehle
ausführen — der zweite holt automatisch die *neueste* Datei aus dem Download-Ordner, auch
wenn Windows sie `google-services (1).json` genannt hat:

```powershell
cd C:\Users\chris\StudioProjects\Test-App-push-ups1
```

```powershell
Get-ChildItem "C:\Users\chris\Downloads\google-services*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Move-Item -Destination "C:\Users\chris\StudioProjects\Test-App-push-ups1\google-services.json" -Force
```

**Fertig, wenn** dieser Befehl `True` ausgibt:

```powershell
Test-Path C:\Users\chris\StudioProjects\Test-App-push-ups1\google-services.json
```

Und wenn das hier `com.pushupcoach.app` zeigt (dann gehört die Datei wirklich zu dieser App):

```powershell
npm run firebase:check
```

Erwartete Ausgabe an dieser Stelle: `google-services.json: gefunden, Paketname passt`,
danach zwei offene Punkte (Web-Client-Schlüssel und SHA-1). Das ist richtig so.

---

## Schritt 3 — Google-Anmeldung aktivieren

**Wo:** Linke Leiste. Sie ist in Abschnitte geteilt; der Abschnitt heißt **Erstellen**
(englisch: *Build*). Falls die Leiste zugeklappt ist: das Hamburger-Symbol oben links.

**Was du tust:**

1. Linke Leiste → **Erstellen** → **Authentication**.
2. Du landest auf einer Werbeseite mit einem Knopf **Jetzt starten** (oder **Los geht's**).
   Draufklicken.
3. Jetzt siehst du eine Kachelübersicht **„Anmeldeanbieter"** mit Google, E-Mail/Passwort,
   Facebook, Apple und so weiter. Auf die Kachel **Google** klicken.
   *Falls du stattdessen eine Reiter-Leiste siehst:* Reiter **Sign-in-Methode** (oder
   **Anmeldemethode**) → dort in der Liste **Google**.
4. Es öffnet sich ein Feld mit einem Schalter **Aktivieren** oben rechts — umlegen.
5. Darunter wird **„Support-E-Mail für das Projekt"** verlangt. Dropdown aufklappen,
   deine eigene Adresse auswählen.
6. **Speichern**.

**Fertig, wenn** in der Liste der Anbieter bei Google jetzt **Aktiviert** steht.

### ⚠️ Und jetzt die Datei neu herunterladen

Erst durch dieses Aktivieren entsteht der **Web-Client-Schlüssel**. Deine Datei aus
Schritt 2 wurde vorher erzeugt und enthält ihn **nicht**.

**Wo genau:**

1. Linke Leiste ganz oben: **Projektübersicht**. **Direkt daneben** steht ein kleines
   **Zahnrad-Symbol** ⚙️. Darauf klicken.
2. Es klappt ein kleines Menü auf → **Projekteinstellungen**.
3. Du landest auf dem Reiter **Allgemein**. Ganz nach unten scrollen bis zum Abschnitt
   **Meine Apps**.
4. Dort steht eine Kachel mit dem Android-Symbol und `com.pushupcoach.app`. Anklicken,
   falls sie nicht schon ausgewählt ist.
5. In dieser Kachel gibt es einen Knopf **google-services.json**. Draufklicken — die Datei
   wird heruntergeladen.

Dann wieder in PowerShell, derselbe Befehl wie in Schritt 2:

```powershell
Get-ChildItem "C:\Users\chris\Downloads\google-services*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Move-Item -Destination "C:\Users\chris\StudioProjects\Test-App-push-ups1\google-services.json" -Force
```

Und jetzt trägt das Skript den Schlüssel selbst in `app.json` ein:

```powershell
npm run firebase:fix
```

**Fertig, wenn** dort steht: `Web-Client-Schlüssel: in app.json eingetragen`, gefolgt von
einem langen String, der auf `.apps.googleusercontent.com` endet.

> Du musst `app.json` **nicht** von Hand öffnen. Falls du trotzdem nachsehen willst: Der
> Wert steht ganz unten unter `"extra"` bei `"googleSignInWebClientId"`. Die Zeile
> `iosUrlScheme` ein paar Zeilen darüber gilt nur fürs iPhone — **die bleibt, wie sie
> ist**, auch wenn dort noch `REPLACE_WITH...` steht.

---

## Schritt 4 — SHA-1-Fingerabdruck hinterlegen

Ohne diesen Schritt lässt Google die Anmeldung aus deiner App nicht zu. Die App startet
normal und sagt nur „Anmeldung fehlgeschlagen", ohne Grund. Das ist der Fehler, der beim
Einrichten die meiste Zeit frisst.

**Fingerabdruck auslesen.** In PowerShell:

```powershell
& "C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot\bin\keytool.exe" -list -v -keystore "C:\Users\chris\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

**Was du siehst:** Mehrere Absätze. Du suchst den Block **„Zertifikat-Fingerabdrücke:"**
(englisch *Certificate fingerprints*). Darunter stehen drei Zeilen:

```
SHA1: A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4
SHA256: ...
```

Du brauchst **nur die SHA1-Zeile**, und davon nur den Teil **nach** `SHA1: ` — also die
20 Zweiergruppen. **Die Doppelpunkte gehören dazu.** Markieren, Strg+C.

> Meldet PowerShell „Der Befehl wurde nicht gefunden" oder „Keystore-Datei existiert
> nicht": Sag mir die Meldung wörtlich. Die Datei `debug.keystore` entsteht beim ersten
> Android-Build — die hast du längst, aber sie kann woanders liegen.

**Eintragen. Wo genau:**

1. Zahnrad ⚙️ neben **Projektübersicht** → **Projekteinstellungen**.
2. Reiter **Allgemein**, ganz nach unten zu **Meine Apps**, Android-Kachel auswählen.
3. In der Kachel findest du den Abschnitt **SHA-Zertifikat-Fingerabdrücke**. Wenn noch
   keiner hinterlegt ist, steht dort ein Hinweistext und darunter ein Knopf
   **Fingerabdruck hinzufügen**.
4. Draufklicken → ein kleines Fenster mit einem einzigen Textfeld geht auf → SHA-1
   einfügen (Strg+V) → **Speichern**.

**Fertig, wenn** der Fingerabdruck als Zeile in der Tabelle steht, mit Typ `SHA-1`.

### Und wieder: Datei neu herunterladen

Dritte und letzte Mal. Derselbe Knopf **google-services.json** in derselben Kachel.

```powershell
Get-ChildItem "C:\Users\chris\Downloads\google-services*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Move-Item -Destination "C:\Users\chris\StudioProjects\Test-App-push-ups1\google-services.json" -Force
```

```powershell
npm run firebase:check
```

**Fertig, wenn** die Ausgabe so aussieht:

```
google-services.json:     gefunden, Paketname passt
Web-Client-Schlüssel:     stimmt mit app.json überein
SHA-1-Fingerabdruck:      hinterlegt

Alles in Ordnung. Nächster Schritt: Regeln deployen, dann neu bauen.
```

👉 **Hier bitte kurz Bescheid sagen.** Wenn diese drei Zeilen stehen, ist der schwierige
Teil vorbei. Wenn nicht, schick mir die Ausgabe.

---

## Schritt 5 — Firestore-Datenbank anlegen

**Wo:** Linke Leiste → **Erstellen** → **Firestore Database**.

**Was du tust:**

1. Knopf **Datenbank erstellen** (in der Mitte der Werbeseite).
2. Es öffnet sich ein Assistent mit zwei Fragen. **Die Reihenfolge der beiden Fragen
   wechselt je nach Konsolenversion** — beantworte sie so:

   | Frage | Deine Antwort |
   |---|---|
   | Standort / *location* | **`eur3 (europe-west)`** aus dem Dropdown |
   | Regeln / Modus | **Im Produktionsmodus starten** |

   Steht als Auswahl **„Testmodus"** vs. **„Produktionsmodus"**: **Produktionsmodus**.
   Der Testmodus macht die Datenbank 30 Tage lang für jeden im Internet les- und
   schreibbar und schaltet sich danach kommentarlos ganz ab. Unsere echten Regeln laden
   wir in Schritt 7 hoch.

   Gibt es keine Datenbank-Kennung („Database ID"), ist das in Ordnung — dann heißt sie
   automatisch `(default)`. Falls doch gefragt wird: `(default)` stehen lassen.

3. **Erstellen** → warten.

⚠️ **Der Standort lässt sich nachträglich nicht ändern.** Falscher Standort heißt: Projekt
löschen und von vorn.

**Fertig, wenn** du eine leere Tabellenansicht mit drei Spalten siehst und oben die Reiter
**Daten**, **Regeln**, **Indexe**, **Nutzung**.

---

## Schritt 6 — Realtime Database anlegen

Das ist eine **zweite, andere** Datenbank neben Firestore, kein Duplikat und kein Fehler.
Sie trägt nur den Live-Zählerstand während eines laufenden Duells — dafür ist sie
schneller und billiger. Alles Dauerhafte liegt in Firestore.

**Wo:** Linke Leiste → **Erstellen** → **Realtime Database**.
(Direkt unter oder über „Firestore Database". Nicht verwechseln — die Namen sind ähnlich.)

**Was du tust:**

1. **Datenbank erstellen**.
2. | Frage | Deine Antwort |
   |---|---|
   | Standort für die Realtime Database | **`Belgium (europe-west1)`** |
   | Sicherheitsregeln | **Im gesperrten Modus starten** |
3. **Aktivieren** / **Erstellen**.

**Fertig, wenn** du eine Zeile mit einer URL siehst, die auf
`.europe-west1.firebasedatabase.app` endet.

---

## Schritt 7 — Regeln und Indexe hochladen

Die Sicherheitsregeln liegen fertig im Repository. Du änderst an ihnen **nichts**, sie
werden nur hochgeladen.

Einmalig die Firebase-Kommandozeile installieren (1–2 Minuten):

```powershell
npm install -g firebase-tools
```

Anmelden — das öffnet den Browser, dort dasselbe Google-Konto wählen und die Berechtigung
bestätigen:

```powershell
firebase login
```

In den Projektordner wechseln:

```powershell
cd C:\Users\chris\StudioProjects\Test-App-push-ups1
```

Projekt zuordnen:

```powershell
firebase use --add
```

**Was hier passiert:** Es erscheint eine Liste deiner Firebase-Projekte, durch die du mit
den **Pfeiltasten** navigierst — `liegestuetz-coach-...` auswählen, **Enter**. Danach
fragt es nach einem *Alias*: Tipp `default` ein, **Enter**. Das legt die Datei
`.firebaserc` an, die musst du nicht anfassen.

Hochladen:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,database
```

**Erwartete Ausgabe:** drei Zeilen mit einem Häkchen `✔` (`firestore: released rules`,
`firestore: deployed indexes`, `database: rules for ... released`), am Ende
`Deploy complete!`.

Die zwei zusammengesetzten Indexe brauchen danach noch ein paar Minuten, bis Firebase sie
fertig gebaut hat. Nachsehen: **Firestore Database** → Reiter **Indexe**. Solange dort
**„Wird erstellt"** steht, bleibt die Rangliste in der App leer. Das erledigt sich von
selbst.

---

## Schritt 8 — App neu bauen

Das Prebuild ist hier **Pflicht**, nicht optional: `google-services.json` muss ins native
Projekt kopiert und die Firebase-Bibliotheken müssen in den Build aufgenommen werden. Ein
reines `npm run android:release` würde die Datei nicht bemerken.

```powershell
cd C:\Users\chris\StudioProjects\Test-App-push-ups1
```

```powershell
npm run firebase:check
```

```powershell
npx expo prebuild --clean
```

```powershell
$env:JAVA_HOME = "C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
```

```powershell
npm run android:release
```

**Worauf du beim Prebuild achtest:** Die Warnung
`[withFirebaseConfig] Kein google-services.json ... gefunden` darf **nicht** mehr
erscheinen. Tut sie es doch, liegt die Datei am falschen Ort → zurück zu Schritt 2.

---

## Schritt 9 — In der App prüfen

1. App öffnen → **Anmelden** → Google-Konto auswählen.
2. Ein kurzes Training machen und beenden.
3. **Rangliste** öffnen — du solltest dort mit deinem Namen und deinen Liegestützen stehen.
4. In der Konsole: **Firestore Database** → Reiter **Daten**. Dort muss jetzt links eine
   Sammlung **`players`** stehen, mit genau einem Dokument darin.

Ab da können wir zu zweit testen: Freundescode austauschen, Freundschaftsspiel,
Ranglisten-Duell, Länderspiel-Wertung.

---

## Wenn etwas nicht funktioniert

| Symptom | Ursache | Zurück zu |
|---|---|---|
| „Anmeldung fehlgeschlagen", sofort und ohne Kontoauswahl | SHA-1 fehlt oder gehört zum falschen Schlüssel | Schritt 4 |
| Kontoauswahl erscheint, danach Fehler | Web-Client-Schlüssel fehlt in `app.json` | Schritt 3 |
| App zeigt weiter „Noch nicht eingerichtet" | Prebuild fehlte, oder Datei liegt falsch | Schritt 2 + 8 |
| Rangliste bleibt leer, obwohl angemeldet | Indexe bauen noch | Schritt 7 |
| „Missing or insufficient permissions" | Regeln nicht hochgeladen | Schritt 7 |
| Duell startet nie, beide warten | Realtime-DB-Regeln nicht hochgeladen | Schritt 7, Teil `database` |
| `firebase` wird nicht als Befehl erkannt | PowerShell neu öffnen nach `npm install -g` | Schritt 7 |

**Eine Bitte:** Wenn etwas nicht schreibt, geh in der Konsole **nicht** auf „Regeln
bearbeiten" und setz alles auf `allow read, write: if true`. Damit ist die Datenbank für
jeden im Internet offen, auch zum Löschen. Sag mir stattdessen, was klemmt.

---

## Zum Nachlesen

- **`google-services.json` ist kein Geheimnis** im engen Sinn — sie steckt in jeder
  installierten App und lässt sich daraus auslesen. Was dein Projekt schützt, sind die
  Regeln aus Schritt 7. Gitignored ist sie trotzdem: In einem öffentlichen Repository wäre
  sie eine Einladung, den Regeln beim Aussieben zuzusehen.
- **Kosten:** Der kostenlose Spark-Plan hat 50.000 Lese- und 20.000 Schreibvorgänge pro
  Tag frei. Diese App liegt bei normaler Nutzung im dreistelligen Bereich pro Tag und
  Nutzer. Es ist keine Zahlungsmethode hinterlegt, es kann also nichts abgerechnet werden
  — bei Überschreitung wird gedrosselt.
- **Später für den Play Store:** Wenn du einen eigenen Release-Schlüssel anlegst, muss
  **dessen** SHA-1 zusätzlich in Schritt 4 hinterlegt werden. Ein Fingerabdruck ersetzt
  den anderen nicht, beide dürfen nebeneinander stehen.
- **App Check** (Firebase lehnt Anfragen ab, die nicht aus der echten App kommen) ist der
  nächste sinnvolle Schritt, aber **nicht jetzt**: Eine unvollständige Einrichtung
  blockiert *alle* Anfragen. Steht als Punkt 4 in `docs/backlog.md`.
