# Firebase einrichten — Schritt für Schritt

Für: Rangliste, Ranglisten-Duelle, Freundschaftsspiele, Freundesliste und die Wertung im
Länderspiel. **Alles andere** (Training, Zählung, Formanalyse, Boss-Modus, Missionen,
Münz-Shop, Streak, Länderwahl) läuft ohne Firebase weiter — die App zeigt an den
betroffenen Stellen einen Hinweis statt abzustürzen.

Rechne mit **25–40 Minuten**. Kostenpunkt: 0 €. Der kostenlose Spark-Plan reicht für
dieses Projekt um Größenordnungen; eine Kreditkarte wird nicht verlangt.

Nach jedem größeren Schritt gibt es eine Prüfung:

```powershell
npm run firebase:check
```

Das Skript liest `google-services.json` und `app.json` und sagt dir bei jedem Problem
genau, was zu tun ist. Die drei Fehler, die es abfängt, scheitern sonst **lautlos** — die
App startet normal und meldet nur „Anmeldung fehlgeschlagen", ohne Grund. Im Release-Build
hast du kein Log, in dem du nachsehen könntest.

---

## Schritt 1 — Firebase-Projekt anlegen

1. https://console.firebase.google.com/ öffnen, mit deinem Google-Konto anmelden.
2. **Projekt erstellen** → Name z. B. `Liegestuetz-Coach`.
3. Google Analytics: **aus**. Braucht die App nicht, und es spart einen Einrichtungsschritt.
4. Warten, bis das Projekt fertig angelegt ist.

## Schritt 2 — Android-App registrieren

In der Projektübersicht auf das **Android-Symbol** klicken.

| Feld | Wert |
|---|---|
| Android-Paketname | `com.pushupcoach.app` |
| App-Alias | beliebig, z. B. `Liegestütz Coach` |
| SHA-1 | **erstmal leer lassen** — kommt in Schritt 4 |

Danach **google-services.json herunterladen**.

Die Datei gehört ins **Projekt-Wurzelverzeichnis**, also direkt neben `app.json` und
`package.json`:

```
C:\Users\chris\StudioProjects\Test-App-push-ups1\google-services.json
```

**Nicht** nach `android/` — der Ordner wird bei jedem Prebuild komplett neu erzeugt, deine
Datei wäre sofort wieder weg. Das Config-Plugin `plugins/withFirebaseConfig.js` kopiert sie
bei jedem Prebuild automatisch dorthin. Die Datei ist bereits gitignored, sie landet also
nie versehentlich auf GitHub.

Die restlichen Schritte des Assistenten („SDK hinzufügen", „App ausführen") kannst du
überspringen — das ist im Repository alles schon erledigt.

## Schritt 3 — Anmeldemethode Google aktivieren

**Build → Authentication → Los geht's → Sign-in method → Google → Aktivieren.**

Dabei wird ein Support-E-Mail-Kontakt verlangt — deine eigene Adresse genügt. Speichern.

> **Reihenfolge ist wichtig.** Erst mit dem Aktivieren dieser Anmeldemethode entsteht der
> „Web-Client-Schlüssel", den die App braucht. Eine `google-services.json`, die du *vorher*
> heruntergeladen hast, enthält ihn nicht.

Also jetzt: **Zahnrad → Projekteinstellungen → Meine Apps → Android-App →
google-services.json erneut herunterladen** und die alte Datei ersetzen.

Dann prüfen:

```powershell
npm run firebase:check
```

Das Skript zeigt dir jetzt den kompletten Web-Client-Schlüssel und die Zeile, die du in
`app.json` eintragen musst — Kopiervorlage inklusive. Sie steht ganz unten in der Datei
unter `"extra"`, wo aktuell noch `REPLACE_WITH_YOUR_WEB_CLIENT_ID...` steht.

## Schritt 4 — SHA-1-Fingerabdruck hinterlegen

Ohne diesen Schritt lässt Google die Anmeldung aus deiner App **nicht** zu. Die App startet
trotzdem, jede Anmeldung schlägt aber fehl — der häufigste und am schlechtesten erkennbare
Fehler beim Einrichten.

Du hast (noch) keine `keystore.properties`, dein Release-Build wird deshalb mit dem
**Debug-Schlüssel** signiert (so ist das Fallback in `plugins/withReleaseSigning.js`
gebaut). Dessen Fingerabdruck zeigt dieser Befehl:

```powershell
keytool -list -v -keystore "C:\Users\chris\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

Meldet PowerShell „keytool wird nicht erkannt", liegt es am Suchpfad — dann diesen Befehl
nehmen, er ruft dasselbe Programm über den vollen Pfad auf:

```powershell
& "C:\Users\chris\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.20.101-hotspot\bin\keytool.exe" -list -v -keystore "C:\Users\chris\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

