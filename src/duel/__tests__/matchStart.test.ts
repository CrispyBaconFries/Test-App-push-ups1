import { prepareSecondsLeft, shouldReportReady } from '../matchStart';

const PREPARE_UNTIL = 10_000;

describe('shouldReportReady', () => {
  it('meldet bereit, wenn Position steht und das Vorbereitungsfenster abgelaufen ist', () => {
    expect(
      shouldReportReady({ positionRecognised: true, prepareUntilMs: PREPARE_UNTIL, nowMs: PREPARE_UNTIL })
    ).toBe(true);
  });

  it('meldet NICHT bereit, solange das Vorbereitungsfenster läuft', () => {
    // Der Fall, der ohne Fenster das Match verdorben hätte: Wer schon im Stütz lag, als
    // der Gegner gefunden wurde, wäre nach zwei Sekunden bereit - der andere steht dann
    // noch auf halbem Weg zum Boden.
    expect(
      shouldReportReady({ positionRecognised: true, prepareUntilMs: PREPARE_UNTIL, nowMs: 2_000 })
    ).toBe(false);
  });

  it('meldet NICHT bereit, wenn die eigene Position noch nicht steht', () => {
    // Auch lange nach dem Fenster nicht: In der Rangliste kostet ein Match, das beginnt,
    // während einer noch steht, ihn echte LP.
    expect(
      shouldReportReady({ positionRecognised: false, prepareUntilMs: PREPARE_UNTIL, nowMs: 30_000 })
    ).toBe(false);
  });

  it('meldet NICHT bereit, solange gar kein Gegner da ist', () => {
    // Ohne Gegner gibt es kein Vorbereitungsfenster - im Freundschaftsspiel kann bis zum
    // Beitritt beliebig viel Zeit vergehen, und die darf nicht als Vorbereitung zählen.
    expect(shouldReportReady({ positionRecognised: true, prepareUntilMs: null, nowMs: 999_999 })).toBe(false);
  });
});

describe('prepareSecondsLeft', () => {
  it('rundet auf, damit die Anzeige nicht zu früh verschwindet', () => {
    expect(prepareSecondsLeft(PREPARE_UNTIL, 9_100)).toBe(1);
    expect(prepareSecondsLeft(PREPARE_UNTIL, 0)).toBe(10);
  });

  it('wird nicht negativ, wenn das Fenster schon abgelaufen ist', () => {
    expect(prepareSecondsLeft(PREPARE_UNTIL, 12_000)).toBe(0);
  });

  it('meldet null, solange kein Fenster läuft', () => {
    expect(prepareSecondsLeft(null, 5_000)).toBeNull();
  });
});
