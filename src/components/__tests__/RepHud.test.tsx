import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { RepHud } from '../RepHud';
import { discardNoticeDe } from '../../pose/feedbackText';
import type { LiveFeedback } from '../../pose/formAnalysis';

/**
 * Geprüft wird die **Rangfolge** der Hinweiszeile, nicht das Aussehen.
 *
 * Es gibt in der Zeile nur einen Platz, und vier Dinge konkurrieren darum. Welches davon
 * gewinnt, entscheidet, was jemand macht, der zwei Meter entfernt im Stütz liegt - und
 * genau das lässt sich in der App selbst kaum gezielt herbeiführen.
 */

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function live(overrides: Partial<LiveFeedback> = {}): LiveFeedback {
  return {
    phase: 'down',
    trackingOk: true,
    elbowAngleDeg: 100,
    hipStraightnessDeg: 170,
    cue: 'HIPS_SAGGING',
    startPosition: null,
    framing: null,
    ...overrides,
  };
}

function textsOf(tree: ReactTestRenderer): string[] {
  const lines: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const element = node as { type?: unknown; children?: unknown[] };
    const children = element.children ?? [];
    if (element.type === 'Text') {
      lines.push(children.filter((c): c is string => typeof c === 'string').join(''));
    }
    children.forEach(walk);
  };
  walk(tree.toJSON());
  return lines;
}

function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe('RepHud: welcher Hinweis gewinnt', () => {
  it('sagt "wurde nicht gezählt" statt eines Formhinweises', () => {
    // Wer glaubt, eine Wiederholung gemacht zu haben, muss zuerst erfahren, dass sie
    // nicht zählte - "Hüfte anspannen" beantwortet die Frage nicht, die er gerade hat.
    const texts = textsOf(
      render(<RepHud repCount={3} live={live()} lastRep={null} trackingOk notice="Nicht gezählt – Test" />)
    );

    expect(texts).toContain('Nicht gezählt – Test');
    expect(texts).not.toContain('Hüfte anspannen – Rumpf sackt durch');
  });

  it('lässt dem Bildausschnitt trotzdem den Vortritt', () => {
    // Solange der Arm aus dem Bild ragt, zählt gar nichts - dann ist "nicht gezählt" zwar
    // wahr, aber der Rat, der wirklich hilft, ist ein anderer.
    const texts = textsOf(
      render(
        <RepHud
          repCount={3}
          live={live({ framing: 'ARMS_OUT_OF_FRAME' })}
          lastRep={null}
          trackingOk
          notice="Nicht gezählt – Test"
        />
      )
    );

    expect(texts).toContain('Arme nicht im Bild – es wird gerade nicht gezählt');
    expect(texts).not.toContain('Nicht gezählt – Test');
  });

  it('zeigt ohne Verwurf weiter den Formhinweis', () => {
    const texts = textsOf(render(<RepHud repCount={3} live={live()} lastRep={null} trackingOk />));

    expect(texts).toContain('Hüfte anspannen – Rumpf sackt durch');
  });
});

describe('discardNoticeDe', () => {
  it('erklärt die Gründe, gegen die jemand etwas tun kann', () => {
    expect(discardNoticeDe('TOO_SHALLOW')).toContain('beugen');
    expect(discardNoticeDe('TOO_SHORT')).toContain('zu schnell');
    expect(discardNoticeDe('NOT_A_PLANK')).toContain('strecken');
  });

  it('schweigt zu den Gründen, die keine Handlung nahelegen', () => {
    // "Der Zähler hing" ist unser Problem, nicht seins, und "Pose nicht erkannt" steht
    // bereits an derselben Stelle. Ein Hinweis ohne Handlung trainiert einen nur darauf,
    // die Zeile zu übersehen.
    expect(discardNoticeDe('TOO_LONG')).toBeNull();
    expect(discardNoticeDe('TRACKING_LOST')).toBeNull();
  });
});
