import type { PostureBaseline } from '../startPosition';
import {
  DEFAULT_THRESHOLDS,
  personalThresholds,
  PushUpAnalyzer,
  type DiscardedRep,
  type LiveFeedback,
  type RepResult,
} from '../formAnalysis';
import { buildFrame, mergePoses, type SyntheticFrameParams } from '../testing/poseBuilder';
import { angleAtPoint, pickMoreVisibleSide, type Pose } from '../landmarks';
import { PoseLandmarkIndex } from '../blazePoseLandmarks';

/** ~30 Frames/s - die Bildrate, die die Kamera tatsächlich liefert. */
const FRAME_MS = 33;

/**
 * Realistischer Winkelverlauf einer Wiederholung: 170° -> `bottomDeg` -> 170°, weich
 * (Kosinus) und dicht abgetastet.
 *
 * Warum das sein muss: Seit der Umstellung auf robuste Kennzahlen (09.09.2026) sind die
 * Formwerte Perzentile bzw. der n-kleinste Wert über die Frames einer Wiederholung. Eine
 * Testsequenz aus fünf Stützstellen ist dafür keine gültige Eingabe mehr - "überspringe
 * die zwei größten Ausreißer" wäre dort die Hälfte aller Messwerte. Eine echte
 * Wiederholung dauert rund 1,5 Sekunden und besteht damit bei 30 fps aus etwa 45 Frames.
 */
function repSweep(bottomDeg: number, frames = 45): number[] {
  return Array.from({ length: frames }, (_, i) => {
    const phase = 1 - Math.cos((2 * Math.PI * i) / (frames - 1)); // 0 an den Enden, 2 in der Mitte
    return 170 - ((170 - bottomDeg) * phase) / 2;
  });
}

/**
 * Ein Bewegungsbogen `topDeg` -> `bottomDeg` -> `topDeg`. Anders als `repSweep` ist der
 * obere Umkehrpunkt frei wählbar, um jemanden nachzubilden, der oben nicht ganz
 * durchstreckt.
 */
function partialSweep(topDeg: number, bottomDeg: number, frames: number): number[] {
  return Array.from({ length: frames }, (_, i) => {
    const phase = 1 - Math.cos((2 * Math.PI * i) / (frames - 1));
    return topDeg - ((topDeg - bottomDeg) * phase) / 2;
  });
}

/**
 * Spielt Frames im Kameratakt ab und sammelt alles ein, was dabei herauskommt.
 *
 * Bewusst nicht "gib das Ergebnis des letzten Frames zurück": Eine Wiederholung endet
 * dort, wo der Arm wieder gestreckt ist - bei einem realistischen Bewegungsverlauf also
 * einige Frames vor dem Ende der Sequenz. `reps.length` ist außerdem die Prüfung, die
 * Doppelzählungen auffliegen lässt.
 */
/**
 * Nimmt die Startposition ein: eine ruhig gehaltene obere Position, lang genug, dass die
 * Prüfung in `startPosition.ts` scharf schaltet.
 *
 * Bewusst mit einer sauberen Haltung, auch wenn der Test danach eine schlechte oder halb
 * sichtbare spielt: Geprüft werden soll, was die Zählung aus der Wiederholung macht,
 * nicht ob sie überhaupt anspringt. Gibt den Zeitstempel zurück, bei dem es weitergeht.
 */
const ARMING_FRAMES = 80; // 80 * 33 ms = 2640 ms, deutlich über den geforderten 2000 ms

/**
 * Winkel Ellbogen-Schulter-Hüfte im Stütz. Der Vorgabewert von `buildFrame` (30°) liegt
 * unter der Schwelle, ab der die Startposition den Arm als "unter der Schulter" statt
 * "am Körper hängend" ansieht - für die Startposition muss der Testkörper deshalb einen
 * realistischen Stütz-Wert haben (gemessen wurden 58-101°, siehe docs/messdaten/).
 */
const PLANK_FLARE_DEG = 75;

function armAnalyzer(analyzer: PushUpAnalyzer, startMs: number, topDeg = 172): number {
  for (let i = 0; i < ARMING_FRAMES; i++) {
    analyzer.processFrame(buildFrame({ elbowAngleDeg: topDeg, flareDeg: PLANK_FLARE_DEG }), startMs + i * FRAME_MS);
  }
  return startMs + ARMING_FRAMES * FRAME_MS;
}

function runFrames(
  analyzer: PushUpAnalyzer,
  poses: Pose[],
  startMs = 0
): { reps: RepResult[]; discards: DiscardedRep[]; cues: LiveFeedback['cue'][]; live: LiveFeedback } {
  const firstFrameMs = analyzer.isArmed() ? startMs : armAnalyzer(analyzer, startMs);
  const reps: RepResult[] = [];
  const discards: DiscardedRep[] = [];
  const cues: LiveFeedback['cue'][] = [];
  let last: ReturnType<PushUpAnalyzer['processFrame']> | null = null;
  poses.forEach((pose, i) => {
    last = analyzer.processFrame(pose, firstFrameMs + i * FRAME_MS);
    if (last.completedRep) reps.push(last.completedRep);
    if (last.discardedRep) discards.push(last.discardedRep);
    cues.push(last.live.cue);
  });
  return { reps, discards, cues, live: last!.live };
}

/** Eine Wiederholung mit gleichbleibenden Körperparametern über den ganzen Verlauf. */
function repFrames(bottomDeg: number, params: Omit<SyntheticFrameParams, 'elbowAngleDeg'> = {}): Pose[] {
  return repSweep(bottomDeg).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg, ...params }));
}

