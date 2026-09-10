/**
 * Speicher-Attrappe mit künstlicher Verzögerung: Nur so wird das Lese-Ändern-Schreib-
 * Rennen sichtbar, gegen das `append` absichert. Ohne Verzögerung liefe jeder Aufruf
 * durch, bevor der nächste beginnt, und der Test würde auch mit kaputtem Code bestehen.
 */
// Jest erlaubt in einer `jest.mock`-Fabrik nur Variablen mit `mock`-Präfix - daher die
// Namen. Ohne das bricht der Test schon beim Übersetzen ab.
const mockStore = new Map<string, string>();
const mockTick = () => new Promise((resolve) => setTimeout(resolve, 1));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => {
      await mockTick();
      return mockStore.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      await mockTick();
      mockStore.set(key, value);
    },
    removeItem: async (key: string) => {
      await mockTick();
      mockStore.delete(key);
    },
  },
}));

import type { DiscardedRep, RepResult } from '../formAnalysis';
import {
  clearCalibrationLog,
  countCalibrationEntries,
  recordCalibrationDiscard,
  recordCalibrationRep,
} from '../calibrationLogger';

beforeEach(() => {
  mockStore.clear();
});

function rep(index: number): RepResult {
  return {
    index,
    formScore: 90,
    issues: [],
    minElbowAngleDeg: 95,
    minHipStraightnessDeg: 160,
    maxElbowFlareDeg: 55,
    minNeckAngleDeg: 130,
    durationMs: 1500,
    elbowRangeDeg: 60,
  };
}

const discarded: DiscardedRep = {
  reason: 'TOO_SHORT',
  durationMs: 300,
  trackedFrames: 5,
  untrackedFrames: 0,
  outOfFrameFrames: 0,
  minElbowAngleDeg: 130,
  maxElbowAngleDeg: 150,
};

describe('calibrationLogger', () => {
  it('verliert keinen Eintrag, wenn mehrere gleichzeitig geschrieben werden', async () => {
    // Genau der Fall aus der App: Die Bildschirme rufen bewusst ohne `await` auf, mitten
    // im Kamera-Pfad. Ohne Serialisierung läsen alle denselben Stand und es überlebte nur
    // der letzte Schreibvorgang.
    await Promise.all([
      recordCalibrationRep(rep(0), 'training'),
      recordCalibrationRep(rep(1), 'training'),
      recordCalibrationRep(rep(2), 'training'),
      recordCalibrationDiscard(discarded, 'training'),
    ]);

    expect(await countCalibrationEntries()).toBe(4);
  });

  it('behält die Reihenfolge bei, in der aufgerufen wurde', async () => {
    await Promise.all([
      recordCalibrationRep(rep(0), 'training'),
      recordCalibrationRep(rep(1), 'training'),
      recordCalibrationRep(rep(2), 'boss'),
    ]);

    const raw = mockStore.get('@pushup/devCalibrationLog')!;
    const entries = JSON.parse(raw) as { index: number; kind: string; source: string }[];
    expect(entries.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(entries[2]!.source).toBe('boss');
  });

  it('unterscheidet gezählte von verworfenen Bewegungen', async () => {
    await recordCalibrationRep(rep(0), 'training');
    await recordCalibrationDiscard(discarded, 'training');

    const entries = JSON.parse(mockStore.get('@pushup/devCalibrationLog')!) as { kind: string }[];
    expect(entries.map((e) => e.kind)).toEqual(['rep', 'discarded']);
  });

  it('schreibt nach einem Fehlschlag weiter, statt die Kette abreißen zu lassen', async () => {
    const asyncStorage = require('@react-native-async-storage/async-storage').default;
    const original = asyncStorage.setItem;
    asyncStorage.setItem = async () => {
      throw new Error('Speicher voll');
    };
    await expect(recordCalibrationRep(rep(0), 'training')).rejects.toThrow('Speicher voll');
    asyncStorage.setItem = original;

    await recordCalibrationRep(rep(1), 'training');
    expect(await countCalibrationEntries()).toBe(1);
  });

  it('löscht alles auf Wunsch', async () => {
    await recordCalibrationRep(rep(0), 'training');
    await clearCalibrationLog();
    expect(await countCalibrationEntries()).toBe(0);
  });
});
