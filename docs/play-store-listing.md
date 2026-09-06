# Play Store: fertige Texte zum Copy-Paste

Alles hier ist fertig formuliert und passt in die jeweiligen Zeichenlimits der Play
Console. Wo eine Kontakt-E-Mail gebraucht wird, steht der Platzhalter
`KONTAKT-E-MAIL@ersetzen.de` — einmal global ersetzen (auch in `docs/index.html` und
`docs/terms.html`), dann sind alle drei Stellen konsistent.

Play Console ändert gelegentlich Beschriftungen/Reihenfolge einzelner Formularfelder —
falls eine Option hier nicht exakt so heißt wie in deiner Play-Console-Ansicht, die
inhaltlich passende wählen.

## Haupteintrag ("Store-Eintrag")

**App-Name**
```
Liegestütz Coach
```

**Kurzbeschreibung** (max. 80 Zeichen, aktuell 78)
```
Liegestütz-Form live per Kamera analysieren, Wiederholungen automatisch zählen
```

**Vollständige Beschreibung** (max. 4000 Zeichen, aktuell 1733)
```
Liegestütz Coach ist dein persönlicher Trainingsbegleiter für saubere Liegestütze – direkt auf deinem Handy, ganz ohne zusätzliche Hardware.

📷 Live-Formanalyse
Leg dein Handy vor dich auf den Boden. Die Frontkamera und ein On-Device-Bilderkennungsmodell (Google MediaPipe) analysieren deine Körperhaltung in Echtzeit – als Strichmännchen-Overlay direkt über dem Kamerabild sichtbar. Die komplette Bildverarbeitung läuft ausschließlich auf deinem Gerät; es werden keine Kamerabilder gespeichert oder hochgeladen.

🔢 Automatische Wiederholungszählung
Jede Liegestütz-Wiederholung wird automatisch erkannt und gezählt – inklusive Bewertung der Ausführungsqualität (Tiefe, Hüftposition, Ellenbogenhaltung, Kopfhaltung) mit direktem akustischem Feedback nach jeder Wiederholung.

🏆 Motivation durch Gamification
• Punkte & Level für jede saubere Wiederholung
• Tägliche und wöchentliche Trainingsziele mit Fortschrittsanzeige
• Auszeichnungen für erreichte Meilensteine
• Persönliche Bestleistungen im Blick
• Optionale tägliche Trainings-Erinnerung

📈 Trainingsverlauf
Jedes Workout wird lokal gespeichert – mit Wiederholungen, Datum, Uhrzeit und Form-Score, jederzeit einsehbar im Trainingsverlauf.

🔒 Datenschutz zuerst
Keine Werbung, kein Tracking, keine Analyse-SDKs Dritter. Alle Trainingsdaten bleiben auf deinem Gerät. Eine Anmeldung mit deinem Google-Konto ist möglich, aber komplett optional.

Liegestütz Coach eignet sich für Einsteiger und Fortgeschrittene, die ihre Liegestütz-Form verbessern und ihr Training spielerisch verfolgen wollen.

Hinweis: Diese App ist ein Trainingshilfsmittel und ersetzt keine ärztliche oder fachliche Beratung. Sprich vor Beginn eines neuen Trainingsprogramms mit einer Ärztin oder einem Arzt.
```

**Was ist neu** (Release-Notes für die erste Version)
```
Erste Veröffentlichung von Liegestütz Coach: Live-Formanalyse per Kamera, automatische Wiederholungszählung, Gamification (Punkte, Level, Auszeichnungen, Trainingsziele) und optionale Google-Anmeldung.
```

**Kategorie**: Gesundheit & Fitness
**Tags/Schlagwörter-Vorschlag**: Fitness, Training, Liegestütze, Workout, Krafttraining

**Kontakt-E-Mail**: `KONTAKT-E-MAIL@ersetzen.de`
**Website**: `https://crispybaconfries.github.io/Test-App-push-ups1/`
**Datenschutzerklärung-URL**: `https://crispybaconfries.github.io/Test-App-push-ups1/`

## Zielgruppe und Inhalte

- **Zielgruppe**: Allgemein / nicht speziell an Kinder gerichtet (kein Design/Marketing für Kinder, keine kindgerechte Aufmachung).
- **An Kinder gerichtet?** Nein.

## Inhaltsbewertung (IARC-Fragebogen)

Alle Fragen sind mit „Nein" zu beantworten, außer explizit anders vermerkt:

| Frage | Antwort |
|---|---|
| Gewaltdarstellung | Nein |
| Angst-/Horror-Inhalte | Nein |
| Sexuelle Inhalte/Nacktheit | Nein |
| Vulgäre Sprache/Schimpfwörter | Nein |
| Alkohol, Tabak, Drogen | Nein |
| Glücksspiel (simuliert oder echt) | Nein |
| Nutzer können miteinander interagieren/chatten | Nein (kein Mehrspieler-/Chat-Feature) |
| Nutzergenerierte Inhalte werden geteilt | Nein |
| Standort wird geteilt | Nein |
| Käufe (In-App-Käufe, echtes Geld) | Nein |

## Datensicherheit ("Data Safety")

**Werden Nutzerdaten erfasst oder weitergegeben?** Ja (erfasst), Nein (weitergegeben an Dritte).

| Datentyp | Erfasst? | An Dritte geteilt? | Nur on-device / sofort verworfen? | Zweck | Nutzer kann Löschung anfragen? |
|---|---|---|---|---|---|
| Kamerabild (Liegestütz-Haltung) | Ja | Nein | Ja – pro Frame verarbeitet, nie gespeichert | App-Funktionalität | Entfällt (nichts wird gespeichert) |
| Name, E-Mail-Adresse, Profilbild (nur bei optionaler Google-Anmeldung) | Ja | Nein | Nein – dauerhaft, aber ausschließlich lokal & verschlüsselt (Android Keystore/iOS Schlüsselbund) | App-Funktionalität, Personalisierung | Ja – „Abmelden" in der App |
| Trainingsdaten (Wiederholungen, Datum/Uhrzeit, Form-Score, Punkte) | Ja | Nein | Nein – dauerhaft, aber nur lokal auf dem Gerät | App-Funktionalität | Ja – App-Daten löschen/App deinstallieren |

Zusatzfragen, die die Play Console typischerweise noch stellt:
- **Werden alle erfassten Daten verschlüsselt übertragen?** Ja (es findet ohnehin keine Übertragung an einen Server statt – nichts geht unverschlüsselt raus).
- **Bietet die App eine Möglichkeit, Löschung von Daten zu beantragen?** Ja, direkt in der App (Abmelden / App-Daten löschen) – es gibt keinen Server-Account, der separat gelöscht werden müsste.
- **Werbe-ID / Analytics-SDKs?** Keine.

## Google-OAuth-Zustimmungsbildschirm (Google Cloud Console)

| Feld | Wert |
|---|---|
| App-Name | Liegestütz Coach |
| Nutzer-Support-E-Mail | `KONTAKT-E-MAIL@ersetzen.de` |
| App-Logo | `assets/icon.png` (1024×1024 – bei Bedarf auf die von Google verlangte Größe zuschneiden) |
| Anwendungs-Startseite | `https://crispybaconfries.github.io/Test-App-push-ups1/` |
| Link zur Datenschutzerklärung | `https://crispybaconfries.github.io/Test-App-push-ups1/` |
| Link zu Nutzungsbedingungen | `https://crispybaconfries.github.io/Test-App-push-ups1/terms.html` |
| Autorisierte Domains | `crispybaconfries.github.io` |
| E-Mail-Adressen der Entwickler (Kontakt) | `KONTAKT-E-MAIL@ersetzen.de` |
| Angefragte Bereiche (Scopes) | `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid` — Standard-Scopes, die die Bibliothek automatisch anfragt; keine "sensiblen"/"eingeschränkten" Scopes, daher **keine** aufwändige Google-Verifizierungsprüfung nötig. |

## Noch offen (keine Schreibarbeit, sondern echte Assets/Accounts)

- **Screenshots** (mind. 2, empfohlen 4–8): brauchen ein echtes Gerät mit laufender App –
  entstehen erst nach deinem ersten Test.
- **Feature-Grafik** (1024×500 Banner): rein visuelles Asset, sag Bescheid, wenn ich dir
  eins aus den bestehenden Marken-Farben bauen soll.
- **App-Icon**: bereits vorhanden (`assets/icon.png`, 1024×1024) – erfüllt die
  Play-Store-Anforderung, nichts zu tun.
- **Google-Cloud-Console-Projekt/OAuth-Client-IDs, Play-Console-Entwicklerkonto,
  Release-Keystore**: eigene Accounts/Geheimnisse, die nur du anlegen kannst (siehe
  README „Google-Anmeldung einrichten" / „Play-Store-Veröffentlichung").