describe('PushUpAnalyzer', () => {
  it('counts a clean, deep rep with a perfect form score', () => {
    const analyzer = new PushUpAnalyzer();
    const { reps, discards } = runFrames(analyzer, repFrames(90));

    expect(reps).toHaveLength(1);
    expect(reps[0].formScore).toBe(100);
    expect(reps[0].issues).toEqual([]);
    expect(discards).toEqual([]);
    expect(analyzer.getPhase()).toBe('up');
  });

  it('still counts a shallow rep, but penalizes it for insufficient depth', () => {
    const analyzer = new PushUpAnalyzer();
    const { reps } = runFrames(analyzer, repFrames(120));

    expect(reps).toHaveLength(1);
    expect(reps[0].issues).toContain('INSUFFICIENT_DEPTH');
    // Der n-kleinste Wert landet praktisch auf dem echten Umkehrpunkt (120,25°), weil die
    // Frames dort am dichtesten liegen - genau das ist der Grund, warum die Tiefe nicht
    // über ein Perzentil des ganzen Bewegungsbogens bestimmt wird.
    expect(reps[0].minElbowAngleDeg).toBe(120);
    // 120° sind 15° über der Tiefenschwelle (105°, siehe `goodDepthElbowDeg`), also
    // 15 × 1,5 = 22,5 Punkte Abzug, abgerundet auf 77.
    expect(reps[0].formScore).toBe(77);
  });

  it('discards a small dip near lockout as a false start instead of counting it', () => {
    const analyzer = new PushUpAnalyzer();
    const afterArmingMs = armAnalyzer(analyzer, 0);
    // Sinkt auf 145 (überschreitet die Versuchsschwelle von 140 nie) und streckt sich wieder.
    const falseStart = [170, 160, 150, 145, 150, 165].map((elbowAngleDeg) => buildFrame({ elbowAngleDeg }));
    falseStart.forEach((pose, i) => {
      const { completedRep, discardedRep } = analyzer.processFrame(pose, afterArmingMs + i * FRAME_MS);
      expect(completedRep).toBeNull();
      // Ein Fehlstart ist keine verworfene Wiederholung: Er war nie eine.
      expect(discardedRep).toBeNull();
    });
    expect(analyzer.getPhase()).toBe('up');

    // Eine echte Wiederholung direkt danach muss weiterhin Wiederholung #1 (Index 0) sein -
    // der Fehlstart darf weder einen Index verbraucht noch Zustand hinterlassen haben.
    const { reps } = runFrames(analyzer, repFrames(90), afterArmingMs + falseStart.length * FRAME_MS);
    expect(reps).toHaveLength(1);
    expect(reps[0].index).toBe(0);
  });

  it('flags sagging hips and lowers the score, without also reporting piking', () => {
    const analyzer = new PushUpAnalyzer();
    const { reps } = runFrames(analyzer, repFrames(90, { hipOffsetY: 0.3 }));

    expect(reps).toHaveLength(1);
    expect(reps[0].issues).toContain('HIPS_SAGGING');
    expect(reps[0].issues).not.toContain('HIPS_PIKING');
    expect(reps[0].formScore).toBeLessThan(100);
    expect(reps[0].formScore).toBeGreaterThan(60);
  });

  it('flags flared elbows during the down phase', () => {
    const analyzer = new PushUpAnalyzer();
    const { reps } = runFrames(analyzer, repFrames(90, { flareDeg: 95 }));

    expect(reps[0].issues).toContain('ELBOWS_FLARED');
  });

  it('ignores a single glitch frame, but still catches form that is genuinely off', () => {
    // Der Kern der Umstellung vom 09.09.2026. In den echten Messdaten
    // (docs/messdaten/2026-09-09-reps.json) melden Wiederholungen mit einem
    // Erkennungsaussetzer einen Ellbogen-Flare von im Median 138° - ein Winkel, bei dem
    // der Arm hinter dem Rücken stünde. Vorher entschied genau so ein Frame über die
    // ganze Wiederholung.
    const withGlitch = new PushUpAnalyzer();
    const frames = repFrames(90);
    frames[15] = buildFrame({ elbowAngleDeg: 90, flareDeg: 175, hipOffsetY: 0.9 });
    const glitched = runFrames(withGlitch, frames);

    expect(glitched.reps).toHaveLength(1);
    expect(glitched.reps[0].issues).toEqual([]);
    expect(glitched.reps[0].formScore).toBe(100);

    // Gegenprobe: Dieselbe Abweichung über die ganze Wiederholung muss weiterhin auffallen.
    // Schwächer angesetzt als vorher (175°/0,9), weil ein Flare in dieser Größenordnung
    // seit dem 10.09.2026 gar nicht mehr gezählt wird (`notAPushUpFlareDeg`, 120°). Hier
    // geht es um schlechte Technik, nicht um die Frage, ob es ein Liegestütz war: Diese
    // Werte ergeben gemessene 112° - über der Bewertungsschwelle (80°), unter der
    // Zählschwelle.
    const persistent = new PushUpAnalyzer();
    const flagged = runFrames(persistent, repFrames(90, { flareDeg: 95, hipOffsetY: 0.3 }));
    expect(flagged.reps[0].issues).toContain('ELBOWS_FLARED');
    expect(flagged.reps[0].issues).toContain('HIPS_SAGGING');
  });

  it('discards a rep that completes impossibly fast instead of counting it twice', () => {
    // 6 von 124 echten Wiederholungen lagen unter 500 ms - das sind Doppelzählungen durch
    // Winkelrauschen an der Schwelle, keine Liegestütze.
    const analyzer = new PushUpAnalyzer();
    const fast = repSweep(90, 8).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg }));
    const { reps, discards } = runFrames(analyzer, fast);

    expect(reps).toEqual([]);
    expect(discards.map((d) => d.reason)).toEqual(['TOO_SHORT']);
    expect(analyzer.getDiscardCounts().TOO_SHORT).toBe(1);

    // Kein Index verbraucht: die nächste echte Wiederholung ist weiterhin #1.
    const real = runFrames(analyzer, repFrames(90), 10_000);
    expect(real.reps[0].index).toBe(0);
  });

  it('aborts a rep that hangs, instead of blaming the pause on the athlete', () => {
    // 16 von 124 echten Wiederholungen dauerten über 8 Sekunden, die längste 34 - dort hing
    // der Zähler, während sich jemand hinlegte. Alle Formwerte dieser Wiederholungen waren
    // unbrauchbar (Flare-Median 138°).
    const analyzer = new PushUpAnalyzer();
    const down = repSweep(90).slice(0, 20).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg }));
    runFrames(analyzer, down);
    expect(analyzer.getPhase()).not.toBe('up');

    // Ein Frame 30 Sekunden später - dieselbe Haltung, aber die Wiederholung ist längst tot.
    const late = analyzer.processFrame(buildFrame({ elbowAngleDeg: 90 }), 30_000);
    expect(late.discardedRep?.reason).toBe('TOO_LONG');
    expect(late.completedRep).toBeNull();
    expect(analyzer.getDiscardCounts().TOO_LONG).toBe(1);
  });

  it('discards a rep whose pose was lost for most of its frames', () => {
    const analyzer = new PushUpAnalyzer();
    const sweep = repSweep(90);
    // Die Wiederholung beginnt erst, wenn der Winkel unter 160° fällt (hier ~Frame 6) -
    // die ersten Frames müssen also sichtbar sein, sonst startet sie nie. Danach bricht
    // das Tracking weg und kommt erst kurz vor dem Ende zurück.
    const trackable = (i: number) => i < 12 || i >= 40;
    const patchy = sweep.map((elbowAngleDeg, i) =>
      buildFrame({ elbowAngleDeg, visibility: trackable(i) ? 1 : 0.1 })
    );
    const { reps, discards } = runFrames(analyzer, patchy);

    expect(reps).toEqual([]);
    expect(discards.map((d) => d.reason)).toEqual(['TRACKING_LOST']);
    expect(discards[0].untrackedFrames).toBeGreaterThan(discards[0].trackedFrames);
    expect(analyzer.getDiscardCounts().TRACKING_LOST).toBe(1);
  });

  it('resets the discard counters together with the rest of the state', () => {
    const analyzer = new PushUpAnalyzer();
    runFrames(analyzer, repSweep(90, 8).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg })));
    expect(analyzer.getDiscardCounts().TOO_SHORT).toBe(1);

    analyzer.reset();
    expect(analyzer.getDiscardCounts()).toEqual({
      TOO_SHORT: 0,
      TOO_LONG: 0,
      TRACKING_LOST: 0,
      NOT_A_PLANK: 0,
      TOO_SHALLOW: 0,
      ARMS_NOT_SUPPORTING: 0,
    });
  });

  it('still counts a rep when the pose has no visibility data at all (matches real device data)', () => {
    // react-native-mediapipe's native bridge never actually populates `visibility` on
    // any landmark (see landmarks.ts for the full explanation) - every landmark arrives
    // with visibility simply absent, not a real low number. Build frames the same way
    // instead of going through buildFrame() (which always sets some visibility value)
    // to prove the analyzer still works against what the app actually receives.
    const analyzer = new PushUpAnalyzer();
    const stripVisibility = (pose: Pose) => pose.map(({ visibility: _visibility, ...rest }) => rest);
    const { reps } = runFrames(analyzer, repFrames(90).map(stripVisibility));

    expect(reps).toHaveLength(1);
    expect(reps[0].formScore).toBe(100);
  });

  it('still counts a rep when the feet/hips are out of frame, as long as the arm is visible', () => {
    // Realistic push-up camera setup: phone propped up low in front of the user, so the
    // arm (shoulder/elbow/wrist) is clearly visible but the feet trail off out of frame
    // or too foreshortened for MediaPipe to trust (visibility 0.1, well under the 0.5
    // minimum). Rep counting must not depend on that - only form-quality checks that
    // specifically need hip/ankle/ear should degrade, not the rep count itself.
    const analyzer = new PushUpAnalyzer();
    const { reps } = runFrames(analyzer, repFrames(90, { extendedVisibility: 0.1 }));

    expect(reps).toHaveLength(1);
    // No hip/ankle data was ever available, so those checks must give the benefit of the
    // doubt rather than penalizing the rep for something that couldn't be measured.
    expect(reps[0].issues).toEqual([]);
    expect(analyzer.getPhase()).toBe('up');
  });

  it('reports unmeasurable form metrics as null, not as a non-finite number', () => {
    // Same out-of-frame setup as above. A rep that never saw hip/ankle/ear leaves those
    // measurement series empty, and percentile() reports that as NaN. RepResults are
    // persisted with JSON.stringify (workout history, calibration log), where a
    // non-finite number silently turns into null - so anything reading those numbers back
    // would get a null typed as `number` and quietly compute NaN. Report "not measured"
    // honestly instead.
    const analyzer = new PushUpAnalyzer();
    const rep = runFrames(analyzer, repFrames(90, { extendedVisibility: 0.1 })).reps[0];

    expect(rep.minHipStraightnessDeg).toBeNull();
    expect(rep.maxElbowFlareDeg).toBeNull();
    expect(rep.minNeckAngleDeg).toBeNull();
    // The elbow is always measured - a rep cannot be counted without it.
    expect(Number.isFinite(rep.minElbowAngleDeg)).toBe(true);
    // Survives the persistence round-trip unchanged.
    expect(JSON.parse(JSON.stringify(rep))).toEqual(rep);
  });

  it('reports trackingOk: false and skips analysis when the pose is barely visible', () => {
    const analyzer = new PushUpAnalyzer();
    const { live, completedRep } = analyzer.processFrame(buildFrame({ elbowAngleDeg: 90, visibility: 0.1 }), 0);

    expect(live.trackingOk).toBe(false);
    expect(completedRep).toBeNull();
    expect(analyzer.getPhase()).toBe('up');
  });

  it('does not blame the foot for the back: hip straightness ignores the ankle entirely', () => {
    // Der Fehler, den chris vom ersten Tag an gemeldet hat. Gemessen wurde
    // Schulter-Hüfte-KNÖCHEL. Beim Liegestütz steht der Fuß auf den Zehen, der Knöchel
    // liegt also unter der Körperlinie - der Winkel war damit auch bei kerzengeradem
    // Rücken systematisch zu klein. In den Messdaten vom 09.09.2026 erreichten deshalb
    // 0 von 20 sauber ausgeführten Wiederholungen die Schwelle von 160°.
    const straightBackToesDown = { hipOffsetY: 0, ankleOffsetY: 0.5 };

    // Erst nachweisen, dass dieser Aufbau die alte Messung wirklich hätte scheitern lassen.
    const frame = buildFrame({ elbowAngleDeg: 90, ...straightBackToesDown });
    const at = (index: number) => frame[index]!;
    const overAnkle = angleAtPoint(
      at(PoseLandmarkIndex.rightShoulder),
      at(PoseLandmarkIndex.rightHip),
      at(PoseLandmarkIndex.rightAnkle)
    );
    const overKnee = angleAtPoint(
      at(PoseLandmarkIndex.rightShoulder),
      at(PoseLandmarkIndex.rightHip),
      at(PoseLandmarkIndex.rightKnee)
    );
    expect(overAnkle).toBeLessThan(160); // alte Messung: "Hüfte sackt durch"
    expect(overKnee).toBeCloseTo(180); // neue Messung: kerzengerade, wie es sein soll

    const analyzer = new PushUpAnalyzer();
    const { reps } = runFrames(analyzer, repFrames(90, straightBackToesDown));

    expect(reps).toHaveLength(1);
    expect(reps[0].issues).toEqual([]);
    expect(reps[0].formScore).toBe(100);
  });

  it('tells piking apart from sagging in the live cue, not just in the rep result', () => {
    // liveCue() wertete das Vorzeichen der Abweichung nicht aus und konnte deshalb
    // NIEMALS 'HIPS_PIKING' melden - jede Abweichung hieß "sackt durch", auch ein
    // hochgestrecktes Gesäß.
    const sagging = new PushUpAnalyzer();
    const sagCues = runFrames(sagging, repFrames(90, { hipOffsetY: 0.3 })).cues;
    expect(sagCues).toContain('HIPS_SAGGING');
    expect(sagCues).not.toContain('HIPS_PIKING');

    const piking = new PushUpAnalyzer();
    const pikeRun = runFrames(piking, repFrames(90, { hipOffsetY: -0.3 }));
    expect(pikeRun.cues).toContain('HIPS_PIKING');
    expect(pikeRun.cues).not.toContain('HIPS_SAGGING');
    // Live-Hinweis und Auswertung am Rep-Ende müssen sich einig sein.
    expect(pikeRun.reps[0].issues).toContain('HIPS_PIKING');
  });

  it('accepts the neck angle a person actually has while looking at the camera', () => {
    // Aus 144 echten Wiederholungen kalibriert. Ein neutraler Nacken ergibt in dieser
    // Kameraperspektive keine 180°: Die App bittet die Person, in die Kamera zu schauen,
    // und genau das verkleinert den Winkel Ohr-Schulter-Hüfte. Gemessener Median: 128°,
    // eine saubere Serie lag bei 126-140°. Die alte Schwelle von 140° schlug bei 93 %
    // aller Wiederholungen an.
    const looking = new PushUpAnalyzer();
    const ok = runFrames(looking, repFrames(90, { neckAngleDeg: 126 }));
    expect(ok.reps[0].issues).not.toContain('HEAD_MISALIGNED');

    // Ein wirklich hängender Kopf muss weiterhin auffallen - solche Werte kommen in den
    // Messdaten vor (Minimum 59°) und immer zusammen mit anderen groben Fehlern.
    const dropped = new PushUpAnalyzer();
    const bad = runFrames(dropped, repFrames(90, { neckAngleDeg: 100 }));
    expect(bad.reps[0].issues).toContain('HEAD_MISALIGNED');
    expect(bad.cues).toContain('HEAD_MISALIGNED');
  });

  it('counts every rep of someone who does not fully lock out at the top', () => {
    // Der Fall aus der Aufzeichnung vom 09.09.2026, 19:26 Uhr: chris machte ~14
    // Liegestütze, gezählt wurden 8. Dazu kamen zwei verworfene Abschnitte von je 8
    // Sekunden - bei LÜCKENLOSEM Tracking (0 verlorene Frames). Darin steckten rund sechs
    // echte Wiederholungen: 8 + 6 = 14.
    //
    // Ursache: Der Abschluss hing allein an `elbowUpDeg` (160°). Wer oben nicht ganz
    // durchstreckt, schließt die Wiederholung nie ab - die nächste Abwärtsbewegung galt
    // als Fortsetzung derselben, mehrere Liegestütze verschmolzen zu einem überlangen
    // "Rep", und der flog am Zeitlimit raus.
    const notLockingOut = [
      170,
      ...partialSweep(148, 90, 40),
      ...partialSweep(148, 90, 40),
      ...partialSweep(148, 90, 40),
      170,
    ];
    const poses = notLockingOut.map((elbowAngleDeg) => buildFrame({ elbowAngleDeg }));

    const analyzer = new PushUpAnalyzer();
    const { reps, discards } = runFrames(analyzer, poses);

    expect(reps).toHaveLength(3);
    expect(discards).toEqual([]);
    // Fortlaufend nummeriert, keine Lücken.
    expect(reps.map((r) => r.index)).toEqual([0, 1, 2]);

    // Gegenprobe, dass dieser Testfall wirklich die neue Logik prüft: Ohne die
    // Umkehrpunkt-Erkennung (Toleranz unerreichbar groß) verschmilzt genau dieselbe
    // Eingabe wieder zu deutlich weniger Wiederholungen.
    const withoutReversal = new PushUpAnalyzer({ repReversalToleranceDeg: Infinity });
    const merged = runFrames(withoutReversal, poses);
    expect(merged.reps.length).toBeLessThan(3);
  });

  it('does not split one rep into two on a wobbly ascent', () => {
    // Die Kehrseite der Umkehrpunkt-Erkennung: Ein Zittern beim Hochdrücken darf keine
    // zweite Wiederholung erzeugen. 15° Toleranz liegen deutlich über dem Messrauschen -
    // die aufgezeichneten Winkelverläufe sind glatt.
    const wobbly = repSweep(90).map((angle, i) => (i % 2 === 0 ? angle : angle - 6));
    const analyzer = new PushUpAnalyzer();
    const { reps } = runFrames(analyzer, wobbly.map((elbowAngleDeg) => buildFrame({ elbowAngleDeg })));

    expect(reps).toHaveLength(1);
  });

  it('records the angle range of a discarded rep, so TOO_LONG can be interpreted', () => {
    // Ein `TOO_LONG` ohne Winkelbereich ist nicht deutbar: 90-170° hieße "hier stecken
    // mehrere echte Wiederholungen drin", 150-170° hieße "die Person hat sich nicht
    // bewegt". Genau diese Frage war am 09.09.2026 aus den Daten nicht zu beantworten.
    const analyzer = new PushUpAnalyzer();
    runFrames(analyzer, repSweep(90).slice(0, 20).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg })));
    const late = analyzer.processFrame(buildFrame({ elbowAngleDeg: 90 }), 60_000);

    expect(late.discardedRep?.reason).toBe('TOO_LONG');
    expect(late.discardedRep!.minElbowAngleDeg).toBeLessThan(120);
    expect(late.discardedRep!.maxElbowAngleDeg).toBeGreaterThan(140);
  });

  it('does not count walking into position as a push-up', () => {
    // chris stellt das Handy auf den Boden, geht zwei Schritte zurück und geht dann in
    // die Position - dabei wurden ein bis zwei Wiederholungen gezählt, die keine waren.
    // In der Aufzeichnung vom 09.09.2026, 20:12 Uhr sind das drei Einträge: Hüfte 56°
    // bei Tiefe 117°, Hüfte 88° bei 130°, und beim Aufstehen Hüfte 22° bei 126°. Alle
    // 21 echten Wiederholungen derselben Sitzung liegen bei 158-169° Hüfte.
    const analyzer = new PushUpAnalyzer();
    // hipOffsetY 0.8 ergibt einen Hüftwinkel weit unter der Stütz-Schwelle, und der Arm
    // beugt sich nur bis 120° - keine Tiefe.
    const { reps, discards } = runFrames(analyzer, repFrames(120, { hipOffsetY: 0.8 }));

    expect(reps).toEqual([]);
    expect(discards.map((d) => d.reason)).toEqual(['NOT_A_PLANK']);
    expect(analyzer.getDiscardCounts().NOT_A_PLANK).toBe(1);
  });

  it('still counts a real rep with a badly dropped hip - that is bad form, not a non-rep', () => {
    // Die Gegenprobe, und der Grund, warum die Hüfte allein nicht als Kriterium reicht.
    // In der Aufzeichnung vom 09.09.2026, 19:26 Uhr steht eine echte Wiederholung mit
    // Hüfte 97° - unter der Stütz-Schwelle. Sie unterscheidet sich vom Positionswechsel
    // dadurch, dass sie in die Tiefe ging (85°). Sie muss zählen und schlecht bewertet
    // werden, nicht verschwinden.
    const analyzer = new PushUpAnalyzer();
    const { reps, discards } = runFrames(analyzer, repFrames(85, { hipOffsetY: 0.8 }));

    expect(discards).toEqual([]);
    expect(reps).toHaveLength(1);
    expect(reps[0].issues).toContain('HIPS_SAGGING');
    expect(reps[0].formScore).toBeLessThan(80);
  });

  it('lässt die Bewertungs-Tiefenschwelle nicht mitentscheiden, was gezählt wird', () => {
    // `goodDepthElbowDeg` (Punkte) und `notAPlankDepthDeg` (Zählung) waren bis zum
    // 10.09.2026 dieselbe Zahl. Diese Bewegung liegt genau im Band zwischen beiden: Bei
    // 100° und abgekippter Hüfte ist sie nach der Verwurfsregel (95°) ein Positionswechsel
    // und muss verschwinden - so war es vor der Lockerung, und so muss es danach bleiben.
    // Wäre die Bewertungsschwelle (jetzt 105°) weiterhin dieselbe Zahl, würde sie ab
    // sofort gezählt: eine Änderung am *Zählen*, ausgelöst von einer Entscheidung über
    // *Punkte*, ohne dass irgendwo "Zählung" draufsteht.
    const analyzer = new PushUpAnalyzer();
    const { reps, discards } = runFrames(analyzer, repFrames(100, { hipOffsetY: 0.8 }));

    expect(reps).toEqual([]);
    expect(discards.map((d) => d.reason)).toEqual(['NOT_A_PLANK']);
  });

  it('zählt keine reine Kopfbewegung, auch wenn der Ellbogenwinkel dabei wackelt', () => {
    // Nachgestellt aus der Aufzeichnung vom 10.09.2026, 18:32 Uhr: chris lag im Stütz und
    // hat nur den Kopf auf und ab bewegt - 21 Wiederholungen am Stück wurden gezählt. Der
    // Ellbogenwinkel *bewegt* sich dabei wirklich (161° -> 121-142°), weil MediaPipe die
    // ganze Pose gemeinsam schätzt und die Kopfbewegung in die geschätzte Schulterposition
    // durchschlägt. Nur eben viel zu wenig für eine Wiederholung.
    const analyzer = new PushUpAnalyzer();
    const startMs = armAnalyzer(analyzer, 0, 161);
    const { reps, discards } = runFrames(
      analyzer,
      partialSweep(161, 128, 45).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg, flareDeg: PLANK_FLARE_DEG })),
      startMs
    );

    expect(reps).toEqual([]);
    expect(discards.map((d) => d.reason)).toEqual(['TOO_SHALLOW']);
  });

  it('zählt dieselbe Person weiter, sobald sich der Arm wirklich beugt', () => {
    // Die Gegenprobe, und der Grund, warum die Schwelle am *Bewegungsumfang* hängt und
    // nicht an einem festen Tiefpunkt: Dieselbe kalibrierte Streckung (161°), dieselbe
    // Kamera - nur geht der Arm jetzt wirklich herunter. In den echten Sitzungen desselben
    // Abends lag der Umfang bei 51-67°, bei der Kopfbewegung bei 19-40°.
    const analyzer = new PushUpAnalyzer();
    const startMs = armAnalyzer(analyzer, 0, 161);
    const { reps, discards } = runFrames(
      analyzer,
      partialSweep(161, 100, 45).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg, flareDeg: PLANK_FLARE_DEG })),
      startMs
    );

    expect(discards).toEqual([]);
    expect(reps).toHaveLength(1);
    expect(reps[0].elbowRangeDeg).toBeGreaterThanOrEqual(45);
  });

  it('misst den Bewegungsumfang gegen die eigene Streckung, nicht gegen 180°', () => {
    // Wessen gestreckter Arm auf diesem Gerät als 161° ankommt, dessen Tiefpunkt kommt
    // ebenfalls zu hoch an. Ein fester Tiefen-Winkel würde genau diese Person aussperren -
    // die Differenz bleibt vom Messfehler dagegen unberührt.
    const analyzer = new PushUpAnalyzer();
    const startMs = armAnalyzer(analyzer, 0, 161);
    const { reps } = runFrames(
      analyzer,
      partialSweep(161, 105, 45).map((elbowAngleDeg) => buildFrame({ elbowAngleDeg, flareDeg: PLANK_FLARE_DEG })),
      startMs
    );

    expect(reps).toHaveLength(1);
    // 161 - 105 = 56, nicht 180 - 105 = 75.
    expect(reps[0].elbowRangeDeg).toBeGreaterThanOrEqual(50);
    expect(reps[0].elbowRangeDeg).toBeLessThanOrEqual(60);
  });

  it('zählt keine Armbewegung, bei der der Oberarm in der Rumpflinie liegt', () => {
    // Nachgestellt aus der Aufzeichnung vom 10.09.2026, 19:03 Uhr: chris kniete und hat
    // nur die Arme in der Luft gebeugt und gestreckt. Der Ellbogen bewegt sich dabei
    // wirklich (Umfang 47-102°), `minRepRangeDeg` greift also nicht. Was sich
    // unterscheidet, ist die Richtung des Oberarms: quer zum Rumpf im Stütz, in der
    // Rumpflinie beim Knien (gemessen 63-177°, im Median 174°).
    const analyzer = new PushUpAnalyzer();
    const { reps, discards } = runFrames(analyzer, repFrames(95, { flareDeg: 174 }));

    expect(reps).toEqual([]);
    expect(discards.map((d) => d.reason)).toEqual(['ARMS_NOT_SUPPORTING']);
    expect(discards[0].maxElbowFlareDeg).toBeGreaterThanOrEqual(120);
  });

  it('lässt einen einzelnen verrutschten Frame die Zählung nicht kippen', () => {
    // Dieselbe Absicherung wie bei den Formwerten: Der geprüfte Flare ist ein Perzentil
    // über die Wiederholung, kein Extremwert. Ein Aussetzer mit 175° - in den Messdaten
    // der Normalfall bei kurzem Trackingverlust - darf keine echte Wiederholung kosten.
    const analyzer = new PushUpAnalyzer();
    const frames = repFrames(95);
    frames[15] = buildFrame({ elbowAngleDeg: 95, flareDeg: 175 });
    const { reps, discards } = runFrames(analyzer, frames);

    expect(discards).toEqual([]);
    expect(reps).toHaveLength(1);
  });

  it('trennt die Flare-Bewertung von der Flare-Zählschwelle', () => {
    // 95° sind schlechte Technik (Schwelle 80°) und werden bepunktet - aber es bleibt ein
    // Liegestütz. Erst ab 120° ist der Arm so weit in der Rumpflinie, dass er den Körper
    // nicht mehr trägt. Zwei Fragen, zwei Zahlen.
    const analyzer = new PushUpAnalyzer();
    const { reps, discards } = runFrames(analyzer, repFrames(95, { flareDeg: 95 }));

    expect(discards).toEqual([]);
    expect(reps).toHaveLength(1);
    expect(reps[0].issues).toContain('ELBOWS_FLARED');
  });

  it('zeichnet den Verlauf jeder Bewegung auf, gezählt wie verworfen', () => {
    // Ohne den Verlauf lässt sich die Frage nicht beantworten, die den Unterschied
    // ausmacht: Bewegt sich die Schulter zu den Händen (Liegestütz) oder wandern die
    // Hände (Arme in der Luft beugen)? Beide erzeugen denselben Ellbogenwinkel.
    const analyzer = new PushUpAnalyzer();
    const startMs = armAnalyzer(analyzer, 0);
    const traces: NonNullable<ReturnType<PushUpAnalyzer['processFrame']>['trace']>[] = [];
    const play = (poses: Pose[], from: number) => {
      poses.forEach((pose, i) => {
        const out = analyzer.processFrame(pose, from + i * FRAME_MS);
        if (out.trace) traces.push(out.trace);
      });
      return from + poses.length * FRAME_MS;
    };

    const afterRep = play(repFrames(95), startMs);
    play(repFrames(95, { flareDeg: 174 }), afterRep);

    expect(traces.map((t) => t.outcome)).toEqual(['rep', 'ARMS_NOT_SUPPORTING']);
    for (const t of traces) {
      // Index-gleich zu `t` - anders als die Kennzahl-Arrays im Sammler, die einzeln
      // gefiltert werden. Passt das nicht, ist der ganze Verlauf wertlos.
      expect(t.t.length).toBeGreaterThan(10);
      for (const row of [t.elbow, t.hip, t.flare, t.neck, t.horiz, t.sx, t.sy, t.wx, t.wy]) {
        expect(row).toHaveLength(t.t.length);
      }
      // Die Zeit läuft ab dem Beginn der Bewegung, nicht ab dem Start der Sitzung.
      expect(t.t[0]).toBe(0);
    }
  });

  it('hält im Verlauf fest, wo Schulter und Handgelenk im Bild waren', () => {
    // Die einzige aufgezeichnete Größe, die nicht aus Winkeln besteht - und damit die
    // einzige, die "die Hände liegen fest" von "die Hände wandern" unterscheiden kann.
    // Geprüft wird, dass wirklich der Wert *dieses* Frames ankommt, in Tausendstel: Eine
    // um einen Frame verschobene oder falsch skalierte Reihe fällt beim Auswerten nicht
    // auf, macht die Auswertung aber falsch.
    const analyzer = new PushUpAnalyzer();
    const imageAt = (frame: number): Pose =>
      Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 + frame / 1000, z: 0 }));

    let ms = 0;
    for (let i = 0; i < ARMING_FRAMES; i++, ms += FRAME_MS) {
      analyzer.processFrame(buildFrame({ elbowAngleDeg: 172, flareDeg: PLANK_FLARE_DEG }), ms, imageAt(0));
    }

    let trace: ReturnType<PushUpAnalyzer['processFrame']>['trace'] = null;
    repFrames(95).forEach((pose, i) => {
      const out = analyzer.processFrame(pose, ms + i * FRAME_MS, imageAt(i));
      if (out.trace) trace = out.trace;
    });

    expect(trace).not.toBeNull();
    expect(trace!.sy.every((v) => v !== null)).toBe(true);
    // Der Verlauf beginnt dort, wo die Wiederholung beginnt - also erst, wenn der Arm
    // unter `elbowUpDeg` fällt, ein paar Frames nach dem Start der Reihe. Deshalb keine
    // feste Zahl, sondern der *Abstand*: genau ein Tausendstel je Frame, ohne Versatz.
    expect(trace!.sy[0]).toBeGreaterThanOrEqual(500);
    expect(trace!.sy[5]! - trace!.sy[0]!).toBe(5);
    expect(trace!.sy[20]! - trace!.sy[0]!).toBe(20);
  });

  it('verlangt die Position neu, wenn sie mitten in der Sitzung verlassen wird', () => {
    // Bisher wurde die Startposition genau einmal geprüft. Wer sie einnahm und sich dann
    // hinkniete, konnte den Rest der Sitzung in beliebiger Haltung verbringen.
    const analyzer = new PushUpAnalyzer();
    let ms = armAnalyzer(analyzer, 0);
    expect(analyzer.isArmed()).toBe(true);

    // Zwei Sekunden kniend mit vorgestreckten Armen - die Haltung, die kein Stütz ist.
    for (let i = 0; i < 60; i++, ms += FRAME_MS) {
      analyzer.processFrame(buildFrame({ elbowAngleDeg: 170, flareDeg: 174 }), ms);
    }

    expect(analyzer.isArmed()).toBe(false);
    const out = analyzer.processFrame(buildFrame({ elbowAngleDeg: 170, flareDeg: 174 }), ms);
    // Und die Anzeige sagt, dass es ein *erneutes* Einnehmen ist - nicht das erste.
    expect(out.live.startPosition?.reentry).toBe(true);
  });

  it('lässt einen normalen Satz durchlaufen, ohne die Position neu zu verlangen', () => {
    // Die Gegenprobe, und die teure Fehlerrichtung: Ein Fehlalarm kostet mitten im Satz
    // zwei Sekunden Nachkalibrieren. Der Ellbogen geht in jeder Wiederholung auf rund
    // 100° herunter - genau deshalb wird er hier nicht geprüft.
    const analyzer = new PushUpAnalyzer();
    let ms = armAnalyzer(analyzer, 0);
    let reps = 0;
    for (let round = 0; round < 5; round++) {
      repFrames(95).forEach((pose) => {
        const out = analyzer.processFrame(pose, ms);
        ms += FRAME_MS;
        if (out.completedRep) reps += 1;
      });
    }

    expect(analyzer.isArmed()).toBe(true);
    expect(reps).toBe(5);
  });

  it('lässt einen kurzen Aussetzer die Position nicht verwerfen', () => {
    // Eine Sekunde ohne Pose ist ein Tracking-Schluckauf, kein Aufstehen. Nachkalibrieren
    // wäre hier die teurere Antwort.
    const analyzer = new PushUpAnalyzer();
    let ms = armAnalyzer(analyzer, 0);
    for (let i = 0; i < 30; i++, ms += FRAME_MS) {
      analyzer.processFrame(buildFrame({ elbowAngleDeg: 170, visibility: 0.1 }), ms);
    }

    expect(analyzer.isArmed()).toBe(true);
  });

  it('behält beim erneuten Einnehmen die Schwellwerte der ersten Messung', () => {
    // `personalThresholds` lockert nur. Ein zweites Kalibrieren wäre sonst ein Weg, sich
    // durch absichtlich schlechte Haltung mildere Schwellwerte zu holen - und die Position
    // zu verlieren wäre plötzlich ein Vorteil.
    const analyzer = new PushUpAnalyzer();
    let ms = armAnalyzer(analyzer, 0);
    const first = analyzer.getThresholds();

    for (let i = 0; i < 60; i++, ms += FRAME_MS) {
      analyzer.processFrame(buildFrame({ elbowAngleDeg: 170, flareDeg: 174 }), ms);
    }
    // Erneut einnehmen, diesmal mit deutlich schlechterer Haltung (tiefe Hüfte).
    for (let i = 0; i < ARMING_FRAMES; i++, ms += FRAME_MS) {
      analyzer.processFrame(
        buildFrame({ elbowAngleDeg: 172, flareDeg: PLANK_FLARE_DEG, hipOffsetY: 0.35 }),
        ms
      );
    }

    expect(analyzer.isArmed()).toBe(true);
    expect(analyzer.getThresholds()).toEqual(first);
  });

  it('erzeugt nach dem erneuten Einnehmen keine Wiederholung aus der Abwärtsbewegung', () => {
    // Das kurze Halten beim erneuten Einnehmen (800 ms) kann eine sehr langsame
    // Abwärtsbewegung nicht mehr aussperren - über diese Zeit liegt ihr Wandern unter dem
    // Messrauschen (siehe `reentryHoldMs`). Es muss sie auch nicht: Was die Zählung hier
    // schützt, sind die Prüfungen je Wiederholung. Genau das wird hier nachgewiesen.
    const analyzer = new PushUpAnalyzer();
    let ms = armAnalyzer(analyzer, 0);

    // Position verlieren (kniend, Arme vorgestreckt) ...
    for (let i = 0; i < 60; i++, ms += FRAME_MS) {
      analyzer.processFrame(buildFrame({ elbowAngleDeg: 170, flareDeg: 174 }), ms);
    }
    expect(analyzer.isArmed()).toBe(false);

    // ... und sich dann sehr langsam absenken, statt sauber anzukommen.
    const reps: RepResult[] = [];
    for (let i = 0; i < 200; i++, ms += FRAME_MS) {
      const out = analyzer.processFrame(
        buildFrame({ elbowAngleDeg: Math.max(95, 178 - i * 0.4), flareDeg: PLANK_FLARE_DEG }),
        ms
      );
      if (out.completedRep) reps.push(out.completedRep);
    }

    expect(reps).toEqual([]);
  });

  it('gives the benefit of the doubt when the hip was never measurable', () => {
    // Füße und Hüfte außerhalb des Bildes: Die Stütz-Prüfung darf dann nicht greifen,
    // sonst verschwinden Wiederholungen wegen einer Kamera-Position statt wegen der Form.
    const analyzer = new PushUpAnalyzer();
    const { reps, discards } = runFrames(analyzer, repFrames(120, { extendedVisibility: 0.1 }));

    expect(discards).toEqual([]);
    expect(reps).toHaveLength(1);
  });

  it('keeps using the side it locked onto at rep start, even if the other side becomes more visible mid-rep', () => {
    const analyzer = new PushUpAnalyzer();
    // Same elbow bend on both sides (a real push-up moves symmetrically), but the left
    // side is good form (tucked) while the right side is bad form (heavily flared).
    const bothSides = (elbowAngleDeg: number, leftVisibility: number, rightVisibility: number) =>
      mergePoses(
        buildFrame({ elbowAngleDeg, flareDeg: 30, side: 'left', visibility: leftVisibility }),
        buildFrame({ elbowAngleDeg, flareDeg: 95, side: 'right', visibility: rightVisibility })
      );

    // Links ist besser sichtbar, wenn die Wiederholung beginnt (der Winkel fällt hier um
    // Frame 6 unter 160°), und wird deshalb festgelegt; ab Frame 12 wird rechts sichtbarer.
    // Ohne die Seiten-Festlegung würde `pickMoreVisibleSide` mitten in der Wiederholung auf
    // die abgespreizten Werte der rechten Seite umschalten.
    const poses = repSweep(90).map((elbowAngleDeg, i) =>
      i < 12 ? bothSides(elbowAngleDeg, 0.9, 0.6) : bothSides(elbowAngleDeg, 0.9, 0.95)
    );
    const { reps } = runFrames(analyzer, poses);

    expect(reps).toHaveLength(1);
    expect(reps[0].issues).not.toContain('ELBOWS_FLARED');
    expect(reps[0].formScore).toBe(100);
  });
});

