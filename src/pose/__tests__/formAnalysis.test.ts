import { PushUpAnalyzer } from '../formAnalysis';
import { buildFrame, mergePoses } from '../testing/poseBuilder';
import { pickMoreVisibleSide } from '../landmarks';
import { PoseLandmarkIndex } from '../blazePoseLandmarks';

describe('PushUpAnalyzer', () => {
  it('counts a clean, deep rep with a perfect form score', () => {
    const analyzer = new PushUpAnalyzer();
    const sequence = [180, 150, 90, 90, 120, 150, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    sequence.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(buildFrame({ elbowAngleDeg }), i * 33);
    });

    expect(lastResult!.completedRep).not.toBeNull();
    expect(lastResult!.completedRep!.formScore).toBe(100);
    expect(lastResult!.completedRep!.issues).toEqual([]);
    expect(analyzer.getPhase()).toBe('up');
  });

  it('still counts a shallow rep, but penalizes it for insufficient depth', () => {
    const analyzer = new PushUpAnalyzer();
    const sequence = [180, 150, 120, 145, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    sequence.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(buildFrame({ elbowAngleDeg }), i * 33);
    });

    expect(lastResult!.completedRep).not.toBeNull();
    expect(lastResult!.completedRep!.issues).toContain('INSUFFICIENT_DEPTH');
    expect(lastResult!.completedRep!.formScore).toBe(63);
  });

  it('discards a small dip near lockout as a false start instead of counting it', () => {
    const analyzer = new PushUpAnalyzer();
    // Dips to 145 (never crosses the 140 attempt threshold), then straightens back out.
    const falseStart = [180, 150, 145, 165];
    falseStart.forEach((elbowAngleDeg, i) => {
      const { completedRep } = analyzer.processFrame(buildFrame({ elbowAngleDeg }), i * 33);
      expect(completedRep).toBeNull();
    });
    expect(analyzer.getPhase()).toBe('up');

    // A real rep right after should still be counted as rep #1 (index 0) - the false
    // start above must not have consumed a rep index or left stray state behind.
    const realRep = [150, 90, 90, 150, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;
    realRep.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(buildFrame({ elbowAngleDeg }), (falseStart.length + i) * 33);
    });
    expect(lastResult!.completedRep?.index).toBe(0);
  });

  it('flags sagging hips and lowers the score, without also reporting piking', () => {
    const analyzer = new PushUpAnalyzer();
    const sequence = [180, 150, 90, 90, 150, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    sequence.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(buildFrame({ elbowAngleDeg, hipOffsetY: 0.3 }), i * 33);
    });

    expect(lastResult!.completedRep).not.toBeNull();
    expect(lastResult!.completedRep!.issues).toContain('HIPS_SAGGING');
    expect(lastResult!.completedRep!.issues).not.toContain('HIPS_PIKING');
    expect(lastResult!.completedRep!.formScore).toBeLessThan(100);
    expect(lastResult!.completedRep!.formScore).toBeGreaterThan(60);
  });

  it('flags flared elbows during the down phase', () => {
    const analyzer = new PushUpAnalyzer();
    const sequence = [180, 150, 90, 90, 150, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    sequence.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(buildFrame({ elbowAngleDeg, flareDeg: 95 }), i * 33);
    });

    expect(lastResult!.completedRep!.issues).toContain('ELBOWS_FLARED');
  });

  it('still counts a rep when the pose has no visibility data at all (matches real device data)', () => {
    // react-native-mediapipe's native bridge never actually populates `visibility` on
    // any landmark (see landmarks.ts for the full explanation) - every landmark arrives
    // with visibility simply absent, not a real low number. Build frames the same way
    // instead of going through buildFrame() (which always sets some visibility value)
    // to prove the analyzer still works against what the app actually receives.
    const analyzer = new PushUpAnalyzer();
    const stripVisibility = (pose: ReturnType<typeof buildFrame>) =>
      pose.map(({ visibility: _visibility, ...rest }) => rest);
    const sequence = [180, 150, 90, 90, 120, 150, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    sequence.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(stripVisibility(buildFrame({ elbowAngleDeg })), i * 33);
    });

    expect(lastResult!.completedRep).not.toBeNull();
    expect(lastResult!.completedRep!.formScore).toBe(100);
  });

  it('still counts a rep when the feet/hips are out of frame, as long as the arm is visible', () => {
    // Realistic push-up camera setup: phone propped up low in front of the user, so the
    // arm (shoulder/elbow/wrist) is clearly visible but the feet trail off out of frame
    // or too foreshortened for MediaPipe to trust (visibility 0.1, well under the 0.5
    // minimum). Rep counting must not depend on that - only form-quality checks that
    // specifically need hip/ankle/ear should degrade, not the rep count itself.
    const analyzer = new PushUpAnalyzer();
    const sequence = [180, 150, 90, 90, 120, 150, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    sequence.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(buildFrame({ elbowAngleDeg, extendedVisibility: 0.1 }), i * 33);
    });

    expect(lastResult!.completedRep).not.toBeNull();
    // No hip/ankle data was ever available, so those checks must give the benefit of the
    // doubt rather than penalizing the rep for something that couldn't be measured.
    expect(lastResult!.completedRep!.issues).toEqual([]);
    expect(analyzer.getPhase()).toBe('up');
  });

  it('reports unmeasurable form metrics as null, not as a non-finite number', () => {
    // Same out-of-frame setup as above. The optional-check accumulators start at
    // ±Infinity, and a rep that never saw hip/ankle/ear leaves them there. RepResults are
    // persisted with JSON.stringify (workout history, calibration log), where Infinity
    // silently turns into null - so anything reading those numbers back would get a
    // null typed as `number` and quietly compute NaN. Report "not measured" honestly.
    const analyzer = new PushUpAnalyzer();
    const sequence = [180, 150, 90, 90, 120, 150, 165];
    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    sequence.forEach((elbowAngleDeg, i) => {
      lastResult = analyzer.processFrame(buildFrame({ elbowAngleDeg, extendedVisibility: 0.1 }), i * 33);
    });

    const rep = lastResult!.completedRep!;
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

  it('keeps using the side it locked onto at rep start, even if the other side becomes more visible mid-rep', () => {
    const analyzer = new PushUpAnalyzer();
    // Same elbow bend on both sides (a real push-up moves symmetrically), but the left
    // side is good form (tucked) while the right side is bad form (heavily flared).
    const bothSides = (elbowAngleDeg: number, leftVisibility: number, rightVisibility: number) =>
      mergePoses(
        buildFrame({ elbowAngleDeg, flareDeg: 30, side: 'left', visibility: leftVisibility }),
        buildFrame({ elbowAngleDeg, flareDeg: 95, side: 'right', visibility: rightVisibility })
      );

    let lastResult: ReturnType<PushUpAnalyzer['processFrame']> | null = null;

    // Left is more visible when the rep starts, so it gets locked in...
    lastResult = analyzer.processFrame(bothSides(180, 0.9, 0.6), 0);
    lastResult = analyzer.processFrame(bothSides(150, 0.9, 0.6), 33);
    // ...then right becomes *more* visible than left for the rest of the rep. Without
    // side-locking, `pickMoreVisibleSide` would switch to right's flared-elbow data here.
    lastResult = analyzer.processFrame(bothSides(90, 0.9, 0.95), 66);
    lastResult = analyzer.processFrame(bothSides(90, 0.9, 0.95), 99);
    lastResult = analyzer.processFrame(bothSides(150, 0.9, 0.95), 132);
    lastResult = analyzer.processFrame(bothSides(165, 0.9, 0.95), 165);

    expect(lastResult!.completedRep).not.toBeNull();
    expect(lastResult!.completedRep!.issues).not.toContain('ELBOWS_FLARED');
    expect(lastResult!.completedRep!.formScore).toBe(100);
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
