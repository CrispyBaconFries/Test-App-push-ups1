import { clearErrorLog, countErrors, formatErrorReport, loadErrorLog, recordError, type ErrorLogEntry } from '../errorLog';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        mockStore.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        mockStore.delete(key);
      }),
    },
  };
});

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));

/**
 * Die Aufzeichnung ist die einzige Verbindung zwischen einem Absturz auf chris' Handy und
 * meinem Schreibtisch: kein Metro, kein Logcat, ein einziger Release-Build (CLAUDE.md).
 * Verliert sie einen Eintrag oder wirft sie selbst, ist der Fehler weg.
 */

describe('errorLog', () => {
  beforeEach(async () => {
    await clearErrorLog();
  });

  it('hält Meldung, Aufrufliste und Umstände fest', async () => {
    const error = new Error('Etwas ist kaputt');
    await recordError(error, 'Anzeige · WorkoutScreen', { fatal: true });

    const [entry] = await loadErrorLog();
    expect(entry.message).toBe('Etwas ist kaputt');
    expect(entry.stack).toContain('Error: Etwas ist kaputt');
    expect(entry.context).toBe('Anzeige · WorkoutScreen');
    expect(entry.fatal).toBe(true);
    expect(entry.appVersion).toBe('1.2.3');
  });

  it('verkraftet auch das, was gar kein Error ist', async () => {
    // Ein `throw 'text'` oder eine abgelehnte Zusage mit einem Objekt kommt genauso hier
    // an - und darf die Aufzeichnung nicht mitreißen.
    await recordError('nur ein String', 'global');
    await recordError({ seltsam: true }, 'global');

    const entries = await loadErrorLog();
    expect(entries).toHaveLength(2);
    expect(entries[0].message).toBe('nur ein String');
    expect(entries[0].stack).toBeNull();
  });

  it('verliert keinen Eintrag, wenn Fehler in Serie kommen', async () => {
    // Der eigentliche Grund für die Schreib-Kette: Fehler treten typischerweise mehrfach
    // im selben Frame auf. Ohne Serialisierung läsen alle denselben Stand und der erste -
    // der mit der Ursache - ginge verloren.
    await Promise.all(Array.from({ length: 10 }, (_, i) => recordError(new Error(`Fehler ${i}`), 'global')));

    expect(await countErrors()).toBe(10);
  });

  it('behält beim Überlauf die ÄLTESTEN Einträge', async () => {
    // Bei einem Fehler, der sich bei jedem Frame wiederholt, zeigt der erste die Ursache
    // und alle folgenden nur deren Folgen.
    for (let i = 0; i < 40; i++) {
      await recordError(new Error(`Fehler ${i}`), 'global');
    }

    const entries = await loadErrorLog();
    expect(entries).toHaveLength(25);
    expect(entries[0].message).toBe('Fehler 0');
  });

  it('wirft nie selbst, auch wenn der Speicher streikt', async () => {
    // Diese Funktion läuft in einem Fehlerbehandler. Würde sie werfen, entstünde aus einem
    // behandelbaren Fehler ein Absturz - genau dann, wenn die App sich gerade fängt.
    const storage = jest.requireMock('@react-native-async-storage/async-storage').default;
    storage.setItem.mockRejectedValueOnce(new Error('Speicher voll'));

    await expect(recordError(new Error('egal'), 'global')).resolves.toBeUndefined();
  });
});

describe('formatErrorReport', () => {
  const entry: ErrorLogEntry = {
    recordedAtIso: '2026-09-10T18:30:00.000Z',
    context: 'Anzeige · HomeScreen',
    message: 'undefined is not a function',
    stack: 'Error: undefined is not a function\n    at HomeScreen\n    at RootNavigator',
    fatal: true,
    appVersion: '1.0.0',
    platform: 'android 34',
  };

  it('schreibt einen Bericht, den ein Mensch lesen kann', () => {
    const report = formatErrorReport([entry]);

    expect(report).toContain('[ABSTURZ]');
    expect(report).toContain('2026-09-10 18:30:00');
    expect(report).toContain('Anzeige · HomeScreen');
    expect(report).toContain('undefined is not a function');
    expect(report).toContain('App 1.0.0 · android 34');
  });

  it('sagt es, wenn die Aufzeichnung voll war', () => {
    // Sonst sucht man in einem vollständig aussehenden Bericht nach einem Fehler, der nie
    // aufgezeichnet wurde.
    const many = Array.from({ length: 25 }, () => entry);

    expect(formatErrorReport(many)).toContain('Aufzeichnung voll');
    expect(formatErrorReport([entry])).not.toContain('Aufzeichnung voll');
  });

  it('kommt mit einer leeren Aufzeichnung klar', () => {
    expect(formatErrorReport([])).toBe('Keine Fehler aufgezeichnet.');
  });
});
