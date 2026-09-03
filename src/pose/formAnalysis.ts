import {
  allVisible,
  angleAtPoint,
  getLandmark,
  pickMoreVisibleSide,
  sideIndices,
  signedPerpendicularDeviation2D,
  type Pose,
} from './landmarks';

export type RepPhase = 'up' | 'descending' | 'down' | 'ascending';

export type FormIssue =
  | 'INSUFFICIENT_DEPTH'
  | 'HIPS_SAGGING'
  | 'HIPS_PIKING'
  | 'ELBOWS_FLARED'
  | 'HEAD_MISALIGNED';

export interface RepResult {
  index: number;
  formScore: number;
  issues: FormIssue[];
  minElbowAngleDeg: number;
  minHipStraightnessDeg: number;
  maxElbowFlareDeg: number;
  minNeckAngleDeg: number;
  durationMs: number;
}

export interface LiveFeedback {
  phase: RepPhase;
  trackingOk: boolean;
  elbowAngleDeg: number;
  hipStraightnessDeg: number;
  cue: FormIssue | 'GOOD_FORM' | null;
}

export interface PushUpThresholds {
  /** Elbow angle (deg) above which the arm counts as "locked out" / top of the rep. */
  elbowUpDeg: number;
  /**
   * Elbow angle (deg) that, once crossed on the way down, marks this as a genuine rep
   * attempt rather than noise near lockout. Crossing it guarantees the rep will be
   * counted (and scored) once the arm returns to `elbowUpDeg` - even if the user never
   * gets anywhere near `goodDepthElbowDeg`. Only movement that never reaches this bar
   * is discarded as a false start.
   */
  elbowAttemptDeg: number;
  /** Elbow angle (deg) a rep must reach at minimum to count as full depth. */
  goodDepthElbowDeg: number;
  /** shoulder-hip-ankle angle (deg); below this the torso counts as not straight (sag or pike). */
  minHipStraightnessDeg: number;
  /** elbow-shoulder-hip angle (deg); above this the elbow counts as flared out. */
  maxElbowFlareDeg: number;
  /** ear-shoulder-hip angle (deg); below this the head/neck counts as misaligned. */
  minNeckAngleDeg: number;
  /** Minimum landmark visibility (0..1) required to trust a frame. */
  minVisibility: number;
}

