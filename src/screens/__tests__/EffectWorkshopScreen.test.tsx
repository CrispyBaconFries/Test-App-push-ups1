import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EffectWorkshopScreen } from '../EffectWorkshopScreen';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { FRAME_EFFECTS, DEFAULT_EFFECT_SETTINGS, describeSelection } from '../../ranking/frameEffects';

/**
 * Rauchtest für die Effekt-Werkstatt.
 *
 * Der Bildschirm zeigt sieben Effekte gleichzeitig, jeder mit mehreren laufenden
 * Animationen - genau die Sorte Aufbau, die auf dem Gerät abstürzt und beim Typprüfen
 * nichts merken lässt. Und weil chris für jeden Blick darauf einen kompletten
 * Release-Build braucht, ist eine Runde "es stürzt ab" teuer.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'EffectWorkshop'>;

function renderScreen() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() } as unknown as Props['navigation'];
  const route = { key: 'test', name: 'EffectWorkshop' } as Props['route'];
  let renderer: ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(<EffectWorkshopScreen navigation={navigation} route={route} />);
  });
  // Der Phasenversatz der Teilchen läuft über setTimeout - erst danach starten die
  // Animationen wirklich.
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  return renderer!;
}

/** Alle sichtbaren Texte des Bildschirms, zusammengefasst. */
function visibleText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map((node: ReactTestInstance) =>
      Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children ?? '')
    )
    .join('\n');
}

describe('EffectWorkshopScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('rendert alle Effekte gleichzeitig, ohne abzustürzen', () => {
    const renderer = renderScreen();
    const text = visibleText(renderer);

    for (const effect of FRAME_EFFECTS) {
      expect(text).toContain(effect.label);
    }

    act(() => renderer.unmount());
  });

  it('zeigt die Auswahl als eine Zeile zum Weitergeben', () => {
    // Das ist der eigentliche Zweck des Bildschirms - ohne diese Zeile bleibt es beim
    // "mach's etwas cooler", und ich rate wieder.
    const renderer = renderScreen();

    expect(visibleText(renderer)).toContain(
      describeSelection('aura', DEFAULT_EFFECT_SETTINGS, 'Challenger')
    );

    act(() => renderer.unmount());
  });
});
