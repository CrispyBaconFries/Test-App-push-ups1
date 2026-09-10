import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StartPositionOverlay } from '../StartPositionOverlay';
import type { StartPositionProgress } from '../../pose/startPosition';

/**
 * Was hier geprüft wird, ist der Text auf dem Bildschirm - nicht das Aussehen.
 *
 * Der Grund: Wer das liest, liegt zwei Meter entfernt im Stütz und schaut auf ein Handy am
 * Boden. Steht dort der falsche Satz, macht er das Falsche, und im Duell kostet ihn das
 * das Match. Ausprobieren lässt sich das sonst nur zu zweit mit zwei Geräten (siehe
 * `docs/backlog.md`).
 */

// Der Fortschrittsbalken läuft über `Animated.timing`. Ohne feste Zeitgeber startet das
// im Test eine echte Animation, die nach dem Ende des Tests weiterläuft und den Prozess
// mit einem Fehler aus dem Easing-Modul abbricht - ein Werkzeugproblem, kein Fehler in der
// Anzeige.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function progress(overrides: Partial<StartPositionProgress> = {}): StartPositionProgress {
  return { status: 'MOVING', heldMs: 800, requiredMs: 2000, ...overrides };
}

/** Alle sichtbaren Textzeilen des gerenderten Baums, jede als eine Zeichenkette. */
function textsOf(tree: ReactTestRenderer): string[] {
  const lines: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const element = node as { type?: unknown; children?: unknown[] };
    const children = element.children ?? [];
    if (element.type === 'Text') {
      // Zeilen mit eingesetzten Werten bestehen aus mehreren Stücken ("3", " Sekunden
      // ...") - zusammengesetzt ergeben sie den Satz, den chris tatsächlich liest.
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

describe('StartPositionOverlay', () => {
  it('nennt beim Training keine Matchzeit', () => {
    const texts = textsOf(render(<StartPositionOverlay progress={progress()} />));

    expect(texts.some((t) => t.includes('Match'))).toBe(false);
    expect(texts).toContain('Ruhig halten');
  });

  it('zeigt im Duell, wie lange noch Zeit ist, sich hinzulegen', () => {
    const texts = textsOf(render(<StartPositionOverlay progress={progress()} prepareSeconds={7} />));

    expect(texts).toContain('Match startet frühestens in 7 s');
  });

  it('sagt nach Ablauf des Fensters, worauf noch gewartet wird', () => {
    // Bei 0 wäre "startet in 0 s" eine Lüge: Es geht erst los, wenn auch der Gegner liegt.
    const texts = textsOf(render(<StartPositionOverlay progress={progress()} prepareSeconds={0} />));

    expect(texts).toContain('Match startet, sobald ihr beide liegt');
  });

  it('unterscheidet die Gründe, warum noch nicht gezählt wird', () => {
    // Der Hinweis muss zum Zustand passen - "Körper strecken" bei jemandem, der steht,
    // wäre der falsche Rat.
    expect(textsOf(render(<StartPositionOverlay progress={progress({ status: 'STANDING' })} />))).toContain(
      'Du stehst noch – Hände auf den Boden, Schultern über die Hände.'
    );
    expect(textsOf(render(<StartPositionOverlay progress={progress({ status: 'NO_POSE' })} />))).toContain(
      'Stell das Handy weiter weg, sodass Kopf, Schultern und Arme im Bild sind.'
    );
  });
});