In der Ausgabe steht ein Block „Zertifikat-Fingerabdrücke" mit einer Zeile `SHA1: ...` —
diesen Wert (die Doppelpunkte gehören dazu) kopieren.

Dann: **Zahnrad → Projekteinstellungen → Meine Apps → Android-App → Fingerabdruck
hinzufügen** → einfügen → speichern.

Und wieder: **google-services.json neu herunterladen** und die alte ersetzen. Erst danach
enthält sie den Android-OAuth-Eintrag, an dem `npm run firebase:check` erkennt, dass der
Fingerabdruck wirklich angekommen ist.

> Wenn du später für den Play Store einen eigenen Release-Schlüssel anlegst, muss **dessen**
> SHA-1 zusätzlich hier hinterlegt werden. Ein Fingerabdruck ersetzt den anderen nicht,
> beide dürfen nebeneinander stehen.

## Schritt 5 — Firestore anlegen

**Build → Firestore Database → Datenbank erstellen.**

| Frage | Antwort |
|---|---|
| Modus | **Produktionsmodus** (nicht Testmodus) |
| Standort | `eur3 (europe-west)` |

Warum Produktionsmodus: Der Testmodus macht die ganze Datenbank für 30 Tage weltweit les-
und schreibbar und schaltet sich danach kommentarlos ganz ab. Die richtigen Regeln liegen
im Repository und werden in Schritt 7 deployt — der Testmodus würde sie nur überschreiben.

Der Standort lässt sich **nachträglich nicht mehr ändern**.

## Schritt 6 — Realtime Database anlegen

**Build → Realtime Database → Datenbank erstellen.**

| Frage | Antwort |
|---|---|
| Standort | `Belgium (europe-west1)` |
| Regeln | **Gesperrter Modus** |

Das ist eine *zweite*, andere Datenbank neben Firestore, kein Duplikat. Sie trägt nur den
Live-Zählerstand während eines laufenden Duells — dafür ist sie schneller und billiger als
Firestore. Alles Dauerhafte liegt in Firestore.

## Schritt 7 — Regeln und Indexe deployen

Die Sicherheitsregeln liegen fertig im Repository (`firestore.rules`,
`database.rules.json`, `firestore.indexes.json`) — sie müssen nur noch hochgeladen werden.
Was sie erzwingen und warum, steht im README unter „Sicherheit: was die Regeln erzwingen".

Firebase-CLI installieren (einmalig, dauert 1–2 Minuten):

```powershell
npm install -g firebase-tools
```

Anmelden (öffnet den Browser):

```powershell
firebase login
```

Projekt auswählen (schreibt `.firebaserc`, gitignored):

```powershell
firebase use --add
```

