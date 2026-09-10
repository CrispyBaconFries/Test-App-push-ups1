# Grafik: Icons, Rahmen, Effekte — Wege und Bezugsquellen

Stand 10.09.2026. Grundlage für die Entscheidung, wie der optische Teil weitergeht.

## Erstmal: das ist nicht *eine* Aufgabe

Drei Sorten Grafik, die völlig unterschiedliche Lösungen brauchen. Sie in einen Topf zu
werfen ist der Grund, warum „wir machen mal das Design" sonst immer versandet:

| | Was | Beispiel in dieser App | Braucht |
|---|---|---|---|
| **1** | **Bedien-Icons** | Zurück-Pfeil, Häkchen, Pokal, Flamme in der Kachel | Ein Icon-*Satz*, keine Einzelbilder |
| **2** | **Schmuck-Grafik** | Avatar-Motive im Münz-Shop, Boss-Illustrationen, Splash | Echte Bilddateien — hier ist eine Bild-KI stark |
| **3** | **Effekte** | Rahmen um den Avatar, Leuchten, Flammen, Blitze | **Code**, keine Bilddateien |

Punkt 1 ist schon gelöst (`@expo/vector-icons`/Ionicons, 1300 Icons, bereits im Projekt).
Punkt 3 ist der, nach dem du gefragt hast — und ausgerechnet dort sind Bilddateien der
falsche Weg. Warum, steht gleich.

---

## Vorschlag A — Effekte im Code (Empfehlung)

**Was schon da ist:** `react-native-svg`, `react-native-reanimated`, `expo-linear-gradient`
sind bereits Abhängigkeiten des Projekts. `RankFrame.tsx` macht heute schon Farbverlauf,
Leuchten und Pulsieren je Rang — nur eben zurückhaltend.

**Was damit geht,** ohne eine einzige Bilddatei:

