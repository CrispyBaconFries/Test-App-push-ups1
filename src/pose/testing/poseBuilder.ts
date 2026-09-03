import { PoseLandmarkIndex, type PoseLandmark } from '../blazePoseLandmarks';
import type { BodySide, Pose } from '../landmarks';

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

type Vec2 = { x: number; y: number };

function rotate(v: Vec2, angleDeg: number): Vec2 {
  const r = deg2rad(angleDeg);
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export interface SyntheticFrameParams {
  /** angleAtPoint(shoulder, elbow, wrist), degrees. 180 = straight arm, ~90 = deep bend. */
  elbowAngleDeg: number;
  /** angleAtPoint(elbow, shoulder, hip), degrees. Small = tucked, large = flared. */
  flareDeg?: number;
  /** angleAtPoint(ear, shoulder, hip), degrees. ~180 = neutral neck. */
  neckAngleDeg?: number;
  /** How far the hip point deviates off the shoulder-ankle line. 0 = perfectly straight, positive = sag, negative = pike. */
  hipOffsetY?: number;
  /** Landmark visibility for the tracked side; set low to simulate the user stepping out of frame. */
  visibility?: number;
  /** Which side of the body to populate. Defaults to 'right' (pickMoreVisibleSide will pick it, since the other side is left at 0 visibility). */
  side?: BodySide;
}

/**
 * Builds a synthetic 33-point pose (only one side populated, 'right' by default -
 * `pickMoreVisibleSide` will therefore always pick that side) that produces *exactly*
 * the requested elbow, flare and neck angles by construction, so tests can assert on
 * precise thresholds without having to reverse-engineer real body coordinates.
 */
export function buildFrame(params: SyntheticFrameParams): Pose {
  const { elbowAngleDeg, flareDeg = 30, neckAngleDeg = 175, hipOffsetY = 0, visibility = 1, side = 'right' } = params;

  const shoulder: Vec2 = { x: 0, y: 0 };
  const hipDir: Vec2 = { x: 1, y: 0 };
  const hip: Vec2 = { x: 1, y: hipOffsetY };
  const ankle: Vec2 = { x: 2, y: 0 };

  const upperArmDir = rotate(hipDir, -flareDeg);
  const elbow = add(shoulder, scale(upperArmDir, 1));
  const elbowToShoulderDir = scale(upperArmDir, -1);
  const forearmDir = rotate(elbowToShoulderDir, elbowAngleDeg);
  const wrist = add(elbow, scale(forearmDir, 1));

  const earDir = rotate(hipDir, neckAngleDeg);
  const ear = add(shoulder, scale(earDir, 0.3));

  const pose: PoseLandmark[] = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const set = (index: number, p: Vec2) => {
    pose[index] = { x: p.x, y: p.y, z: 0, visibility };
  };
  const i = side === 'left'
    ? {
        ear: PoseLandmarkIndex.leftEar,
        shoulder: PoseLandmarkIndex.leftShoulder,
        elbow: PoseLandmarkIndex.leftElbow,
        wrist: PoseLandmarkIndex.leftWrist,
        hip: PoseLandmarkIndex.leftHip,
        ankle: PoseLandmarkIndex.leftAnkle,
        knee: PoseLandmarkIndex.leftKnee,
      }
    : {
        ear: PoseLandmarkIndex.rightEar,
        shoulder: PoseLandmarkIndex.rightShoulder,
        elbow: PoseLandmarkIndex.rightElbow,
        wrist: PoseLandmarkIndex.rightWrist,
        hip: PoseLandmarkIndex.rightHip,
        ankle: PoseLandmarkIndex.rightAnkle,
        knee: PoseLandmarkIndex.rightKnee,
      };
  set(i.ear, ear);
  set(i.shoulder, shoulder);
  set(i.elbow, elbow);
  set(i.wrist, wrist);
  set(i.hip, hip);
  set(i.ankle, ankle);
  set(i.knee, { x: 1.5, y: 0 });

  return pose;
}

/**
 * Overlays `overrides`'s populated landmarks onto `base`, keeping everything else from
 * `base`. Used to build a single frame with *both* sides present at once (e.g. one side
 * visible-but-bad-form, the other visible-but-good-form), for tests that need to prove
 * side selection doesn't flip-flop mid-rep.
 */
export function mergePoses(base: Pose, overrides: Pose): Pose {
  return base.map((landmark, i) => (overrides[i] && overrides[i].visibility ? overrides[i] : landmark));
}
