import { StartPositionGate, type PostureBaseline, type StartPositionFrame } from '../startPosition';

const FRAME_MS = 33;

/** Spielt Frames im Kameratakt ab und gibt zurück, wann (falls überhaupt) scharf geschaltet wurde. */
function play(
  gate: StartPositionGate,
  frames: Omit<StartPositionFrame, 'timeMs'>[],
  startMs = 0
): { readyAfter: number | null; baseline: PostureBaseline | null } {
  let readyAfter: number | null = null;
  let baseline: PostureBaseline | null = null;
  frames.forEach((frame, i) => {
    if (readyAfter !== null) return;
    const outcome = gate.push({ ...frame, timeMs: startMs + i * FRAME_MS });
    if (outcome.ready) {
      readyAfter = i;
      baseline = outcome.baseline;
    }
  });
  return { readyAfter, baseline };
}

/** Eine ruhig gehaltene, saubere Stützposition. */
function hold(count: number, elbowAngleDeg = 172, hipStraightnessDeg: number | null = 178, neckAngleDeg: number | null = 150) {
  return Array.from({ length: count }, () => ({ elbowAngleDeg, hipStraightnessDeg, neckAngleDeg }));
}

describe('StartPositionGate', () => {
  it('schaltet nach der geforderten Haltezeit scharf und misst die Grundhaltung', () => {
    const gate = new StartPositionGate();
    // 2000 ms bei 33 ms/Frame sind gut 60 Frames; die Zeit läuft ab dem *zweiten* Frame.
    const { readyAfter, baseline } = play(gate, hold(80));

    expect(readyAfter).not.toBeNull();
    expect(readyAfter! * FRAME_MS).toBeGreaterThanOrEqual(2000);
    expect(baseline).not.toBeNull();
    expect(baseline!.topElbowAngleDeg).toBe(172);
    expect(baseline!.neutralHipStraightnessDeg).toBe(178);
    expect(baseline!.neutralNeckAngleDeg).toBe(150);
    expect(baseline!.elbowJitterDeg).toBe(0);
    expect(baseline!.heldMs).toBeGreaterThanOrEqual(2000);
  });

  it('schaltet NICHT scharf, wenn die Position nur langsam durchlaufen wird', () => {
    // Das ist der eigentliche Kern: Der Weg in den Stütz führt durch die Startposition
    // *hindurch*. Alle Einzelbedingungen (Arme gestreckt, Körper im Stütz) sind dabei
    // erfüllt - nur eben nie zwei Sekunden lang am selben Fleck.
    const gate = new StartPositionGate();
    const slowDescent = Array.from({ length: 120 }, (_, i) => ({
      elbowAngleDeg: 178 - i * 0.15, // 178° -> 160° über rund vier Sekunden
      hipStraightnessDeg: 178,
      neckAngleDeg: 150,
    }));

    expect(play(gate, slowDescent).readyAfter).toBeNull();
  });

  it('verwirft die bisherige Haltezeit, wenn die Arme zwischendurch gebeugt werden', () => {
    const gate = new StartPositionGate();
    const frames = [...hold(40), ...hold(3, 120), ...hold(30)];

    // 40 + 30 Frames wären zusammen genug - aber eben nicht am Stück.
    expect(play(gate, frames).readyAfter).toBeNull();
    expect(gate.getStatus()).toBe('HOLDING');
  });

  it('verwirft die bisherige Haltezeit, wenn die Pose zwischendurch verloren geht', () => {
    const gate = new StartPositionGate();
    const frames = [
      ...hold(40),
      ...Array.from({ length: 3 }, () => ({ elbowAngleDeg: null, hipStraightnessDeg: null, neckAngleDeg: null })),
      ...hold(30),
    ];

    expect(play(gate, frames).readyAfter).toBeNull();
  });

  it('nennt den Grund, warum die Startposition nicht angenommen wird', () => {
    const gate = new StartPositionGate();

    gate.push({ timeMs: 0, elbowAngleDeg: null, hipStraightnessDeg: null, neckAngleDeg: null });
    expect(gate.getStatus()).toBe('NO_POSE');

    gate.push({ timeMs: FRAME_MS, elbowAngleDeg: 120, hipStraightnessDeg: 178, neckAngleDeg: 150 });
    expect(gate.getStatus()).toBe('ARMS_BENT');

    // Kniend oder auf dem Weg nach unten: Arme gestreckt, Körper aber abgeknickt.
    gate.push({ timeMs: 2 * FRAME_MS, elbowAngleDeg: 172, hipStraightnessDeg: 70, neckAngleDeg: 150 });
    expect(gate.getStatus()).toBe('NOT_A_PLANK');

    gate.push({ timeMs: 3 * FRAME_MS, elbowAngleDeg: 172, hipStraightnessDeg: 178, neckAngleDeg: 150 });
    expect(gate.getStatus()).toBe('MOVING');

    gate.push({ timeMs: 4 * FRAME_MS, elbowAngleDeg: 172, hipStraightnessDeg: 178, neckAngleDeg: 150 });
    expect(gate.getStatus()).toBe('HOLDING');
  });

  it('lässt einen nicht messbaren Unterkörper den Start nicht blockieren', () => {
    // Ein tief vor der Person stehendes Handy hat den Unterkörper oft gar nicht im Bild.
    // Daran darf der Start nicht scheitern - die Hüftbedingung entfällt dann einfach.
    const gate = new StartPositionGate();
    const { readyAfter, baseline } = play(gate, hold(80, 172, null, null));

    expect(readyAfter).not.toBeNull();
    expect(baseline!.neutralHipStraightnessDeg).toBeNull();
    expect(baseline!.neutralNeckAngleDeg).toBeNull();
    expect(baseline!.hipJitterDeg).toBeNull();
  });

  it('toleriert kleines Zittern, ohne die ganze Haltezeit zu verwerfen', () => {
    const gate = new StartPositionGate();
    // ±2° Rauschen liegt innerhalb der Toleranz von 8° und darf nicht bei jedem Frame
    // von vorn beginnen lassen - sonst könnte niemand mit echtem Tracking je starten.
    const jittery = Array.from({ length: 80 }, (_, i) => ({
      elbowAngleDeg: 172 + (i % 3) - 1,
      hipStraightnessDeg: 178,
      neckAngleDeg: 150,
    }));

    expect(play(gate, jittery).readyAfter).not.toBeNull();
  });

  it('schaltet als Notbremse auch ohne gültige Haltung scharf, aber ohne Grundhaltung', () => {
    // Ein Bildschirm, der unter ungünstigen Bedingungen nie zu zählen anfängt, ist
    // schlimmer als eine gelegentliche Fehlzählung.
    const gate = new StartPositionGate({ timeoutMs: 5000 });
    const nothingUseful = Array.from({ length: 200 }, () => ({
      elbowAngleDeg: null,
      hipStraightnessDeg: null,
      neckAngleDeg: null,
    }));

    const { readyAfter, baseline } = play(gate, nothingUseful);
    expect(readyAfter).not.toBeNull();
    expect(readyAfter! * FRAME_MS).toBeGreaterThanOrEqual(5000);
    expect(baseline).toBeNull();
  });

  it('meldet den Fortschritt, damit die Anzeige einen Balken füllen kann', () => {
    const gate = new StartPositionGate();
    let last = gate.push({ timeMs: 0, elbowAngleDeg: 172, hipStraightnessDeg: 178, neckAngleDeg: 150 });
    for (let i = 1; i <= 30; i++) {
      last = gate.push({ timeMs: i * FRAME_MS, elbowAngleDeg: 172, hipStraightnessDeg: 178, neckAngleDeg: 150 });
    }

    expect(last.ready).toBe(false);
    if (last.ready) throw new Error('unerreichbar');
    expect(last.progress.requiredMs).toBe(2000);
    expect(last.progress.heldMs).toBe(30 * FRAME_MS);
    expect(last.progress.status).toBe('HOLDING');
  });

  it('braucht genug Frames, nicht nur genug Zeit', () => {
    // Drei Frames im Abstand von je einer Sekunde ergeben rechnerisch zwei Sekunden
    // Haltezeit - dazwischen könnte aber alles passiert sein.
    const gate = new StartPositionGate();
    const outcome = [0, 1000, 2000, 3000].map((timeMs) =>
      gate.push({ timeMs, elbowAngleDeg: 172, hipStraightnessDeg: 178, neckAngleDeg: 150 })
    );

    expect(outcome.every((o) => !o.ready)).toBe(true);
  });
});