- rotierender Farbverlauf im Ring (der „legendäre" Look aus League of Legends & Co.)
- Leuchten, das mit dem Puls atmet (haben wir, nur dezent)
- Funken/Partikel, die am Ring entlanglaufen
- **Flammen**: 3–5 SVG-Pfade, deren Kontrollpunkte animiert werden, in Orange→Gelb
- **Blitze**: gezackte Pfade, die im Zufallstakt für 80 ms aufblitzen
- **Super-Saiyajin-Aura**: ein zweiter, größerer Ring mit Radialverlauf, der in Größe und
  Deckkraft schwingt, plus aufsteigende Funken

**Warum das hier besser ist als Bilddateien:**

| | Code (SVG + Reanimated) | Bilddateien (PNG/GIF/Sprite) |
|---|---|---|
| Neue native Abhängigkeit | **nein** — kein Prebuild, kein Gradle-Ärger | teils ja |
| Größe | wenige KB | schnell mehrere MB pro Effekt |
| Auflösung | beliebig scharf, 36 px wie 200 px | für jede Größe eigene Datei |
| Farbe je Rang/Theme | eine Zeile — der Rang-Farbwert steckt schon im Code | pro Farbe ein eigener Satz Dateien |
| Änderung „etwas weniger grell" | ein Zahlenwert | zurück zum Bildgenerator, alles neu |
| Lizenz | keine Frage | muss geklärt werden |

Der Punkt „keine neue native Abhängigkeit" wiegt bei diesem Projekt besonders schwer — du
weißt, wie viel Zeit uns Gradle, CMake und Prefab schon gekostet haben.

**Konkreter erster Schritt, den ich vorschlage:** eine **Effekt-Werkstatt** als eigener
Bildschirm in der App (erreichbar über den Startbildschirm, wie der Kalibrier-Knopf). Dort
stehen alle Rahmen-Varianten nebeneinander — je Rang, je Theme, je Effekt — mit Schiebern
für Stärke, Tempo und Farbe. Du siehst sie **auf deinem Handy in echt**, nicht auf einem
Screenshot, und sagst mir „Nummer 3, aber langsamer". Das ersetzt das Raten, das uns bisher
bremst.

Aufwand: ein Abend für die Werkstatt plus 4–6 Effekte.

## Vorschlag B — Lottie, wenn Code an die Grenze kommt

Für alles, was wirklich *gezeichnet* aussehen soll (züngelnde Flammen mit Rauch, eine
komplette Aura mit Bodenstaub), ist eine handanimierte Vektor-Animation überlegen. Das
Format dafür heißt **Lottie**: Vektor, klein (10–100 KB), beliebig skalierbar, läuft flüssig.

- **Quelle:** https://lottiefiles.com — tausende freie Animationen, „Fire", „Lightning",
  „Aura", „Glow". Lizenz je Datei prüfen, es gibt kostenlose und kostenpflichtige.
- **Kosten:** eine neue native Abhängigkeit (`lottie-react-native`) → `npm install` +
  `npx expo prebuild --clean` + das Risiko einer neuen Gradle-Baustelle.

**Empfehlung: erst A, und B nur für die zwei, drei Effekte, bei denen A sichtbar
schlechter aussieht.** Nicht andersherum.

## Vorschlag C — Fertige Grafiksätze für die Schmuck-Grafik

Für Avatar-Motive, Boss-Illustrationen und Abzeichen:

| Quelle | Was | Lizenz | Achtung |
|---|---|---|---|
| **game-icons.net** | ~4000 Spiel-Icons (Muskeln, Hanteln, Kronen, Schädel, Blitze) — wie für diese App gemacht | CC BY 3.0 | **Namensnennung nötig** → braucht einen „Danksagungen"-Bildschirm |
| **kenney.nl** | Komplette Spiel-Grafiksätze, sehr konsistent | **CC0** | keine Auflagen, auch kommerziell |
| **Iconify** (Lucide, Phosphor, Tabler) | Saubere Bedien-Icons | meist MIT | eher für Punkt 1 |
| **Flaticon / Freepik** | Riesige Auswahl | frei nur mit Namensnennung | Stile mischen sich schlecht |
| **Bild-KI** | Einzigartige Motive | dir gehört das Ergebnis | Konsistenz ist das Problem, siehe unten |

**Zur Lizenz, ehrlich:** Solange die App auf deinem Handy läuft, interessiert das niemanden.
Sobald sie in den Play Store geht, ist CC BY ohne Namensnennung eine
Urheberrechtsverletzung. **CC0 (Kenney) ist deshalb die entspannteste Wahl** — und wenn wir
game-icons.net nehmen, baue ich gleich den Danksagungen-Bildschirm mit ein, dann ist es
sauber und erledigt.

---

## Bringt eine andere KI das besser?

Geteilte Antwort — es kommt darauf an, welche der drei Sorten:

**Ja, für Punkt 2 (Schmuck-Grafik).** Eine Bild-KI (Midjourney, DALL·E, Adobe Firefly,
Stable Diffusion) macht in Minuten Avatar-Motive und Boss-Illustrationen, für die man sonst
einen Illustrator bezahlt. Das kann ich nicht — ich schreibe Code, ich male keine Bilder.

**Nein, für Punkt 3 (Effekte).** Ein rotierender Leucht-Rahmen ist kein Bild, sondern
Code, der sich in `RankFrame.tsx`, das Rang-System und die Farbwerte einfügen muss. Eine
KI, die das Projekt nicht kennt, fängt bei null an — und du hättest anschließend Code, den
niemand getestet hat, in genau dem Pfad, der bei jedem Kamerabild mitläuft.

**Nein, für Punkt 1 (Bedien-Icons).** Bild-KIs sind bei kleinen Icons schwach: Bei 24 px
verschwimmt alles, die Strichstärken passen nicht zueinander, und acht Icons „im selben
Stil" werden acht Icons in acht Stilen. Ein fertiger Satz ist immer besser.

**Und was eine Bild-KI zuverlässig schlecht macht,** unabhängig vom Anbieter:
sauber freigestellte Transparenz (es bleiben Ränder), exakt gleiche Bildausschnitte über
mehrere Bilder, Text im Bild, und alles was sich bewegen soll.

### Der Prompt, wenn du es ausprobieren willst

Für die acht Avatar-Motive aus dem Münz-Shop (`src/ranking/avatar.ts`). **Ein Bild pro
Motiv** erzeugen, den Kern-Prompt dabei Wort für Wort gleich lassen und nur das **fett**
markierte Motiv austauschen — das ist der einzige verlässliche Weg zu einem Satz, der
zusammenpasst:

```
A single centered icon of a **flame**, flat vector illustration style,
bold thick outlines, 3 colors only: bright green (#37E27C), deep navy (#0B0F14),
warm orange (#FF9F45). Solid flat magenta background (#FF00FF), no gradient,
no shadow, no text, no border, no frame. Simple bold shapes readable at 40 pixels,
symmetrical, centered with generous even margin. Square 1:1, sticker style, game UI asset.
```

Die acht Motive, in dieser Reihenfolge:
`flame`, `lightning bolt`, `rocket`, `skull`, `animal paw print`, `planet with ring`,
`diamond gem`, `shield`.

Danach:

1. **Magenta-Hintergrund entfernen** (remove.bg, Photopea oder GIMP → Zauberstab). Der
   knallige, in den Motivfarben nicht vorkommende Hintergrund ist genau dafür da — bei Weiß
   oder Transparenz-Karo frisst die Freistellung Teile des Motivs mit weg.
2. **Auf 256×256 PNG** verkleinern und mir die Dateien schicken. Ich lege sie unter
   `assets/avatars/` ab und hänge sie an die bestehenden `AvatarIconId`s — im Code ändert
   sich dadurch nichts weiter, das Datenmodell steht schon.
3. **Erst ansehen, dann behalten:** Halte die acht nebeneinander. Wirkt eines fremd, lieber
   dieses eine neu erzeugen als den Stil der anderen sieben nachziehen.

Für einen einzelnen Boss oder ein Splash-Bild darf der Prompt deutlich freier sein —
dort schadet Einzigartigkeit nicht, weil es kein Satz ist, der zusammenpassen muss.

---

## Was ich vorschlage, in dieser Reihenfolge

1. **Effekt-Werkstatt bauen** (Vorschlag A) — danach entscheidest *du* am Handy statt ich
   im Blindflug. Das ist auch die Antwort auf deine frühere Frage nach einem schnellen
   Design-Weg.
2. **Zentrale `src/theme/layout.ts`** — alle Größen, Abstände, Radien an einer Stelle statt
   in 14 StyleSheets. Danach ist „alles etwas luftiger" eine Zahl, kein Rundgang durch die
   halbe App.
3. **Erst dann Bilddateien**: die acht Avatar-Motive per Bild-KI (Prompt oben), Abzeichen
   und Boss-Motive aus CC0-Sätzen.

Punkt 1 und 2 brauchen dich nur zum Schauen und Entscheiden — keine Bildbearbeitung, keine
Lizenzfragen, kein neuer Build außer dem gewohnten.
