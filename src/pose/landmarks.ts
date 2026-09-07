import { PoseLandmarkIndex, type PoseLandmark } from './blazePoseLandmarks';

/** A single frame's pose result: 33 BlazePose landmarks. */
export type Pose = PoseLandmark[];

export type Point3D = { x: number; y: number; z?: number };

/** Which side of the body we're using for angle math this frame ("left"/"right" as seen from the landmark data, i.e. the subject's actual left/right). */
export type BodySide = 'left' | 'right';

const MIN_VISIBILITY = 0.5;

/**
 * react-native-mediapipe's native bridge (see its ConvertHelpers.kt, both
 * normalizedLandmarkToWritableMap and landmarkToWritableMap) never actually copies
 * MediaPipe's per-landmark visibility/presence score into the object it hands to JS -
 * every landmark's `visibility` is always `undefined` here, for every frame, on both
 * `landmarks` and `worldLandmarks`. Treating that as "0 = not visible" (as this used to)
 * made `allVisible()` fail on literally every frame, so no rep was ever counted no
 * matter how clean the push-up was. Defaulting missing data to "visible" instead makes
 * this check a no-op given what this library actually sends today, while still
 * correctly gating out genuinely low-confidence landmarks if a future version (or a
 * patched one) starts populating real values.
 */
function visibility(landmark: PoseLandmark | undefined): number {
  return landmark?.visibility ?? 1;
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
const LEFT_SIDE_ARM = [
  PoseLandmarkIndex.leftShoulder,
  PoseLandmarkIndex.leftElbow,
  PoseLandmarkIndex.leftWrist,
  PoseLandmarkIndex.leftHip,
];
const RIGHT_SIDE_ARM = [
  PoseLandmarkIndex.rightShoulder,
  PoseLandmarkIndex.rightElbow,
  PoseLandmarkIndex.rightWrist,
  PoseLandmarkIndex.rightHip,
];

function sumVisibility(pose: Pose, indices: number[]): number {
  return indices.reduce((sum, i) => sum + visibility(getLandmark(pose, i)), 0);
}

function hasRealVisibilityData(pose: Pose, indices: number[]): boolean {
  return indices.some((i) => typeof getLandmark(pose, i)?.visibility === 'number');
}

/** Mean z of the given landmarks; smaller = closer to the camera in MediaPipe's convention. */
function meanDepth(pose: Pose, indices: number[]): number {
  let sum = 0;
  let count = 0;
  for (const i of indices) {
    const z = getLandmark(pose, i)?.z;
    if (typeof z === 'number' && Number.isFinite(z)) {
      sum += z;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

export function pickMoreVisibleSide(pose: Pose): BodySide {
  // Preferred signal, whenever the pose actually carries confidence scores.
  if (hasRealVisibilityData(pose, [...LEFT_SIDE_ARM, ...RIGHT_SIDE_ARM])) {
    const leftScore = sumVisibility(pose, LEFT_SIDE_ARM);
    const rightScore = sumVisibility(pose, RIGHT_SIDE_ARM);
    if (leftScore !== rightScore) {
      return rightScore > leftScore ? 'right' : 'left';
    }
  }

  // react-native-mediapipe never sends visibility (see the note on `visibility` above),
  // which made the score comparison a tie on every single frame and therefore always
  // picked 'right' - even when the user's left side was the one facing the camera, so
  // the arm being measured was the far, fully occluded one. MediaPipe still estimates
  // the occluded side, but from far less evidence. Fall back to depth instead: the side
  // nearer the camera is the better-observed one.
  const leftDepth = meanDepth(pose, LEFT_SIDE_ARM);
  const rightDepth = meanDepth(pose, RIGHT_SIDE_ARM);
  return rightDepth <= leftDepth ? 'right' : 'left';
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