export const DEFAULT_THRESHOLDS: PushUpThresholds = {
  elbowUpDeg: 160,
  elbowAttemptDeg: 140,
  goodDepthElbowDeg: 95,
  minHipStraightnessDeg: 160,
  maxElbowFlareDeg: 80,
  minNeckAngleDeg: 140,
  minVisibility: 0.5,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface RepAccumulator {
  startTimeMs: number;
  minElbowAngleDeg: number;
  minHipStraightnessDeg: number;
  maxElbowFlareDeg: number;
  minNeckAngleDeg: number;
  hipSagDeviationAtDeepest: number;
  deepestElbowAngleSoFar: number;
}

function freshAccumulator(timeMs: number): RepAccumulator {
  return {
    startTimeMs: timeMs,
    minElbowAngleDeg: Infinity,
    minHipStraightnessDeg: Infinity,
    maxElbowFlareDeg: -Infinity,
    minNeckAngleDeg: Infinity,
    hipSagDeviationAtDeepest: 0,
    deepestElbowAngleSoFar: Infinity,
  };
}

/**
 * A frame-by-frame push-up rep counter and form scorer.
 *
 * Feed it one MediaPipe pose per camera frame (ideally `worldLandmarks`, MediaPipe's
 * metric 3D landmarks, since those are far more stable across camera angles than
 * image-space coordinates). It runs a small state machine over the elbow angle to
 * detect rep phases, and while a rep is in progress it tracks hip/elbow/neck angles
 * to catch the most common push-up form mistakes. When a rep completes it is scored
 * 0-100 and handed back together with which mistakes (if any) were detected.
 */
export class PushUpAnalyzer {
  private phase: RepPhase = 'up';
  private repIndex = 0;
  private acc: RepAccumulator | null = null;
  private readonly thresholds: PushUpThresholds;

  constructor(thresholds: Partial<PushUpThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  reset(): void {
    this.phase = 'up';
    this.repIndex = 0;
    this.acc = null;
  }

  getPhase(): RepPhase {
    return this.phase;
  }

  /**
   * Process one frame. Returns the live feedback for this frame, plus a completed
   * `RepResult` when this frame closed out a rep. Returns `trackingOk: false` in the
   * live feedback (and no rep updates) when the pose isn't confidently visible enough
   * to trust, e.g. the user stepped partly out of frame.
   */
  processFrame(pose: Pose, timestampMs: number): { live: LiveFeedback; completedRep: RepResult | null } {
    const t = this.thresholds;
    const side = pickMoreVisibleSide(pose);
    const idx = sideIndices(side);

    if (!allVisible(pose, [idx.ear, idx.shoulder, idx.elbow, idx.wrist, idx.hip, idx.ankle], t.minVisibility)) {
      return {
        live: { phase: this.phase, trackingOk: false, elbowAngleDeg: 0, hipStraightnessDeg: 0, cue: null },
        completedRep: null,
      };
    }

    const ear = getLandmark(pose, idx.ear)!;
    const shoulder = getLandmark(pose, idx.shoulder)!;
    const elbow = getLandmark(pose, idx.elbow)!;
    const wrist = getLandmark(pose, idx.wrist)!;
    const hip = getLandmark(pose, idx.hip)!;
    const ankle = getLandmark(pose, idx.ankle)!;

    const elbowAngleDeg = angleAtPoint(shoulder, elbow, wrist);
    const hipStraightnessDeg = angleAtPoint(shoulder, hip, ankle);
    const elbowFlareDeg = angleAtPoint(elbow, shoulder, hip);
    const neckAngleDeg = angleAtPoint(ear, shoulder, hip);
    const hipSagDeviation = signedPerpendicularDeviation2D(shoulder, ankle, hip);

    let completedRep: RepResult | null = null;

    switch (this.phase) {
      case 'up':
        if (elbowAngleDeg < t.elbowUpDeg) {
          this.phase = 'descending';
          this.acc = freshAccumulator(timestampMs);
        }
        break;

      case 'descending':
        if (elbowAngleDeg <= t.elbowAttemptDeg) {
          this.phase = 'down';
        } else if (elbowAngleDeg >= t.elbowUpDeg) {
          // Went back up without ever committing to a real attempt: noise near lockout, discard.
          this.phase = 'up';
          this.acc = null;
        }
        break;

      case 'down':
        if (elbowAngleDeg > t.elbowAttemptDeg) {
          this.phase = 'ascending';
        }
        break;

      case 'ascending':
        if (elbowAngleDeg <= t.elbowAttemptDeg) {
          this.phase = 'down';
        } else if (elbowAngleDeg >= t.elbowUpDeg) {
          completedRep = this.finishRep(timestampMs);
          this.phase = 'up';
        }
        break;
    }

    if (this.acc && this.phase !== 'up') {
      this.acc.minElbowAngleDeg = Math.min(this.acc.minElbowAngleDeg, elbowAngleDeg);
      this.acc.minHipStraightnessDeg = Math.min(this.acc.minHipStraightnessDeg, hipStraightnessDeg);
      this.acc.maxElbowFlareDeg = Math.max(this.acc.maxElbowFlareDeg, elbowFlareDeg);
      this.acc.minNeckAngleDeg = Math.min(this.acc.minNeckAngleDeg, neckAngleDeg);
      if (elbowAngleDeg < this.acc.deepestElbowAngleSoFar) {
        this.acc.deepestElbowAngleSoFar = elbowAngleDeg;
        this.acc.hipSagDeviationAtDeepest = hipSagDeviation;
      }
    }

    const cue = this.liveCue(hipStraightnessDeg, elbowFlareDeg, neckAngleDeg);

    return {
      live: { phase: this.phase, trackingOk: true, elbowAngleDeg, hipStraightnessDeg, cue },
      completedRep,
    };
  }

  private liveCue(hipStraightnessDeg: number, elbowFlareDeg: number, neckAngleDeg: number): LiveFeedback['cue'] {
    if (this.phase === 'up') return null;
    const t = this.thresholds;
    if (hipStraightnessDeg < t.minHipStraightnessDeg) {
      return 'HIPS_SAGGING';
    }
    if (elbowFlareDeg > t.maxElbowFlareDeg) {
      return 'ELBOWS_FLARED';
    }
    if (neckAngleDeg < t.minNeckAngleDeg) {
      return 'HEAD_MISALIGNED';
    }
    return 'GOOD_FORM';
  }

  private finishRep(timestampMs: number): RepResult {
    const t = this.thresholds;
    const acc = this.acc!;
    const issues: FormIssue[] = [];
    let score = 100;

    if (acc.minElbowAngleDeg > t.goodDepthElbowDeg) {
      const deficit = acc.minElbowAngleDeg - t.goodDepthElbowDeg;
      score -= clamp(deficit * 1.5, 0, 40);
      issues.push('INSUFFICIENT_DEPTH');
    }

    if (acc.minHipStraightnessDeg < t.minHipStraightnessDeg) {
      const deficit = t.minHipStraightnessDeg - acc.minHipStraightnessDeg;
      score -= clamp(deficit * 1.2, 0, 35);
      issues.push(acc.hipSagDeviationAtDeepest >= 0 ? 'HIPS_SAGGING' : 'HIPS_PIKING');
    }

    if (acc.maxElbowFlareDeg > t.maxElbowFlareDeg) {
      const deficit = acc.maxElbowFlareDeg - t.maxElbowFlareDeg;
      score -= clamp(deficit * 0.8, 0, 20);
      issues.push('ELBOWS_FLARED');
    }

    if (acc.minNeckAngleDeg < t.minNeckAngleDeg) {
      const deficit = t.minNeckAngleDeg - acc.minNeckAngleDeg;
      score -= clamp(deficit * 0.5, 0, 15);
      issues.push('HEAD_MISALIGNED');
    }

    const result: RepResult = {
      index: this.repIndex++,
      formScore: Math.round(clamp(score, 0, 100)),
      issues,
      minElbowAngleDeg: Math.round(acc.minElbowAngleDeg),
      minHipStraightnessDeg: Math.round(acc.minHipStraightnessDeg),
      maxElbowFlareDeg: Math.round(acc.maxElbowFlareDeg),
      minNeckAngleDeg: Math.round(acc.minNeckAngleDeg),
      durationMs: timestampMs - acc.startTimeMs,
    };

    this.acc = null;
    return result;
  }
}