describe('PushUpAnalyzer: Startposition und Kalibrierung', () => {
  /**
   * Der Winkel Schulter-Hüfte-Knie, den `buildFrame` für einen bestimmten Hüftversatz
   * erzeugt. Ausgerechnet statt geschätzt, damit die Testfälle nachweislich auf der
   * richtigen Seite der Schwellwerte liegen.
   */
  function hipAngleFor(hipOffsetY: number): number {
    const pose = buildFrame({ elbowAngleDeg: 170, hipOffsetY });
    return angleAtPoint(
      pose[PoseLandmarkIndex.rightShoulder],
      pose[PoseLandmarkIndex.rightHip],
      pose[PoseLandmarkIndex.rightKnee]
    );
  }

  function baselineFixture(overrides: Partial<PostureBaseline> = {}): PostureBaseline {
    return {
      topElbowAngleDeg: 172,
      neutralHipStraightnessDeg: 180,
      neutralNeckAngleDeg: 175,
      elbowJitterDeg: 1,
      hipJitterDeg: 2,
      elbowSpreadDeg: 1,
      hipSpreadDeg: 2,
      elbowDriftDeg: 0,
      hipDriftDeg: 0,
      restarts: 0,
      dropouts: 0,
      neutralElbowFlareDeg: 75,
      torsoHorizontalRatio: 0.9,
      samples: 60,
      heldMs: 2000,
      ...overrides,
    };
  }

  /**
   * Der Weg in die Liegestütz-Position, so wie chris ihn beschreibt: Handy hinstellen,
   * zwei Schritte zurück, hinknien, Hände aufsetzen, Körper strecken.
   *
   * Für einen Zähler, der den Ellbogenwinkel verfolgt, sieht das aus wie eine
   * Wiederholung - der Arm streckt und beugt sich dabei tatsächlich. Die Zahlen stammen
   * aus der Aufzeichnung vom 09.09.2026 (20:12 Uhr): Hüfte 56-88°, tiefster
   * Ellbogenwinkel 117-130°.
   */
  function walkIntoPosition(): Pose[] {
    // 1. Zwei Sekunden aufrecht stehen: Arme gestreckt, Körper gerade, Arme am Körper.
    //    Das ist der Fall, den chris beschreibt - hier wurde die erste Fehlzählung
    //    ausgelöst, und eine reine Winkelprüfung kann ihn nicht von einem Stütz trennen.
    const standing = Array.from({ length: 60 }, () =>
      buildFrame({ elbowAngleDeg: 175, flareDeg: 12, hipOffsetY: 0 })
    );
    // 2. Hinknien, Hände aufsetzen, Körper strecken.
    const goingDown = Array.from({ length: 25 }, (_, i) => {
      const phase = i / 24;
      return buildFrame({
        elbowAngleDeg: 175 - 55 * Math.sin(phase * Math.PI), // 175° -> 120° -> 175°
        hipOffsetY: 1.0 - 0.9 * phase, // stark abgeknickt -> zunehmend gestreckt
        flareDeg: 12 + 63 * phase, // Arm löst sich vom Körper und kommt unter die Schulter
      });
    });
    return [...standing, ...goingDown];
  }

  it('zählt den Weg in die Position nicht als Wiederholung', () => {
    expect(hipAngleFor(1.0)).toBeLessThan(110); // wirklich kein Stütz
    const analyzer = new PushUpAnalyzer();

    const approach = walkIntoPosition();
    approach.forEach((pose, i) => {
      const { completedRep, discardedRep } = analyzer.processFrame(pose, i * FRAME_MS);
      expect(completedRep).toBeNull();
      expect(discardedRep).toBeNull();
    });
    expect(analyzer.isArmed()).toBe(false);
  });

  it('zählt erst, nachdem die Startposition zwei Sekunden gehalten wurde', () => {
    const analyzer = new PushUpAnalyzer();
    let t = 0;

    // 1. Hineingehen - darf nichts auslösen.
    walkIntoPosition().forEach((pose) => {
      analyzer.processFrame(pose, t);
      t += FRAME_MS;
    });
    expect(analyzer.isArmed()).toBe(false);

    // 2. Ruhig halten - schaltet scharf.
    for (let i = 0; i < 80; i++) {
      analyzer.processFrame(buildFrame({ elbowAngleDeg: 172, flareDeg: PLANK_FLARE_DEG }), t);
      t += FRAME_MS;
    }
    expect(analyzer.isArmed()).toBe(true);

    // 3. Drei echte Wiederholungen - werden gezählt.
    const reps: RepResult[] = [];
    [90, 92, 88].forEach((bottom) => {
      repFrames(bottom).forEach((pose) => {
        const { completedRep } = analyzer.processFrame(pose, t);
        if (completedRep) reps.push(completedRep);
        t += FRAME_MS;
      });
    });
    expect(reps).toHaveLength(3);
  });

  it('meldet solange den Grund, warum noch nicht gezählt wird', () => {
    const analyzer = new PushUpAnalyzer();

    const bent = analyzer.processFrame(buildFrame({ elbowAngleDeg: 120, flareDeg: PLANK_FLARE_DEG }), 0);
    expect(bent.live.startPosition?.status).toBe('ARMS_BENT');
    expect(bent.live.startPosition?.requiredMs).toBe(2000);

    const kneeling = analyzer.processFrame(
      buildFrame({ elbowAngleDeg: 172, hipOffsetY: 1.0, flareDeg: PLANK_FLARE_DEG }),
      FRAME_MS
    );
    expect(kneeling.live.startPosition?.status).toBe('NOT_A_PLANK');

    const outOfFrame = analyzer.processFrame(
      buildFrame({ elbowAngleDeg: 172, visibility: 0.1, flareDeg: PLANK_FLARE_DEG }),
      2 * FRAME_MS
    );
    expect(outOfFrame.live.startPosition?.status).toBe('NO_POSE');
    expect(outOfFrame.live.trackingOk).toBe(false);
  });

  it('meldet nach dem Scharfschalten keine Startposition mehr', () => {
    const analyzer = new PushUpAnalyzer();
    const { live } = runFrames(analyzer, repFrames(90));

    expect(live.startPosition).toBeNull();
    expect(analyzer.isArmed()).toBe(true);
  });

  it('misst die eigene Grundhaltung beim Halten', () => {
    const analyzer = new PushUpAnalyzer();
    armAnalyzer(analyzer, 0);

    const baseline = analyzer.getBaseline();
    expect(baseline).not.toBeNull();
    expect(baseline!.topElbowAngleDeg).toBe(172);
    expect(baseline!.neutralHipStraightnessDeg).toBe(180); // buildFrame ohne Hüftversatz
    expect(baseline!.samples).toBeGreaterThanOrEqual(12);
  });

  it('lockert die Hüft-Schwelle für eine flach gefilmte, aber gerade Haltung', () => {
    // Der Kern des Fehlalarms: Eine Person mit geradem Rücken, flach von vorn gefilmt,
    // misst in der Startposition nur rund 150° statt 180°. Jede ihrer Wiederholungen
    // liegt dann unter dem allgemeinen Schwellwert von 145° - und bekommt "Hüfte sackt
    // durch" gemeldet, obwohl sich an ihrer Haltung nichts geändert hat.
    const neutralOffset = 0.18; // Grundhaltung dieser Person, flach gefilmt
    const duringRepOffset = 0.245; // im Verlauf einer Wiederholung, unverändert gerader Rücken
    expect(Math.round(hipAngleFor(neutralOffset))).toBe(150);
    expect(Math.round(hipAngleFor(duringRepOffset))).toBe(140);

    const calibrated = new PushUpAnalyzer();
    for (let i = 0; i < 80; i++) {
      calibrated.processFrame(
        buildFrame({ elbowAngleDeg: 172, hipOffsetY: neutralOffset, flareDeg: PLANK_FLARE_DEG }),
        i * FRAME_MS
      );
    }
    expect(calibrated.getThresholds().minHipStraightnessDeg).toBe(130); // 150 - 20

    const { reps } = runFrames(calibrated, repFrames(90, { hipOffsetY: duringRepOffset }), 80 * FRAME_MS);
    expect(reps).toHaveLength(1);
    expect(reps[0].minHipStraightnessDeg).toBe(140);
    expect(reps[0].issues).not.toContain('HIPS_SAGGING');

    // Gegenprobe: Ohne Kalibrierung auf diese Haltung schlägt genau diese Wiederholung an -
    // sie liegt mit 140° unter dem allgemeinen Schwellwert von 145°.
    const uncalibrated = new PushUpAnalyzer();
    armAnalyzer(uncalibrated, 0);
    const strict = runFrames(uncalibrated, repFrames(90, { hipOffsetY: duringRepOffset }));
    expect(strict.reps[0].issues).toContain('HIPS_SAGGING');
  });

  it('verschärft die Schwelle nie, egal wie gut die Grundhaltung ist', () => {
    // Eine perfekte Grundhaltung (180°) ergäbe rechnerisch 160° - strenger als der
    // allgemeine Wert. Genau das soll nicht passieren: Wer die Fehlalarme gar nicht hat,
    // soll dafür nicht strenger bewertet werden.
    const analyzer = new PushUpAnalyzer();
    armAnalyzer(analyzer, 0);

    expect(analyzer.getBaseline()!.neutralHipStraightnessDeg).toBe(180);
    expect(analyzer.getThresholds().minHipStraightnessDeg).toBe(DEFAULT_THRESHOLDS.minHipStraightnessDeg);
  });

  it('lockert höchstens bis zur Untergrenze, auch bei schlechter Grundhaltung', () => {
    // Wer mit durchgesackter Hüfte einsteigt, darf sich das nicht als "normal" für den
    // Rest der Sitzung bescheinigen lassen.
    const personal = personalThresholds(
      baselineFixture({ neutralHipStraightnessDeg: 115, neutralNeckAngleDeg: 60 })
    );
    expect(personal.minHipStraightnessDeg).toBe(DEFAULT_THRESHOLDS.minHipStraightnessDeg - 25);
    expect(personal.minNeckAngleDeg).toBe(DEFAULT_THRESHOLDS.minNeckAngleDeg - 25);
  });

  it('lässt Schwellwerte unangetastet, was in der Startposition nicht messbar war', () => {
    const personal = personalThresholds(
      baselineFixture({ neutralHipStraightnessDeg: null, neutralNeckAngleDeg: null, hipJitterDeg: null })
    );

    expect(personal.minHipStraightnessDeg).toBeUndefined();
    expect(personal.minNeckAngleDeg).toBeUndefined();
  });

  it('fasst die Ellbogen-Schwellen bewusst nicht an', () => {
    // Sie entscheiden, OB gezählt wird. Ein Fehler dort kostet Wiederholungen, ein
    // Fehler bei Hüfte oder Nacken nur Punkte.
    const personal = personalThresholds(
      baselineFixture({ topElbowAngleDeg: 150, neutralHipStraightnessDeg: 150, neutralNeckAngleDeg: 140 })
    );

    expect(personal.elbowUpDeg).toBeUndefined();
    expect(personal.elbowAttemptDeg).toBeUndefined();
    expect(personal.goodDepthElbowDeg).toBeUndefined();
  });

  it('zählt nichts, solange jemand nur ruhig vor der Kamera steht', () => {
    // Der zweite Teil dessen, was chris beschreibt: erst stehen (dabei kam die erste
    // Fehlzählung), dann hinlegen (dabei die zweite). Weder das eine noch das andere
    // darf die Zählung starten.
    const analyzer = new PushUpAnalyzer();
    let t = 0;
    const seen: RepResult[] = [];

    walkIntoPosition().forEach((pose) => {
      const { completedRep } = analyzer.processFrame(pose, t);
      if (completedRep) seen.push(completedRep);
      t += FRAME_MS;
    });

    expect(seen).toHaveLength(0);
    expect(analyzer.isArmed()).toBe(false);
  });

  it('nennt "du stehst noch" als eigenen Grund', () => {
    const analyzer = new PushUpAnalyzer();
    // Alles gestreckt, aber die Arme hängen am Körper statt unter den Schultern.
    const { live } = analyzer.processFrame(buildFrame({ elbowAngleDeg: 175, flareDeg: 12 }), 0);

    expect(live.startPosition?.status).toBe('STANDING');
  });

  it('verlangt nach reset() wieder die Startposition', () => {
    const analyzer = new PushUpAnalyzer();
    armAnalyzer(analyzer, 0);
    expect(analyzer.isArmed()).toBe(true);

    analyzer.reset();
    expect(analyzer.isArmed()).toBe(false);
    expect(analyzer.getBaseline()).toBeNull();
    expect(analyzer.getThresholds().minHipStraightnessDeg).toBe(DEFAULT_THRESHOLDS.minHipStraightnessDeg);
  });
});

