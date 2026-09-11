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

type Measured = Omit<StartPositionFrame, 'timeMs'>;

/** Ein Frame mit sinnvollen Vorgaben für einen sauberen Stütz. */
function frame(overrides: Partial<Measured> = {}): Measured {
  return {
    elbowAngleDeg: 172,
    hipStraightnessDeg: 178,
    neckAngleDeg: 150,
    elbowFlareDeg: 75,
    torsoHorizontalRatio: 0.9,
    ...overrides,
  };
}

/** Eine ruhig gehaltene, saubere Stützposition. */
function hold(count: number, overrides: Partial<Measured> = {}): Measured[] {
  return Array.from({ length: count }, () => frame(overrides));
}

/**
 * Aufrecht stehen, Arme hängen am Körper.
 *
 * Die Zahlen sind der springende Punkt dieser Prüfung: Arme *sind* gestreckt, Körper
 * *ist* gerade - genau wie im Stütz. Nur der Oberarm liegt am Rumpf an statt quer dazu.
 */
function standing(count: number): Measured[] {
  return hold(count, { elbowAngleDeg: 175, hipStraightnessDeg: 178, elbowFlareDeg: 12, torsoHorizontalRatio: 0.08 });
}

/** Gar keine verwertbare Pose. */
function noPose(count: number): Measured[] {
  return hold(count, {
    elbowAngleDeg: null,
    hipStraightnessDeg: null,
    neckAngleDeg: null,
    elbowFlareDeg: null,
    torsoHorizontalRatio: null,
  });
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
    expect(baseline!.neutralElbowFlareDeg).toBe(75);
    expect(baseline!.torsoHorizontalRatio).toBe(0.9);
    expect(baseline!.heldMs).toBeGreaterThanOrEqual(2000);
  });

  it('schaltet NICHT scharf, wenn die Position nur langsam durchlaufen wird', () => {
    // Das ist der eigentliche Kern: Der Weg in den Stütz führt durch die Startposition
    // *hindurch*. Alle Einzelbedingungen (Arme gestreckt, Körper im Stütz) sind dabei
    // erfüllt - nur eben nie zwei Sekunden lang am selben Fleck.
    const gate = new StartPositionGate();
    const slowDescent = Array.from({ length: 120 }, (_, i) =>
      frame({ elbowAngleDeg: 178 - i * 0.15 }) // 178° -> 160° über rund vier Sekunden
    );

    expect(play(gate, slowDescent).readyAfter).toBeNull();
  });

  it('verwirft die bisherige Haltezeit, wenn die Arme zwischendurch gebeugt werden', () => {
    const gate = new StartPositionGate();
    // 10 Frames sind ein Drittel einer Sekunde - lang genug, dass es eine Bewegung ist
    // und kein Ausrutscher der Erkennung.
    const frames = [...hold(40), ...hold(10, { elbowAngleDeg: 120 }), ...hold(30)];

    // 40 + 30 Frames wären zusammen genug - aber eben nicht am Stück.
    expect(play(gate, frames).readyAfter).toBeNull();
    expect(gate.getStatus()).toBe('HOLDING');
  });

  it('verwirft die bisherige Haltezeit, wenn die Pose länger verloren geht', () => {
    const gate = new StartPositionGate();
    // 20 Frames ohne Pose sind zwei Drittel einer Sekunde. So lange verschwindet niemand
    // aus dem Bild, ohne sich bewegt zu haben.
    const frames = [...hold(40), ...noPose(20), ...hold(30)];

    expect(play(gate, frames).readyAfter).toBeNull();
  });

  it('überlebt einen kurzen Aussetzer der Erkennung', () => {
    // Der Fall, an dem chris hängengeblieben ist: MediaPipe verliert die Pose für ein
    // paar Frames, obwohl er unbewegt im Stütz liegt. Vorher hat das die komplette
    // Haltezeit gelöscht - "man kommt nie zu den Liegestützen".
    const gate = new StartPositionGate();
    const frames = [...hold(40), ...noPose(3), ...hold(30)];

    expect(play(gate, frames).readyAfter).not.toBeNull();
  });

  it('überlebt einzelne komplett verrutschte Frames', () => {
    // Ein Ellbogenwinkel von 120°, wo eben noch 172° stand, ist keine Bewegung, sondern
    // ein Tracking-Fehler - dieselben Ausreißer, die in `docs/messdaten/` einen
    // Ellbogen-Flare von 170° melden. Alle 15 Frames einer davon darf nicht heißen, dass
    // die Kalibrierung nie fertig wird.
    const gate = new StartPositionGate();
    const glitchy = Array.from({ length: 90 }, (_, i) =>
      frame(i % 15 === 14 ? { elbowAngleDeg: 120 } : {})
    );

    expect(play(gate, glitchy).readyAfter).not.toBeNull();
  });

  it('lässt echtes Kamerarauschen die Haltezeit nicht auffressen', () => {
    // Der Kern von chris' Rückmeldung vom 10.09.2026: "Jegliche minimale Änderung und
    // Rauschen des Algorithmus startet die Kalibrierung neu." Rauschen von ±6° am
    // Ellbogen und ±10° an der Hüfte ist auf dem Gerät normal - die alte Prüfung über die
    // Extremwert-Spannweite hat daran zuverlässig scheitern lassen.
    const gate = new StartPositionGate();
    const noisy = Array.from({ length: 90 }, (_, i) =>
      frame({
        elbowAngleDeg: 172 + 6 * Math.sin(i * 1.7),
        hipStraightnessDeg: 170 + 10 * Math.sin(i * 2.3),
      })
    );

    expect(play(gate, noisy).readyAfter).not.toBeNull();
  });

  it('schenkt überbrückte Aussetzer nicht als Haltezeit', () => {
    // Ein überbrückter Ausfall darf die Haltezeit nicht *verlängern* - sonst wäre "eine
    // Sekunde nicht erkannt" eine Sekunde geschenkt.
    const gate = new StartPositionGate();
    let last = gate.push({ ...frame(), timeMs: 0 });
    for (let i = 1; i <= 10; i++) last = gate.push({ ...frame(), timeMs: i * FRAME_MS });
    // 330 ms sind gehalten. Jetzt ein Sprung von 400 ms mit nur einem Frame am Ende.
    last = gate.push({ ...frame(), timeMs: 10 * FRAME_MS + 400 });

    expect(last.ready).toBe(false);
    if (last.ready) throw new Error('unerreichbar');
    // 330 ms + höchstens 150 ms überbrückt, nicht 730 ms.
    expect(last.progress.heldMs).toBeLessThanOrEqual(10 * FRAME_MS + 150);
  });

  it('nennt den Grund, warum die Startposition nicht angenommen wird', () => {
    const gate = new StartPositionGate();

    gate.push({ ...noPose(1)[0], timeMs: 0 });
    expect(gate.getStatus()).toBe('NO_POSE');

    gate.push({ ...frame({ elbowAngleDeg: 120 }), timeMs: FRAME_MS });
    expect(gate.getStatus()).toBe('ARMS_BENT');

    // Kniend oder gebückt: Arme gestreckt, Körper aber abgeknickt.
    gate.push({ ...frame({ hipStraightnessDeg: 70 }), timeMs: 2 * FRAME_MS });
    expect(gate.getStatus()).toBe('NOT_A_PLANK');

    // Aufrecht: alles gestreckt, aber die Arme hängen am Körper.
    gate.push({ ...standing(1)[0], timeMs: 3 * FRAME_MS });
    expect(gate.getStatus()).toBe('STANDING');

    gate.push({ ...frame(), timeMs: 4 * FRAME_MS });
    expect(gate.getStatus()).toBe('MOVING');

    gate.push({ ...frame(), timeMs: 5 * FRAME_MS });
    expect(gate.getStatus()).toBe('HOLDING');
  });

  it('lässt einen nicht messbaren Unterkörper den Start nicht blockieren', () => {
    // Ein tief vor der Person stehendes Handy hat den Unterkörper oft gar nicht im Bild.
    // Daran darf der Start nicht scheitern - die Hüftbedingung entfällt dann einfach.
    const gate = new StartPositionGate();
    const { readyAfter, baseline } = play(
      gate,
      hold(80, { hipStraightnessDeg: null, neckAngleDeg: null, elbowFlareDeg: null, torsoHorizontalRatio: null })
    );

    expect(readyAfter).not.toBeNull();
    expect(baseline!.neutralHipStraightnessDeg).toBeNull();
    expect(baseline!.neutralNeckAngleDeg).toBeNull();
    expect(baseline!.hipJitterDeg).toBeNull();
  });

  it('toleriert kleines Zittern, ohne die ganze Haltezeit zu verwerfen', () => {
    const gate = new StartPositionGate();
    // ±2° Rauschen liegt innerhalb der Toleranz von 8° und darf nicht bei jedem Frame
    // von vorn beginnen lassen - sonst könnte niemand mit echtem Tracking je starten.
    const jittery = Array.from({ length: 80 }, (_, i) => frame({ elbowAngleDeg: 172 + (i % 3) - 1 }));

    expect(play(gate, jittery).readyAfter).not.toBeNull();
  });

  it('schaltet nicht scharf, wenn jemand kniend die Arme nach vorn streckt', () => {
    // Die Gegenrichtung zum Stehen, und derselbe Trick eine Ebene tiefer: Arme gestreckt,
    // Körper (bis zum Knie) gerade - nur zeigt der Oberarm nach vorn statt zum Boden.
    // Gemessen wurden dabei 133-177° (Aufzeichnung vom 10.09.2026, 19:03 Uhr), in der
    // Grundhaltung dagegen 63-67°.
    const gate = new StartPositionGate();

    expect(play(gate, hold(200, { elbowFlareDeg: 174 })).readyAfter).toBeNull();
    expect(gate.getStatus()).toBe('ARMS_NOT_SUPPORTING');
  });

  it('schaltet beim erneuten Einnehmen deutlich schneller scharf', () => {
    // Mitten im Satz ist die volle Messzeit von zwei Sekunden sinnlos: Die Grundhaltung
    // wurde beim ersten Mal gemessen und bleibt gültig, es gibt also nichts mehr zu messen.
    const ersteMal = new StartPositionGate();
    const erneut = new StartPositionGate({}, true);

    const ersterTreffer = play(ersteMal, hold(80)).readyAfter!;
    const zweiterTreffer = play(erneut, hold(80)).readyAfter!;

    expect(zweiterTreffer * FRAME_MS).toBeGreaterThanOrEqual(800);
    expect(zweiterTreffer).toBeLessThan(ersterTreffer / 2);
  });

  it('verlangt auch beim erneuten Einnehmen ein Ankommen, kein Vorbeikommen', () => {
    // Wer sich hinlegt, verharrt nicht 800 ms mit gestreckten Armen im Stütz. Eine
    // zügige Abwärtsbewegung (1°/Frame, also rund 30°/s) schaltet deshalb weiterhin nicht
    // scharf.
    //
    // Bewusst NICHT die 0,15°/Frame aus dem Test oben: In 800 ms sind das 3,6°, und das
    // liegt unter dem Messrauschen (robuste Spannweite rund 10°). Was unter dem Rauschen
    // liegt, trennt keine Statistik - diese Grenze steht bei `reentryHoldMs`, zusammen
    // damit, was die Zählung stattdessen schützt.
    const gate = new StartPositionGate({}, true);
    const runter = Array.from({ length: 40 }, (_, i) => frame({ elbowAngleDeg: 178 - i }));

    expect(play(gate, runter).readyAfter).toBeNull();
  });

  it('nennt im Fortschritt die kürzere Haltezeit, damit die Anzeige nicht lügt', () => {
    const gate = new StartPositionGate({}, true);
    const outcome = gate.push({ ...frame(), timeMs: 0 });

    expect(outcome.ready).toBe(false);
    if (outcome.ready) throw new Error('unerreichbar');
    expect(outcome.progress.requiredMs).toBe(800);
    expect(outcome.progress.reentry).toBe(true);
  });

  it('schaltet als Notbremse auch ohne gültige Haltung scharf, aber ohne Grundhaltung', () => {
    // Ein Bildschirm, der unter ungünstigen Bedingungen nie zu zählen anfängt, ist
    // schlimmer als eine gelegentliche Fehlzählung.
    const gate = new StartPositionGate({ timeoutMs: 5000 });
    const nothingUseful = noPose(200);

    const { readyAfter, baseline } = play(gate, nothingUseful);
    expect(readyAfter).not.toBeNull();
    expect(readyAfter! * FRAME_MS).toBeGreaterThanOrEqual(5000);
    expect(baseline).toBeNull();
  });

  it('meldet den Fortschritt, damit die Anzeige einen Balken füllen kann', () => {
    const gate = new StartPositionGate();
    let last = gate.push({ ...frame(), timeMs: 0 });
    for (let i = 1; i <= 30; i++) {
      last = gate.push({ ...frame(), timeMs: i * FRAME_MS });
    }

    expect(last.ready).toBe(false);
    if (last.ready) throw new Error('unerreichbar');
    expect(last.progress.requiredMs).toBe(2000);
    expect(last.progress.heldMs).toBe(30 * FRAME_MS);
    expect(last.progress.status).toBe('HOLDING');
  });

  it('schaltet NICHT scharf, wenn jemand nur ruhig steht', () => {
    // Der Fall, den chris beschreibt: Er geht vom Handy weg und bleibt stehen. Arme
    // gestreckt, Körper gerade, minutenlang bewegungslos - für eine reine Winkelprüfung
    // ununterscheidbar von einem Stütz. Erst der Arm-zu-Rumpf-Winkel trennt beides.
    const gate = new StartPositionGate();

    expect(play(gate, standing(200)).readyAfter).toBeNull();
    expect(gate.getStatus()).toBe('STANDING');
  });

  it('schaltet auch dann nicht scharf, wenn Stehen direkt in den Stütz übergeht', () => {
    // Erst stehen, dann hinlegen: Die Haltezeit darf nicht schon beim Stehen anlaufen und
    // im Stütz nur noch weiterzählen - sonst wäre der Weg nach unten wieder eine
    // Wiederholung.
    const gate = new StartPositionGate();
    const frames = [...standing(50), ...hold(20)];

    expect(play(gate, frames).readyAfter).toBeNull();
  });

  it('braucht genug Frames, nicht nur genug Zeit', () => {
    // Drei Frames im Abstand von je einer Sekunde ergeben rechnerisch zwei Sekunden
    // Haltezeit - dazwischen könnte aber alles passiert sein.
    const gate = new StartPositionGate();
    const outcome = [0, 1000, 2000, 3000].map((timeMs) => gate.push({ ...frame(), timeMs }));

    expect(outcome.every((o) => !o.ready)).toBe(true);
  });
});
