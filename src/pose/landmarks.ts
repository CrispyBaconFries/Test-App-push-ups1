import { PoseLandmarkIndex, type PoseLandmark } from './blazePoseLandmarks';

/** A single frame's pose result: 33 BlazePose landmarks. */
export type Pose = PoseLandmark[];

export type Point3D = { x: number; y: number; z?: number };

/** Which side of the body we're using for angle math this frame ("left"/"right" as seen from the landmark data, i.e. the subject's actual left/right). */
export type BodySide = 'left' | 'right';

const MIN_VISIBILITY = 0.5;

function visibility(landmark: PoseLandmark | undefined): number {
  return landmark?.visibility ?? 0;
}

export function getLandmark(pose: Pose, index: number): PoseLandmark | undefined {
  return pose[index];
}

/**
 * The camera faces the user head-on, so one side of the body is often partially
 * occluded (e.g. the far arm hidden behind the torso). Pick whichever side MediaPipe
 * is currently more confident about, using shoulder+elbow+wrist+hip visibility as a
 * proxy for "is this side usable for angle math right now".
 */
export function pickMoreVisibleSide(pose: Pose): BodySide {
  const leftScore =
    visibility(getLandmark(pose, PoseLandmarkIndex.leftShoulder)) +
    visibility(getLandmark(pose, PoseLandmarkIndex.leftElbow)) +
    visibility(getLandmark(pose, PoseLandmarkIndex.leftWrist)) +
    visibility(getLandmark(pose, PoseLandmarkIndex.leftHip));
  const rightScore =
    visibility(getLandmark(pose, PoseLandmarkIndex.rightShoulder)) +
    visibility(getLandmark(pose, PoseLandmarkIndex.rightElbow)) +
    visibility(getLandmark(pose, PoseLandmarkIndex.rightWrist)) +
    visibility(getLandmark(pose, PoseLandmarkIndex.rightHip));
  return rightScore >= leftScore ? 'right' : 'left';
}

export type SideLandmarkIndices = {
  ear: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  hip: number;
  knee: number;
  ankle: number;
};

export function sideIndices(side: BodySide): SideLandmarkIndices {
  return side === 'left'
    ? {
        ear: PoseLandmarkIndex.leftEar,
        shoulder: PoseLandmarkIndex.leftShoulder,
        elbow: PoseLandmarkIndex.leftElbow,
        wrist: PoseLandmarkIndex.leftWrist,
        hip: PoseLandmarkIndex.leftHip,
        knee: PoseLandmarkIndex.leftKnee,
        ankle: PoseLandmarkIndex.leftAnkle,
      }
    : {
        ear: PoseLandmarkIndex.rightEar,
        shoulder: PoseLandmarkIndex.rightShoulder,
        elbow: PoseLandmarkIndex.rightElbow,
        wrist: PoseLandmarkIndex.rightWrist,
        hip: PoseLandmarkIndex.rightHip,
        knee: PoseLandmarkIndex.rightKnee,
        ankle: PoseLandmarkIndex.rightAnkle,
      };
}

/**
 * Interior angle at point `b`, formed by rays b->a and b->c, in degrees [0..180].
 * Works in 2D or 3D (z defaults to 0), so it's used both for image-space landmarks
 * (overlay drawing) and for MediaPipe's metric `worldLandmarks` (form analysis, where
 * true 3D angles are far less sensitive to camera perspective than image-space ones).
 */
export function angleAtPoint(a: Point3D, b: Point3D, c: Point3D): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = (a.z ?? 0) - (b.z ?? 0);
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = (c.z ?? 0) - (b.z ?? 0);
  const abLen = Math.hypot(abx, aby, abz);
  const cbLen = Math.hypot(cbx, cby, cbz);
  if (abLen === 0 || cbLen === 0) return 0;
  const cos = (abx * cbx + aby * cby + abz * cbz) / (abLen * cbLen);
  const clamped = Math.min(1, Math.max(-1, cos));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * Signed perpendicular distance of `p` from the line through `from`->`to`, projected
 * onto the 2D plane (x,y) and normalized by the line's own length. Used to tell hip
 * *sag* from hip *pike* around the shoulder-ankle plank line, not just "how bent".
 * Positive = p is below the line (larger y, since image/world y grows downward-ish);
 * negative = above it.
 */
export function signedPerpendicularDeviation2D(from: Point3D, to: Point3D, p: Point3D): number {
  const lineX = to.x - from.x;
  const lineY = to.y - from.y;
  const lineLen = Math.hypot(lineX, lineY);
  if (lineLen === 0) return 0;
  const px = p.x - from.x;
  const py = p.y - from.y;
  // z-component of the 2D cross product (line x p), normalized -> signed distance.
  return (lineX * py - lineY * px) / lineLen;
}

/** Are all given landmarks confidently visible? Used to skip frames with unreliable tracking. */
export function allVisible(pose: Pose, indices: number[], minVisibility = MIN_VISIBILITY): boolean {
  return indices.every((i) => visibility(getLandmark(pose, i)) >= minVisibility);
}
