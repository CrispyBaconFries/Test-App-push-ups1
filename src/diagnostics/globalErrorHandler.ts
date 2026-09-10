import { recordError } from './errorLog';

/**
 * Fängt Fehler ab, die **außerhalb** des React-Renderings passieren.
 *
 * Die Fehlergrenze (`ErrorBoundary`) bekommt nur mit, was beim Zeichnen einer Komponente
 * schiefgeht. Alles andere sieht sie nicht: ein Fehler in einem Knopf-Handler, in einer
 * Zeitgeber-Rückrufaktion, im Kamera-Frame-Pfad, in einer nicht abgefangenen Zusage
 * (`Promise`). Genau dort sitzt in dieser App aber das meiste — die Posenerkennung läuft
 * ausschließlich in Rückrufaktionen.
 *
 * Im Release-Build beendet ein solcher Fehler die App wortlos. Ohne diese Aufzeichnung
 * bliebe davon nichts übrig außer „die App hat sich geschlossen".
 */

/**
 * React Natives globaler Fehlerbehandler. Kein offizieller Teil der Typen, aber seit
 * Jahren stabiler Bestandteil der Laufzeit - und der einzige Weg, an diese Fehler zu
 * kommen, ohne ein Absturzberichts-SDK einzubauen.
 */
type ErrorUtilsLike = {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

let installed = false;

/**
 * Einmalig beim App-Start aufrufen.
 *
 * Der bisherige Behandler wird **aufgehoben und danach weiter aufgerufen**, nicht ersetzt.
 * Er ist es, der im Entwicklungsbetrieb die rote Fehlerbox zeigt und im Release den
 * Absturz ordentlich zu Ende bringt. Ihn zu verschlucken hieße, aus einem sichtbaren
 * Absturz eine App zu machen, die einfach einfriert - schlimmer als vorher.
 */
export function installGlobalErrorHandler(): void {
  if (installed) return;
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return; // z. B. in der Web-Vorschau und in Tests
  installed = true;

  const previous = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    // Bewusst ohne `await`: Der bisherige Behandler beendet bei einem fatalen Fehler
    // gleich die App. Auf das Schreiben zu warten würde das nur verzögern, nicht
    // sicherer machen - und `recordError` wirft selbst nie.
    void recordError(error, 'ausserhalb der Anzeige', { fatal: Boolean(isFatal) });
    previous?.(error, isFatal);
  });
}
