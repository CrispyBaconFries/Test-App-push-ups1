import React, { useMemo } from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { PoseLandmarkIndex } from '../pose/blazePoseLandmarks';
import type { FormIssue } from '../pose/formAnalysis';

export type ViewPoint = { x: number; y: number };

const { leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, nose, leftEar, rightEar } =
  PoseLandmarkIndex;

/** Curated bones for a push-up focused stick figure: head, torso and arms are what matter for form. Legs are drawn lighter, just for context. */
const CORE_BONES: [number, number][] = [
  [leftShoulder, rightShoulder],
  [leftShoulder, leftElbow],
  [leftElbow, leftWrist],
  [rightShoulder, rightElbow],
  [rightElbow, rightWrist],
  [leftShoulder, leftHip],
  [rightShoulder, rightHip],
  [leftHip, rightHip],
];

const LEG_BONES: [number, number][] = [
  [leftHip, leftKnee],
  [leftKnee, leftAnkle],
  [rightHip, rightKnee],
  [rightKnee, rightAnkle],
];

const HEAD_BONES: [number, number][] = [
  [nose, leftEar],
  [nose, rightEar],
  [leftEar, leftShoulder],
  [rightEar, rightShoulder],
];

const COLOR_OK = '#37E27C';
const COLOR_WARN = '#FF5A5F';
const COLOR_LEG = 'rgba(255,255,255,0.35)';
const COLOR_JOINT = '#FFFFFF';

const ISSUE_JOINTS: Record<FormIssue, number[]> = {
  INSUFFICIENT_DEPTH: [leftElbow, rightElbow],
  HIPS_SAGGING: [leftHip, rightHip],
  HIPS_PIKING: [leftHip, rightHip],
  ELBOWS_FLARED: [leftElbow, rightElbow],
  HEAD_MISALIGNED: [nose, leftEar, rightEar],
};

export interface SkeletonOverlayProps {
  width: number;
  height: number;
  points: ViewPoint[] | null;
  activeIssue: FormIssue | null;
}

export function SkeletonOverlay({ width, height, points, activeIssue }: SkeletonOverlayProps) {
  const highlightedJoints = useMemo(
    () => new Set(activeIssue ? ISSUE_JOINTS[activeIssue] : []),
    [activeIssue]
  );

  if (!points || points.length === 0) {
    return null;
  }

  const boneColor = activeIssue ? COLOR_WARN : COLOR_OK;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      {LEG_BONES.map(([a, b], i) => (
        <BoneLine key={`leg-${i}`} points={points} a={a} b={b} color={COLOR_LEG} strokeWidth={3} />
      ))}
      {CORE_BONES.map(([a, b], i) => (
        <BoneLine key={`core-${i}`} points={points} a={a} b={b} color={boneColor} strokeWidth={5} />
      ))}
      {HEAD_BONES.map(([a, b], i) => (
        <BoneLine key={`head-${i}`} points={points} a={a} b={b} color={boneColor} strokeWidth={4} />
      ))}
      {/* Dedupe: shoulders appear in both CORE_BONES and HEAD_BONES, and mapping them
          twice would render two overlapping <Circle>s with the same React key. */}
      {[...new Set([...CORE_BONES.flat(), ...HEAD_BONES.flat()])].map((index) => {
        const p = points[index];
        if (!p) return null;
        const isWarn = highlightedJoints.has(index);
        return (
          <Circle
            key={`joint-${index}`}
            cx={p.x}
            cy={p.y}
            r={isWarn ? 8 : 5}
            fill={isWarn ? COLOR_WARN : COLOR_JOINT}
          />
        );
      })}
    </Svg>
  );
}

function BoneLine({
  points,
  a,
  b,
  color,
  strokeWidth,
}: {
  points: ViewPoint[];
  a: number;
  b: number;
  color: string;
  strokeWidth: number;
}) {
  const pa = points[a];
  const pb = points[b];
  if (!pa || !pb) return null;
  return <Line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />;
}