Deployen:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,database
```

Erwartete Ausgabe: dreimal eine Zeile mit `✔` (`firestore: released rules`,
`firestore: deployed indexes`, `database: rules for ... released`), am Ende
`Deploy complete!`.

Die beiden zusammengesetzten Indexe brauchen anschließend noch ein paar Minuten, bis
Firebase sie fertig aufgebaut hat — nachzusehen unter **Firestore → Indexe**. Solange dort
„Wird erstellt" steht, liefert die Ranglisten-Ansicht keine Ergebnisse. Das ist normal und
erledigt sich von selbst.

## Schritt 8 — Regeln einmal in der Konsole gegenprüfen

Die Regeln lassen sich in dieser Entwicklungsumgebung **nicht** ausführen (dafür bräuchte
es die Firebase-Emulator-Suite). Die Tests im Repository prüfen nur, dass die gewollten
Einschränkungen im Regelwerk *stehen*. Ob sie auch das Richtige tun, zeigt der
**Regelsimulator**:

**Firestore → Regeln → Regelsimulator** (rechts oben).

Vier Fälle, die du einmal durchspielen solltest:

| # | Simulationstyp | Pfad | Authentifiziert | Daten | Erwartung |
|---|---|---|---|---|---|
| 1 | `update` | `/players/fremde-uid` | ja, UID `meine-uid` | `{"totalReps": 5}` | **verweigert** |
| 2 | `update` | `/players/meine-uid` | ja, UID `meine-uid` | `{"totalReps": 1}` bei bestehenden 100 | **verweigert** (Zähler dürfen nur wachsen) |
| 3 | `update` | `/rankedQueue/fremde-uid` | ja, beliebige UID | `{"status": "matched", "matchedDuelCode": "ABC123"}` auf einem Eintrag mit `status: "waiting"` | **erlaubt** (sonst funktioniert das Matchmaking nicht) |
| 4 | `update` | `/nationsEvents/2026-09-11` | ja | ein `result`-Feld, während `endsAtMs` noch in der Zukunft liegt | **verweigert** |

Fall 2 und 3 brauchen im Simulator vorhandene Daten — dafür gibt es dort das Feld
„Vorhandenes Dokument simulieren". Fällt einer der vier anders aus als in der Tabelle:
sag mir welcher, dann sehe ich mir die betroffene Regel an.

## Schritt 9 — Neu bauen

Das Prebuild ist hier **Pflicht** und nicht optional: `google-services.json` muss ins
native Projekt kopiert und die Firebase-Bibliotheken müssen in den Build aufgenommen
werden. Ein reines `npm run android:release` würde die Datei nicht bemerken.

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

Beim Prebuild darf die Warnung
`[withFirebaseConfig] Kein google-services.json ... gefunden` **nicht** mehr erscheinen.
Tut sie es doch, liegt die Datei am falschen Ort — zurück zu Schritt 2.

## Schritt 10 — In der App prüfen

1. App öffnen → **Anmelden** → Google-Konto wählen. Kommt „Anmeldung fehlgeschlagen":
   Schritt 3 (Web-Client-Schlüssel) oder Schritt 4 (SHA-1) ist nicht sauber durch —
   `npm run firebase:check` sagt welcher.
2. Ein kurzes Training machen und beenden.
3. **Rangliste** öffnen: Du solltest dort mit deinem Namen und deinen Liegestützen stehen.
4. In der Firebase-Konsole unter **Firestore → Daten** muss jetzt eine Sammlung `players`
   mit genau einem Dokument liegen.

Ab da können wir zu zweit testen: Freundescode austauschen, Freundschaftsspiel,
Ranglisten-Duell, Länderspiel-Wertung.

---

## Worauf du achten musst

- **`google-services.json` ist ein Zugangsschlüssel-Bündel, kein Geheimnis** im engen Sinn —
  sie steckt in jeder installierten App und lässt sich daraus auslesen. Was dein Projekt
  schützt, sind die Sicherheitsregeln aus Schritt 7, nicht die Geheimhaltung dieser Datei.
  Trotzdem ist sie gitignored: In einem öffentlichen Repository ist sie eine Einladung, den
  Regeln beim Aussieben zuzusehen.
- **Nach jeder Änderung in der Firebase-Konsole, die google-services.json betrifft**
  (SHA-1 hinzufügen, Anmeldemethode aktivieren, App umbenennen) die Datei **neu
  herunterladen** und ein `npx expo prebuild --clean` machen. Die alte Datei sieht identisch
  aus, ist es aber nicht.
- **Nicht in den Testmodus zurückfallen.** Wenn irgendwann etwas nicht schreibt, ist die
  Versuchung groß, in der Konsole „Regeln bearbeiten" zu öffnen und alles auf
  `allow read, write: if true` zu setzen. Damit ist deine Datenbank für jeden im Internet
  offen — auch zum Löschen. Sag mir stattdessen, was nicht schreibt.
- **Der Standort beider Datenbanken ist endgültig.** Falscher Standort heißt: Projekt
  löschen und neu anfangen.
- **Kosten:** Der Spark-Plan hat 50.000 Lesevorgänge und 20.000 Schreibvorgänge pro Tag
  frei. Diese App liegt bei normaler Nutzung im dreistelligen Bereich pro Tag und Nutzer.
  Es gibt keine hinterlegte Zahlungsmethode, es kann also auch nichts abgerechnet werden —
  bei Überschreitung wird schlicht gedrosselt.
- **App Check** (Firebase lehnt Anfragen ab, die nicht aus der echten App kommen) ist der
  nächste sinnvolle Schritt, aber **nicht jetzt**: Eine unvollständige Einrichtung blockiert
  *alle* Anfragen. Steht als Punkt 4 in `docs/backlog.md`, sinnvoll ab dem ersten
  Play-Store-Eintrag.

## Wenn etwas nicht funktioniert

| Symptom | Wahrscheinliche Ursache |
|---|---|
| „Anmeldung fehlgeschlagen", sofort und ohne Kontoauswahl | SHA-1 fehlt (Schritt 4) |
| Kontoauswahl erscheint, danach Fehler | Web-Client-Schlüssel in `app.json` falsch (Schritt 3) |
| App zeigt weiterhin „Noch nicht eingerichtet" | Prebuild fehlte oder `google-services.json` liegt falsch (Schritt 2 und 9) |
| Rangliste bleibt leer, obwohl du angemeldet bist | Indexe bauen noch (Schritt 7, „Wird erstellt") |
| „Missing or insufficient permissions" | Regeln nicht deployt (Schritt 7) |
| Duell startet nie, beide warten | Realtime-Database-Regeln nicht deployt (Schritt 7, Teil `database`) |

Bei allem, was hier nicht steht: Sag mir, **welcher Schritt** und **welche Meldung wörtlich**
— daran erkenne ich die Ursache meist sofort.
