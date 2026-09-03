/**
 * Landmark indices for Google's BlazePose 33-point topology, the layout MediaPipe's
 * Pose Landmarker (and this app's pose engine) uses. Defined locally, independent of
 * react-native-mediapipe's own `KnownPoseLandmarks`, so that `src/pose/**` (the rep
 * counting and form-scoring logic) has no dependency on a native module and can be
 * unit tested in plain Node/Jest without a device or simulator.
 */
export const PoseLandmarkIndex = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** A single landmark, structurally identical to react-native-mediapipe's `Landmark`. */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}
