# Attrappen für die Web-Vorschau

Diese Dateien ersetzen native Pakete, **wenn und nur wenn** Metro für die Plattform `web`
bündelt (siehe `metro.config.js`, `resolver.resolveRequest`). Auf Android und iOS wird
nichts davon angefasst — dort laufen weiterhin die echten Pakete.

**Wofür.** Die Web-Vorschau (`npm run web`) ist da, um Layout, Abstände, Farben und
Animationen am PC mit Sofort-Reload zu ändern, statt für jede Kleinigkeit einen
Gradle-Build und ein Handy zu brauchen. Ohne diese Attrappen startet sie gar nicht:
`react-native-vision-camera` wirft schon **beim Import** „VisionCamera currently does not
work on web", und die Seite bleibt weiß.

**Was sie NICHT sind.** Kein Ersatz für einen Test auf dem Gerät. Alles, was mit Kamera,
Posenerkennung oder Firebase zu tun hat, ist hier bewusst leer — die Web-Vorschau kann
nicht zählen und nicht anmelden. Was sie zeigt, ist alles andere: jeden Bildschirm, jede
Kachel, die Effekt-Werkstatt, und auch die Anzeigen, die **über** dem Kamerabild liegen
(die Attrappe rendert dafür eine ruhige dunkle Fläche).

**Regel beim Erweitern.** Eine Attrappe darf immer nur genau das exportieren, was die App
aus dem echten Paket auch benutzt — nicht mehr. Alles Weitere täuscht eine
Funktionsfähigkeit vor, die es hier nicht gibt.
