import { PushUpAnalyzer, type DiscardedRep, type LiveFeedback, type RepResult } from '../formAnalysis';
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
 * Spielt Frames im Kameratakt ab und sammelt alles ein, was dabei herauskommt.
 *
 * Bewusst nicht "gib das Ergebnis des letzten Frames zurück": Eine Wiederholung endet
 * dort, wo der Arm wieder gestreckt ist - bei einem realistischen Bewegungsverlauf also
 * einige Frames vor dem Ende der Sequenz. `reps.length` ist außerdem die Prüfung, die
 * Doppelzählungen auffliegen lässt.
 */
function runFrames(
  analyzer: PushUpAnalyzer,
  poses: Pose[],
  startMs = 0
): { reps: RepResult[]; discards: DiscardedRep[]; cues: LiveFeedback['cue'][]; live: LiveFeedback } {
  const reps: RepResult[] = [];
  const discards: DiscardedRep[] = [];
  const cues: LiveFeedback['cue'][] = [];
  let last: ReturnType<PushUpAnalyzer['processFrame']> | null = null;
  poses.forEach((pose, i) => {
    last = analyzer.processFrame(pose, startMs + i * FRAME_MS);
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
    expect(reps[0].formScore).toBe(62);
  });

  it('discards a small dip near lockout as a false start instead of counting it', () => {
    const analyzer = new PushUpAnalyzer();
    // Sinkt auf 145 (überschreitet die Versuchsschwelle von 140 nie) und streckt sich wieder.
    const falseStart = [170, 160, 150, 145, 150, 165].map((elbowAngleDeg) => buildFrame({ elbowAngleDeg }));
    falseStart.forEach((pose, i) => {
      const { completedRep, discardedRep } = analyzer.processFrame(pose, i * FRAME_MS);
      expect(completedRep).toBeNull();
      // Ein Fehlstart ist keine verworfene Wiederholung: Er war nie eine.
      expect(discardedRep).toBeNull();
    });
    expect(analyzer.getPhase()).toBe('up');

    // Eine echte Wiederholung direkt danach muss weiterhin Wiederholung #1 (Index 0) sein -
    // der Fehlstart darf weder einen Index verbraucht noch Zustand hinterlassen haben.
    const { reps } = runFrames(analyzer, repFrames(90), falseStart.length * FRAME_MS);
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
    const persistent = new PushUpAnalyzer();
    const flagged = runFrames(persistent, repFrames(90, { flareDeg: 175, hipOffsetY: 0.9 }));
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
    expect(analyzer.getDiscardCounts()).toEqual({ TOO_SHORT: 0, TOO_LONG: 0, TRACKING_LOST: 0 });
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
