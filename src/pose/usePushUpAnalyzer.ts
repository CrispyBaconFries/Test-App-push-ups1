import { useRef } from 'react';
import { PushUpAnalyzer } from './formAnalysis';

/**
 * Gibt einen `PushUpAnalyzer` zurück, der für die gesamte Lebensdauer des Bildschirms
 * derselbe bleibt.
 *
 * Warum nicht einfach `useRef(new PushUpAnalyzer())`: Das Argument von `useRef` wird bei
 * **jedem** Render ausgewertet, auch wenn nur das Ergebnis des ersten behalten wird. Die
 * Kamera-Bildschirme rendern pro Kamerabild neu (der Live-Zustand fließt in die Anzeige),
 * es entstünde also gut ein Dutzend sofort weggeworfener Analyzer pro Sekunde - genau in
 * dem Pfad, der ohnehin am meisten zu tun hat.
 *
 * Der Rückgabewert ist bewusst der Analyzer selbst und nicht das Ref-Objekt: Sonst
 * bräuchte jeder Aufrufer ein `!`, weil TypeScript innerhalb von `useCallback` nicht
 * sehen kann, dass das Ref oben schon befüllt wurde.
 */
export function usePushUpAnalyzer(): PushUpAnalyzer {
  const ref = useRef<PushUpAnalyzer | null>(null);
  if (ref.current === null) ref.current = new PushUpAnalyzer();
  return ref.current;
}