describe('PushUpAnalyzer: nur was wirklich im Bild ist', () => {
  /**
   * Normalisierte Bildkoordinaten (`landmarks`, nicht `worldLandmarks`). Alles liegt
   * mittig im Bild, außer den ausdrücklich genannten Indizes - die legt MediaPipe für
   * Körperteile außerhalb des Bildes durchaus auch jenseits von 0..1 ab.
   */
  function imageFrame(outOfFrame: number[] = []): Pose {
    return Array.from({ length: 33 }, (_, i) =>
      outOfFrame.includes(i) ? { x: 1.4, y: 0.5, z: 0 } : { x: 0.5, y: 0.5, z: 0 }
    );
  }

  function playWithImage(analyzer: PushUpAnalyzer, poses: Pose[], image: Pose, startMs = 0) {
    const reps: RepResult[] = [];
    let last: ReturnType<PushUpAnalyzer['processFrame']> | null = null;
    poses.forEach((pose, i) => {
      last = analyzer.processFrame(pose, startMs + i * FRAME_MS, image);
      if (last.completedRep) reps.push(last.completedRep);
    });
    return { reps, live: last!.live };
  }

  /** Startposition einnehmen, mit ausdrücklich mitgegebenen Bildkoordinaten. */
  function armWithImage(analyzer: PushUpAnalyzer, image: Pose, startMs = 0): number {
    for (let i = 0; i < 80; i++) {
      analyzer.processFrame(buildFrame({ elbowAngleDeg: 172, flareDeg: 75 }), startMs + i * FRAME_MS, image);
    }
    return startMs + 80 * FRAME_MS;
  }

  it('zählt gar nicht, solange der Arm nicht vollständig im Bild ist', () => {
    // Genau der Fall aus chris' Beschreibung: Er geht rückwärts von der Kamera weg und
    // ist dabei nur teilweise im Bild - und bekommt trotzdem schon die erste Zählung.
    // MediaPipe liefert für den Arm dann geschätzte Koordinaten, und der
    // Sichtbarkeitswert, der das aussortieren würde, kommt bei react-native-mediapipe
    // nie in JS an (siehe landmarks.ts).
    const analyzer = new PushUpAnalyzer();
    const wristOutside = imageFrame([PoseLandmarkIndex.rightWrist]);

    const armed = armWithImage(analyzer, wristOutside);
    expect(analyzer.isArmed()).toBe(false);

    const { reps, live } = playWithImage(analyzer, repFrames(90), wristOutside, armed);
    expect(reps).toHaveLength(0);
    expect(live.trackingOk).toBe(false);
    expect(live.startPosition?.status).toBe('NO_POSE');
  });

  it('zählt wieder, sobald der Arm im Bild ist', () => {
    const analyzer = new PushUpAnalyzer();
    const allInside = imageFrame();

    const armed = armWithImage(analyzer, allInside);
    expect(analyzer.isArmed()).toBe(true);

    const { reps } = playWithImage(analyzer, repFrames(90), allInside, armed);
    expect(reps).toHaveLength(1);
  });

  it('bewertet die Hüfte nicht, wenn das Knie außerhalb des Bildes liegt', () => {
    // Vorher wurde aus einem erfundenen Knie ein Hüftwinkel berechnet - das ist die
    // wahrscheinlichste Quelle der Hüftwerte, die innerhalb einer Sitzung zwischen 10°
    // und 158° sprangen. Lieber gar keine Aussage als eine geratene.
    const analyzer = new PushUpAnalyzer();
    const kneeOutside = imageFrame([PoseLandmarkIndex.rightKnee]);

    const armed = armWithImage(analyzer, kneeOutside);
    const { reps } = playWithImage(analyzer, repFrames(90, { hipOffsetY: 0.5 }), kneeOutside, armed);

    expect(reps).toHaveLength(1);
    expect(reps[0].minHipStraightnessDeg).toBeNull();
    expect(reps[0].issues).not.toContain('HIPS_SAGGING');
  });

  it('unterscheidet "Arme raus" von "Beine raus"', () => {
    // Die beiden Fälle brauchen verschiedene Meldungen: Beim ersten zählt gar nichts,
    // beim zweiten zählt es weiter und nur die Haltungsbewertung fällt aus. Wer beim
    // zweiten zurücktritt, macht es schlimmer - dann ragen womöglich die Arme raus.
    const analyzer = new PushUpAnalyzer();
    const kneeOutside = imageFrame([PoseLandmarkIndex.rightKnee]);
    const armed = armWithImage(analyzer, kneeOutside);

    const lower = analyzer.processFrame(buildFrame({ elbowAngleDeg: 170 }), armed, kneeOutside);
    expect(lower.live.framing).toBe('LOWER_BODY_OUT_OF_FRAME');
    expect(lower.live.trackingOk).toBe(true);

    const wristOutside = imageFrame([PoseLandmarkIndex.rightWrist]);
    const arms = analyzer.processFrame(buildFrame({ elbowAngleDeg: 170 }), armed + FRAME_MS, wristOutside);
    expect(arms.live.framing).toBe('ARMS_OUT_OF_FRAME');
    expect(arms.live.trackingOk).toBe(false);

    const allInside = imageFrame();
    const fine = analyzer.processFrame(buildFrame({ elbowAngleDeg: 170 }), armed + 2 * FRAME_MS, allInside);
    expect(fine.live.framing).toBeNull();
  });

  it('hält den Arm nur an, wenn er wirklich aus dem Bild ragt - nicht schon am Rand', () => {
    // Die beiden Fehlerrichtungen kosten Unterschiedliches: Eine faelschlich
    // ausgeschlossene Hüfte kostet eine Formnote, ein fälschlich ausgeschlossener Arm
    // kostet die ganze Zählung. Deshalb gilt beim Arm nur "nachweislich draußen".
    const analyzer = new PushUpAnalyzer();
    // Handgelenk dicht am Rand (1 % vom Bildrand) - innerhalb des Sicherheitsabstands
    // von 2 %, der für die Formpunkte gilt, aber eben noch im Bild.
    const atTheEdge = imageFrame();
    atTheEdge[PoseLandmarkIndex.rightWrist] = { x: 0.99, y: 0.5, z: 0 };

    const armed = armWithImage(analyzer, atTheEdge);
    expect(analyzer.isArmed()).toBe(true);

    const { reps } = playWithImage(analyzer, repFrames(90), atTheEdge, armed);
    expect(reps).toHaveLength(1);
  });

  it('hält im Verwurf fest, ob der Arm aus dem Bild ragte', () => {
    // Im Release-Build gibt es kein Log - die Kalibrierungsdaten sind alles, was von
    // einer Trainingseinheit bei mir ankommt. Ein TRACKING_LOST mit hohem Wert hier heißt
    // "steh weiter weg vom Handy", eines mit 0 heißt "MediaPipe hat die Pose verloren".
    const analyzer = new PushUpAnalyzer();
    const allInside = imageFrame();
    let t = armWithImage(analyzer, allInside);

    // Abwärtsbewegung beginnen, damit eine Wiederholung läuft ...
    analyzer.processFrame(buildFrame({ elbowAngleDeg: 150 }), t, allInside);
    t += FRAME_MS;
    // ... und dann aus dem Bild verschwinden, bis das Zeitlimit greift.
    const wristOutside = imageFrame([PoseLandmarkIndex.rightWrist]);
    let discarded: DiscardedRep | null = null;
    for (let i = 0; i < 500 && !discarded; i++) {
      discarded = analyzer.processFrame(buildFrame({ elbowAngleDeg: 150 }), t, wristOutside).discardedRep;
      t += FRAME_MS;
    }

    expect(discarded).not.toBeNull();
    // Seit dem 11.09.2026 greift hier die laufende Positionsprüfung: Wer aus dem Bild
    // geht, hat die Stützposition verlassen, und das fällt nach 1,5 s auf - lange bevor
    // das 12-Sekunden-Zeitlimit der Wiederholung erreicht wäre.
    expect(discarded!.reason).toBe('NOT_A_PLANK');
    expect(discarded!.outOfFrameFrames).toBeGreaterThan(0);
    expect(discarded!.outOfFrameFrames).toBeLessThanOrEqual(discarded!.untrackedFrames);
  });

  it('bleibt ohne Bildkoordinaten beim alten Verhalten', () => {
    // Die Bildlandmarken sind ein optionales Argument: Wer sie nicht mitgibt (Tests,
    // ältere Aufrufer), bekommt die Prüfung nicht aufgezwungen.
    const analyzer = new PushUpAnalyzer();
    const { reps } = runFrames(analyzer, repFrames(90));

    expect(reps).toHaveLength(1);
  });
});

