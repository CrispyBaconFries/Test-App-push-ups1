import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { FrameEffectLayer } from '../FrameEffectLayer';
import { FRAME_EFFECT_IDS, SIZE_RANGE, type EffectSettings } from '../../ranking/frameEffects';
import { resolveFrameGradient } from '../../ranking/rankFrameStyle';

/**
 * Ein Rauchtest: Jeder Effekt wird einmal wirklich gerendert.
 *
 * Warum das trotz Typprüfung nötig ist: Die Fehler, die bei animierten Views passieren,
 * sind keine Typfehler. Ein Stilwert, den der Native-Treiber nicht kann, eine
 * Verlaufs-Kennung, die es zweimal gibt, eine Interpolation mit unsortierter Eingabe -
 * alles das übersteht `tsc` klaglos und fliegt erst auf dem Gerät auf. Und auf das Gerät
 * komme ich nicht, chris müsste jedes Mal neu bauen.
 *
 * Was der Test NICHT kann: sagen, ob es gut aussieht. Dafür ist der Werkstatt-Bildschirm da.
 */

const COLORS = resolveFrameGradient('CHALLENGER');

function renderEffect(effectId: (typeof FRAME_EFFECT_IDS)[number], settings: EffectSettings) {
  let renderer: ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(
      <FrameEffectLayer effectId={effectId} settings={settings} colors={COLORS} />
    );
  });
  return renderer!;
}

describe('FrameEffectLayer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const settings: EffectSettings = { intensity: 0.6, speed: 0.5, size: 96 };

  it.each(FRAME_EFFECT_IDS)('rendert "%s" ohne Fehler', (effectId) => {
    const renderer = renderEffect(effectId, settings);

    // Der Versatz der einzelnen Teilchen läuft über setTimeout - erst danach starten die
    // Schleifen wirklich. Genau dort würde ein kaputter Stilwert auffliegen.
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(renderer.toJSON()).toBeDefined();
    act(() => {
      renderer.unmount();
    });
  });

  it.each(FRAME_EFFECT_IDS)('rendert "%s" auch an den Reglergrenzen', (effectId) => {
    for (const extreme of [
      { intensity: 0, speed: 0, size: SIZE_RANGE.min },
      { intensity: 1, speed: 1, size: SIZE_RANGE.max },
    ]) {
      const renderer = renderEffect(effectId, extreme);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(renderer.toJSON()).toBeDefined();
      act(() => {
        renderer.unmount();
      });
    }
  });

  it('zeichnet bei "Ohne" tatsächlich nichts', () => {
    // Der Vergleichsmaßstab im Werkstatt-Bildschirm muss wirklich leer sein, sonst
    // vergleicht man gegen einen unsichtbaren Rest.
    const renderer = renderEffect('none', settings);
    expect(renderer.toJSON()).toBeNull();
  });

  it('sammelt bei wiederholtem Öffnen keine Schleifen an', () => {
    // Ohne sauberes Aufräumen liefen die Animationen weiter, nachdem der Bildschirm
    // verlassen wurde - bei sieben Effekten in der Auswahl summiert sich das über eine
    // Sitzung zu spürbarem Ruckeln.
    //
    // Geprüft wird bewusst NICHT "null wartende Zeitgeber": React Natives Animationen
    // halten in der Testumgebung selbst welche (der Native-Treiber ist dort nur
    // nachgebildet, es läuft der JS-Treiber). Aussagekräftig ist stattdessen, dass die
    // Zahl bei wiederholtem Auf- und Zumachen nicht *wächst*.
    const openAndClose = () => {
      const renderer = renderEffect('aura', { intensity: 1, speed: 1, size: 120 });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      act(() => {
        renderer.unmount();
      });
    };

    openAndClose();
    const afterFirst = jest.getTimerCount();
    for (let i = 0; i < 5; i++) openAndClose();

    expect(jest.getTimerCount()).toBeLessThanOrEqual(afterFirst);
  });
});
