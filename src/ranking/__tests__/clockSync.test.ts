import { bestClockOffset, estimateClockOffset, toLocalTime, toServerTime } from '../clockSync';

describe('estimateClockOffset', () => {
  it('is 0 when the client clock exactly matches the server, with instant round trip', () => {
    const { offsetMs, roundTripMs } = estimateClockOffset({
      clientSentAtMs: 1000,
      serverTimeMs: 1000,
      clientReceivedAtMs: 1000,
    });
    expect(offsetMs).toBe(0);
    expect(roundTripMs).toBe(0);
  });

  it('detects a client clock that runs ahead of the server', () => {
    // Client thinks it's 1000, but the server (arriving mid-flight at ~1010) says 990 -
    // the client's clock is 20ms ahead of true time.
    const { offsetMs } = estimateClockOffset({
      clientSentAtMs: 1000,
      serverTimeMs: 990,
      clientReceivedAtMs: 1020,
    });
    expect(offsetMs).toBe(-20);
  });

  it('detects a client clock that runs behind the server', () => {
    const { offsetMs } = estimateClockOffset({
      clientSentAtMs: 1000,
      serverTimeMs: 1030,
      clientReceivedAtMs: 1020,
    });
    expect(offsetMs).toBe(20);
  });
});

describe('bestClockOffset', () => {
  it('throws for an empty sample list', () => {
    expect(() => bestClockOffset([])).toThrow();
  });

  it('picks the sample with the shortest round trip', () => {
    const offset = bestClockOffset([
      // Slow, jittery sample - offset would be misleading if picked.
      { clientSentAtMs: 0, serverTimeMs: 500, clientReceivedAtMs: 400 },
      // Fast, clean sample - this one should win.
      { clientSentAtMs: 1000, serverTimeMs: 1010, clientReceivedAtMs: 1010 },
    ]);
    expect(offset).toBe(estimateClockOffset({ clientSentAtMs: 1000, serverTimeMs: 1010, clientReceivedAtMs: 1010 }).offsetMs);
  });
});

describe('toServerTime / toLocalTime', () => {
  it('round-trips through an offset', () => {
    const offsetMs = 250;
    const local = 1_700_000_000_000;
    expect(toLocalTime(toServerTime(local, offsetMs), offsetMs)).toBe(local);
  });
});
