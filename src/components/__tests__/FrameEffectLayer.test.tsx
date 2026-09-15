import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { FrameEffectLayer } from '../FrameEffectLayer';
import {
  DEFAULT_RING_WIDTH,
  FRAME_EFFECT_IDS,
  SIZE_RANGE,
  type EffectSettings,
} from '../../ranking/frameEffects';
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

/**
 * Wie weit der Effekt vom Mittelpunkt aus reicht, in px.
 *
 * Grob gerechnet, und das reicht: je Element die halbe Kantenlänge plus die festen
 * Verschiebungen auf dem Weg dorthin. Drehungen bleiben außen vor - für die Frage
 * "ragt überhaupt irgendetwas über den Avatar hinaus?" macht das keinen Unterschied.
 */
function effectReach(node: unknown, offsetX = 0, offsetY = 0): number {
  if (!node || typeof node !== 'object') return 0;
  const element = node as { props?: { style?: unknown }; children?: unknown[] };
  const style = StyleSheet.flatten(element.props?.style as ViewStyle | ViewStyle[]) ?? {};

  let x = offsetX;
  let y = offsetY;
  for (const step of Array.isArray(style.transform) ? style.transform : []) {
    const move = step as { translateX?: unknown; translateY?: unknown };
    if (typeof move.translateX === 'number') x += move.translateX;
    if (typeof move.translateY === 'number') y += move.translateY;
  }

  const width = typeof style.width === 'number' ? style.width : 0;
  const height = typeof style.height === 'number' ? style.height : 0;
  let reach = Math.max(width, height) / 2 + Math.abs(x) + Math.abs(y);

  for (const child of element.children ?? []) {
    reach = Math.max(reach, effectReach(child, x, y));
  }
  return reach;
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

  it.each(FRAME_EFFECT_IDS.filter((id) => id !== 'none'))(
    'legt bei "%s" jedes Element absolut auf den Mittelpunkt',
    (effectId) => {
      // Der Fehler, den dieser Test fängt: `Layer` zentriert seine Kinder per Flexbox.
      // Ein Kind ohne `position: 'absolute'` landet deshalb *unter* seinen Geschwistern
      // statt über ihnen - aus einem Effekt wird eine Spalte, die den Avatar wegschiebt.
      // Das ist beim ersten Anlauf reihenweise passiert, `tsc` merkt davon nichts, und
      // auf dem Bildschirm sieht man es erst nach einem kompletten Release-Build.
      const renderer = renderEffect(effectId, settings);
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const layer = renderer.toJSON() as { children?: { props?: { style?: unknown } }[] } | null;
      expect(layer).not.toBeNull();
      const children = layer?.children ?? [];
      expect(children.length).toBeGreaterThan(0);
      for (const child of children) {
        const flat = StyleSheet.flatten(child.props?.style as ViewStyle | ViewStyle[]);
        expect(flat?.position).toBe('absolute');
      }

      act(() => {
        renderer.unmount();
      });
    }
  );

  it.each(FRAME_EFFECT_IDS.filter((id) => id !== 'none'))(
    'zeichnet "%s" nicht komplett hinter den Avatar',
    (effectId) => {
      // Der teuerste Fehler dieser Datei, weil er nicht wie ein Fehler aussieht: Die
      // Effektebene liegt HINTER dem Avatar (zIndex -1). Alles, was näher am Mittelpunkt
      // sitzt als der Außenrand des Rang-Rings, ist verdeckt - der Effekt läuft, man
      // sieht ihn nur nie, und es wirkt wie "der Effekt ist kaputt". Genau so waren
      // "Glut", "Strom", "Neon" und "Prisma" beim ersten Anlauf unsichtbar.
      for (const size of [SIZE_RANGE.min, settings.size, SIZE_RANGE.max]) {
        const renderer = renderEffect(effectId, { ...settings, size });
        act(() => {
          jest.advanceTimersByTime(2000);
        });

        const avatarEdge = size / 2 + DEFAULT_RING_WIDTH;
        // Als Objekt verglichen, damit im Fehlerfall Effekt, Größe und die erreichte
        // Weite dastehen - "expected 49 to be greater than 52" allein sagt nicht, welcher
        // Effekt bei welcher Größe.
        const reach = effectReach(renderer.toJSON());
        expect({ effectId, size, reachesBeyondAvatar: reach > avatarEdge }).toEqual({
          effectId,
          size,
          reachesBeyondAvatar: true,
        });

        act(() => {
          renderer.unmount();
        });
      }
    }
  );

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
