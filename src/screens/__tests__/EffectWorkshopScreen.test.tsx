import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EffectWorkshopScreen } from '../EffectWorkshopScreen';
import { FrameEffectLayer } from '../../components/FrameEffectLayer';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import {
  DEFAULT_EFFECT_SETTINGS,
  DEFAULT_RING_WIDTH,
  FRAME_EFFECTS,
  describeSelection,
} from '../../ranking/frameEffects';

/**
 * Rauchtest für die Effekt-Werkstatt.
 *
 * Zwei Dinge sichert dieser Test ab, und beide kosten sonst einen kompletten
 * Release-Build, bis sie auffallen:
 *
 * - Der Bildschirm baut überhaupt auf, ohne abzustürzen.
 * - Es läuft **genau eine** Effektebene. Das ist keine Feinheit, sondern der Grund für
 *   den Umbau: Vorher lief pro Effekt eine eigene Vorschau, und mit dem geplanten
 *   Katalog von über dreißig Effekten wären das weit über hundert gleichzeitige
 *   Animationen gewesen. Eine Kachel mit Vorschau wieder einzubauen ist eine
 *   naheliegende, gut gemeinte Änderung - deshalb steht die Regel hier als Test und
 *   nicht nur als Kommentar.
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

  it('bietet jeden Effekt zur Auswahl an, ohne abzustürzen', () => {
    const renderer = renderScreen();
    const text = visibleText(renderer);

    for (const effect of FRAME_EFFECTS) {
      expect(text).toContain(effect.label);
    }

    act(() => renderer.unmount());
  });

  it('lässt immer nur den gewählten Effekt laufen', () => {
    const renderer = renderScreen();

    expect(renderer.root.findAllByType(FrameEffectLayer)).toHaveLength(1);

    act(() => renderer.unmount());
  });

  it('wechselt beim Antippen den gezeigten Effekt und baut die Vorschau neu auf', () => {
    const renderer = renderScreen();

    // "Ohne" ist der erste Eintrag und zeichnet nichts - damit lässt sich am Verschwinden
    // der Effektebene ablesen, dass die Auswahl wirklich durchschlägt.
    const blitze = FRAME_EFFECTS.find((effect) => effect.id === 'lightning')!;
    const [chip] = renderer.root.findAll(
      (node: ReactTestInstance) => node.props.label === blitze.label && typeof node.props.onPress === 'function'
    );
    expect(chip).toBeDefined();
    act(() => (chip.props.onPress as () => void)());
    act(() => jest.advanceTimersByTime(3000));

    const layers = renderer.root.findAllByType(FrameEffectLayer);
    expect(visibleText(renderer)).toContain(blitze.description);
    expect(layers).toHaveLength(1);
    expect(layers[0].props.effectId).toBe('lightning');

    act(() => renderer.unmount());
  });

  it('zeigt die Auswahl als eine Zeile zum Weitergeben', () => {
    // Das ist der eigentliche Zweck des Bildschirms - ohne diese Zeile bleibt es beim
    // "mach's etwas cooler", und ich rate wieder.
    const renderer = renderScreen();

    expect(visibleText(renderer)).toContain(
      describeSelection('aura', DEFAULT_EFFECT_SETTINGS, 'Challenger', DEFAULT_RING_WIDTH)
    );

    act(() => renderer.unmount());
  });
});
