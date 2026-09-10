import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Eine Meldung, die von selbst wieder verschwindet.
 *
 * Gebraucht für Hinweise, die aus dem Kamerapfad kommen (eine verworfene Bewegung) und
 * kein Ereignis haben, an dem sie enden könnten: Es gibt kein "der Verwurf ist vorbei",
 * nur den einen Moment, in dem er auftritt. Ohne Zeitgeber stünde der Satz bis zum
 * nächsten Verwurf auf dem Bildschirm - und damit auch über den Wiederholungen, die
 * danach sauber gezählt wurden.
 *
 * `show` ist über die Lebensdauer stabil und darf deshalb in einem `useCallback` mit
 * leerer Abhängigkeitsliste benutzt werden - genau das brauchen die Kamera-Rückrufe, die
 * bei 30 Bildern/s nicht neu erzeugt werden sollen.
 */
export function useTransientNotice(durationMs = 2500): {
  notice: string | null;
  show: (text: string | null) => void;
} {
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string | null) => {
      if (text === null) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setNotice(text);
      timerRef.current = setTimeout(() => setNotice(null), durationMs);
    },
    [durationMs]
  );

  // Ohne das läuft der Zeitgeber nach dem Verlassen des Bildschirms weiter und setzt
  // Zustand auf einer Komponente, die es nicht mehr gibt.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { notice, show };
}
