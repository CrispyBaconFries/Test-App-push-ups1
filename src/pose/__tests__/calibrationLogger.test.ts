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

import type { DiscardedRep, RepResult, RepTrace } from '../formAnalysis';
import {
  clearCalibrationLog,
  countCalibrationEntries,
  loadCalibrationLog,
  recordCalibrationDiscard,
  recordCalibrationRep,
  recordCalibrationTrace,
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
  maxElbowFlareDeg: 62,
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

/** Ein Verlauf mit `frames` Frames, alle Reihen index-gleich. */
function trace(frames: number, outcome: RepTrace['outcome'] = 'rep'): RepTrace {
  const row = <T,>(value: (i: number) => T): T[] => Array.from({ length: frames }, (_, i) => value(i));
  return {
    outcome,
    t: row((i) => i * 33),
    elbow: row((i) => 170 - i),
    hip: row(() => 165),
    flare: row(() => 60),
    neck: row(() => 130),
    horiz: row(() => 80),
    sx: row(() => 500),
    sy: row((i) => 400 + i),
    wx: row(() => 700),
    wy: row(() => 700),
  };
}

describe('Bewegungsverläufe', () => {
  it('dünnt lange Bewegungen aus, behält aber Anfang und Ende', async () => {
    // Ein Verlauf ist rund 40-mal so groß wie die Zusammenfassung derselben Bewegung, und
    // der Teilen-Dialog von Android bricht bei zu großen Übergaben still ab. Ein Log, der
    // sich nicht mehr verschicken lässt, ist wertlos.
    await recordCalibrationTrace(trace(300), 'training');
    const log = await loadCalibrationLog();
    const stored = log[0] as RepTrace;

    expect(stored.t.length).toBeLessThanOrEqual(60);
    expect(stored.t[0]).toBe(0);
    // Der letzte Frame bleibt unabhängig vom Raster - sonst fehlt der Abschluss der Bewegung.
    expect(stored.t[stored.t.length - 1]).toBe(299 * 33);
    // Alle Reihen müssen weiterhin zueinander passen, sonst ist der Verlauf wertlos.
    for (const row of [stored.elbow, stored.hip, stored.flare, stored.sy, stored.wy]) {
      expect(row.length).toBe(stored.t.length);
    }
  });

  it('zeichnet höchstens 30 Bewegungen auf und hört dann still auf', async () => {
    for (let i = 0; i < 35; i++) await recordCalibrationTrace(trace(10), 'training');
    const log = await loadCalibrationLog();

    expect(log.filter((e) => e.kind === 'trace')).toHaveLength(30);
  });

  it('lässt die Zusammenfassungen von der Obergrenze unberührt', async () => {
    // Die kosten fast nichts, und die Auswertung der Schwellwerte hängt an ihnen.
    for (let i = 0; i < 35; i++) await recordCalibrationTrace(trace(10), 'training');
    for (let i = 0; i < 5; i++) await recordCalibrationRep(rep(i), 'training');
    const log = await loadCalibrationLog();

    expect(log.filter((e) => e.kind === 'rep')).toHaveLength(5);
  });
});