describe('pickMoreVisibleSide', () => {
  const ARM = {
    left: [
      PoseLandmarkIndex.leftShoulder,
      PoseLandmarkIndex.leftElbow,
      PoseLandmarkIndex.leftWrist,
      PoseLandmarkIndex.leftHip,
    ],
    right: [
      PoseLandmarkIndex.rightShoulder,
      PoseLandmarkIndex.rightElbow,
      PoseLandmarkIndex.rightWrist,
      PoseLandmarkIndex.rightHip,
    ],
  };

  /** 33 landmarks carrying only depth - exactly the shape react-native-mediapipe sends. */
  function poseWithDepthOnly(leftZ: number, rightZ: number) {
    const pose = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    ARM.left.forEach((i) => (pose[i] = { x: 0, y: 0, z: leftZ }));
    ARM.right.forEach((i) => (pose[i] = { x: 0, y: 0, z: rightZ }));
    return pose;
  }

  it('prefers the side nearer the camera when no visibility data is available', () => {
    // react-native-mediapipe never populates visibility, which used to make the
    // left/right comparison a tie on every frame and therefore always pick 'right' -
    // even when the left side was the one facing the camera and 'right' was the fully
    // occluded, purely estimated arm. Smaller z = closer to the camera in MediaPipe's
    // convention.
    expect(pickMoreVisibleSide(poseWithDepthOnly(-0.4, 0.4))).toBe('left');
    expect(pickMoreVisibleSide(poseWithDepthOnly(0.4, -0.4))).toBe('right');
  });

  it('still prefers real visibility scores when the pose actually carries them', () => {
    const pose = poseWithDepthOnly(0.4, -0.4).map((p) => ({ ...p, visibility: 0.9 }));
    // Right side is nearer the camera but barely tracked - visibility must win.
    ARM.right.forEach((i) => (pose[i] = { ...pose[i], visibility: 0.1 }));

    expect(pickMoreVisibleSide(pose)).toBe('left');
  });
});
