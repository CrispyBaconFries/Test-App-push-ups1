/**
 * Abstände, Rundungen und Schriftgrößen der gesamten App — an einer Stelle.
 *
 * # Wozu
 *
 * chris' Wunsch war, das Design **für die ganze App auf einmal** ändern zu können, statt
 * Bildschirm für Bildschirm. Vorher standen die Zahlen als Literale in 24 StyleSheets:
 * „alles etwas luftiger" hieß, 340 Stellen einzeln anzufassen und dabei Dutzende zu
 * übersehen. Jetzt läuft jede dieser Zahlen durch `space()`, `radius()` oder `font()` —
 * und über den Faktor ganz oben ändert **eine einzige Zahl** die ganze App.
 *
 * ```ts
 * const SPACING_SCALE = 1.15;   // überall 15 % luftiger
 * const RADIUS_SCALE  = 0.5;    // kantiger statt rund
 * const FONT_SCALE    = 1.1;    // alle Texte größer
 * ```
 *
 * Mit `npm run web` ist das Ergebnis in ein bis zwei Sekunden im Browser zu sehen (siehe
 * README, „Web-Vorschau") — erst diese Kombination macht daraus ein Werkzeug statt einer
 * Aufräumaktion.
 *
 * # Warum drei getrennte Faktoren
 *
 * Weil es drei unabhängige Fragen sind. „Zu gedrängt" hat nichts mit „zu rund" zu tun, und
 * wer die Schrift größer will, will deshalb nicht automatisch größere Abstände. Ein
 * einzelner Faktor für alles hätte jede Änderung zu einem Kompromiss gemacht.
 *
 * # Warum die Zahlen bleiben, wie sie sind
 *
 * Die Übernahme war bewusst **wirkungsneutral**: `space(16)` ergibt bei Faktor 1 exakt die
 * 16, die vorher dort stand. Es wäre naheliegend gewesen, bei der Gelegenheit gleich
 * aufzuräumen — die App benutzt heute 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32 und
 * 48, also praktisch jede gerade Zahl. Eine strengere Stufung (nur 4, 8, 16, 24, 32) wäre
 * sauberer, verschiebt aber überall die Optik. Das ist eine **Design-Entscheidung**, und
 * die trifft chris, wenn er es im Browser vergleichen kann — nicht ich nebenbei in einem
 * Umbau, dessen ganzer Sinn es war, nichts zu verändern.
 */

/** Faktor für alle Abstände (Innen-/Außenabstände, Lücken). 1 = wie bisher. */
const SPACING_SCALE = 1;

/** Faktor für alle Eckenrundungen. 1 = wie bisher, 0 = überall eckig. */
const RADIUS_SCALE = 1;

/** Faktor für alle Schriftgrößen und Zeilenhöhen. 1 = wie bisher. */
const FONT_SCALE = 1;

/**
 * `Math.round` und nicht der rohe Bruchwert: React Native käme mit Nachkommastellen zwar
 * zurecht, aber gerundete Werte lassen Kanten auf allen Bildschirmdichten sauber
 * aufeinandertreffen — und sie sind im Debugger lesbar.
 */
function scaled(px: number, factor: number): number {
  return Math.round(px * factor);
}

/**
 * Ein Abstand in px, wie er bei Faktor 1 aussehen soll.
 *
 * Bewusst eine Funktion statt benannter Stufen (`space.md`): Die App benutzt heute rund ein
 * Dutzend verschiedener Werte, für die es keine ehrlichen Namen gibt — „cozy" und „roomy"
 * hätte ich mir ausgedacht, und niemand wüsste, welcher davon 14 ist. Die Zahl im Aufruf
 * sagt genau das, was da steht; der Faktor macht sie trotzdem an einer Stelle steuerbar.
 */
export function space(px: number): number {
  return scaled(px, SPACING_SCALE);
}

/** Eine Eckenrundung in px, wie sie bei Faktor 1 aussehen soll. */
export function radius(px: number): number {
  return scaled(px, RADIUS_SCALE);
}

/** Eine Schriftgröße oder Zeilenhöhe in px, wie sie bei Faktor 1 aussehen soll. */
export function font(px: number): number {
  return scaled(px, FONT_SCALE);
}

/**
 * Für vollständig runde Enden (Chips, Pillen-Knöpfe).
 *
 * Läuft absichtlich **nicht** durch `radius()`: Das hier ist kein Maß, sondern ein
 * "so rund wie möglich". Mit dem Faktor multipliziert würde ein `radiusScale` von 0,5 aus
 * einer Pille eine halbe Pille machen, und das war nie gemeint.
 */
export const PILL_RADIUS = 999;

/**
 * # Was hier bewusst NICHT steht
 *
 * Benannte Maße wie `cardPadding` oder `cardRadius` wären der nächste logische Schritt —
 * „ändere `cardRadius`, und jede Karte der App zieht mit". Sie fehlen hier aus einem
 * Grund: Die App benutzt heute für Karten 14, 16, 18 und 20 als Rundung. Sie unter einem
 * Namen zusammenzufassen heißt, sich für **einen** Wert zu entscheiden — und damit das
 * Aussehen von drei Vierteln aller Karten zu ändern.
 *
 * Das ist genau die Design-Entscheidung, die chris treffen soll, sobald er sie im Browser
 * vergleichen kann. Sie hier vorwegzunehmen hätte den Umbau, dessen ganzer Zweck
 * Wirkungsneutralität war, zu einer stillen Umgestaltung gemacht. Ungenutzte Konstanten
 * einzubauen, die so tun, als wäre schon etwas vereinheitlicht, wäre die schlechtere
 * Variante davon.
 */
