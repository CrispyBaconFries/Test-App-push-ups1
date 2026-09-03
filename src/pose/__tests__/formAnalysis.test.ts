import { PushUpAnalyzer } from '../formAnalysis';
import { buildFrame } from '../testing/poseBuilder';

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

  it('reports trackingOk: false and skips analysis when the pose is barely visible', () => {
    const analyzer = new PushUpAnalyzer();
    const { live, completedRep } = analyzer.processFrame(buildFrame({ elbowAngleDeg: 90, visibility: 0.1 }), 0);

    expect(live.trackingOk).toBe(false);
    expect(completedRep).toBeNull();
    expect(analyzer.getPhase()).toBe('up');
  });
});
