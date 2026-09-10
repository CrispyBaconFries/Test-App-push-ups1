import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ErrorBoundary } from '../ErrorBoundary';

const mockRecordError = jest.fn<Promise<void>, [unknown, string, { fatal?: boolean }?]>(async () => undefined);
jest.mock('../../diagnostics/errorLog', () => ({
  recordError: (error: unknown, context: string, options?: { fatal?: boolean }) =>
    mockRecordError(error, context, options),
  shareErrorLog: jest.fn(async () => 1),
}));

/**
 * Ein Test, der wirklich einen Fehler auslöst.
 *
 * Ohne das ist eine Fehlergrenze der klassische Fall von Code, der nie läuft: Sie sieht im
 * Editor richtig aus, greift aber im Ernstfall nicht - und bemerkt wird das genau dann,
 * wenn man sie gebraucht hätte.
 */

function Boom({ explode }: { explode: boolean }): React.ReactElement {
  if (explode) throw new Error('Absicht: Testfehler');
  return <Text>alles in Ordnung</Text>;
}

function texts(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map((node: ReactTestInstance) =>
      Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? '')
    )
    .join('\n');
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockRecordError.mockClear();
    // React schreibt einen gefangenen Fehler zusätzlich auf die Konsole. Im Test ist das
    // erwartetes Rauschen und würde sonst nach einem echten Problem aussehen.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it('zeigt die Kinder, solange nichts schiefgeht', () => {
    let renderer: ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <ErrorBoundary>
          <Boom explode={false} />
        </ErrorBoundary>
      );
    });

    expect(texts(renderer!)).toContain('alles in Ordnung');
  });

  it('fängt einen Fehler beim Zeichnen und zeigt ihn lesbar an', () => {
    let renderer: ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <ErrorBoundary>
          <Boom explode />
        </ErrorBoundary>
      );
    });

    const shown = texts(renderer!);
    expect(shown).toContain('Da ist etwas schiefgelaufen');
    // Die Meldung selbst muss dastehen - ohne sie ist der Bildschirm nur ein hübscheres
    // weißes Nichts.
    expect(shown).toContain('Absicht: Testfehler');
    expect(shown).toContain('Fehlerbericht teilen');
  });

  it('zeichnet den Fehler auf, damit er teilbar wird', () => {
    act(() => {
      TestRenderer.create(
        <ErrorBoundary>
          <Boom explode />
        </ErrorBoundary>
      );
    });

    expect(mockRecordError).toHaveBeenCalledTimes(1);
    const [error, context, options] = mockRecordError.mock.calls[0];
    expect((error as Error).message).toBe('Absicht: Testfehler');
    expect(context).toContain('Anzeige');
    expect(options?.fatal).toBe(true);
  });

  it('beruhigt, dass der Trainingsverlauf nicht betroffen ist', () => {
    // Der erste Gedanke bei einem Absturz ist "sind meine Daten weg?". Die Antwort gehört
    // auf den Bildschirm, nicht in eine Nachricht an mich.
    let renderer: ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <ErrorBoundary>
          <Boom explode />
        </ErrorBoundary>
      );
    });

    expect(texts(renderer!)).toContain('Trainingsverlauf');
  });
});
