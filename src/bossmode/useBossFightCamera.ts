import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeEventEmitter, NativeModules, type LayoutChangeEvent } from 'react-native';
import {
  VisionCameraProxy,
  useCameraDevice,
  useCameraPermission,
  useSkiaFrameProcessor,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import { Skia, ColorType, AlphaType, BlendMode } from '@shopify/react-native-skia';
import {
  Delegate,
  RunningMode,
  BaseViewCoordinator,
  type PoseDetectionResultBundle,
  type DetectionError,
  type ViewCoordinator,
} from 'react-native-mediapipe';

const POSE_MODEL = 'pose_landmarker_lite.task';
/** Input/output resolution of Google's selfie_segmenter.tflite (verified directly against the downloaded model, not guessed). */
const SEGMENTATION_SIZE = 256;

const { PoseDetection } = NativeModules;
const poseEventEmitter = new NativeEventEmitter(PoseDetection);

/**
 * Same Frame Processor Plugin name react-native-mediapipe registers internally for its
 * own `usePoseDetection()` hook (see node_modules/react-native-mediapipe/src/poseDetection/index.ts).
 * Reused directly here rather than going through that hook, because a `<Camera>` can only
 * have *one* frame processor at a time, and this screen needs both pose detection (for
 * rep counting, exactly like every other screen) *and* the Skia-based person-segmentation
 * compositing below to run from that single processor. See README "Boss-Modus" for why
 * react-native-mediapipe's own (broken) segmentation-mask output couldn't be used instead.
 *
 * This does mean relying on an implementation detail (the "poseDetection" plugin name and
 * the shape of the native `PoseDetection` module) rather than a documented public API - if
 * a future react-native-mediapipe upgrade renames/restructures either, this file needs a
 * matching update.
 */
const posePlugin = VisionCameraProxy.initFrameProcessorPlugin('poseDetection', {});

export interface BossFightCameraCallbacks {
  onPoseResults: (result: PoseDetectionResultBundle, vc: ViewCoordinator) => void;
  onError: (error: DetectionError) => void;
}

export interface BossFightCamera {
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  device: ReturnType<typeof useCameraDevice>;
  frameProcessor: ReturnType<typeof useSkiaFrameProcessor>;
  cameraViewLayoutChangeHandler: (event: LayoutChangeEvent) => void;
  cameraViewDimensions: { width: number; height: number };
  /** False until the segmentation model has finished loading - the cutout silently
   * degrades to "no cutout, just the mirrored camera image" until then rather than
   * showing nothing. */
  segmentationReady: boolean;
}

/**
 * Drives the Boss-Modus camera: pose detection for rep counting (identical to every
 * other screen) plus a Skia frame processor that composites a person cutout - built
 * from Google's standalone "selfie segmenter" TFLite model, *not* from
 * react-native-mediapipe (see module comment above) - over a transparent background, so
 * a plain React Native view placed behind the `<Camera>` (the boss) shows through
 * wherever the mask says "not a person".
 */
export function useBossFightCamera(callbacks: BossFightCameraCallbacks): BossFightCamera {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const { resize } = useResizePlugin();
  const segmentationModel = useTensorflowModel(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../assets/models/selfie_segmenter.tflite'),
    []
  );

  const [cameraViewDimensions, setCameraViewDimensions] = useState({ width: 1, height: 1 });
  const [detectorHandle, setDetectorHandle] = useState<number | undefined>(undefined);

  // Stable ref so the frame processor / event listener below don't need to be
  // recreated every time the caller passes new callback identities.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Fixed front-camera/portrait/cover setup (this screen never rotates or switches
  // cameras, unlike the general-purpose `usePoseDetection()` hook) - so a single,
  // static coordinator is enough; no need to replicate that hook's dynamic
  // orientation-change tracking.
  const viewCoordinator = useMemo(
    () => new BaseViewCoordinator(cameraViewDimensions, true, 'portrait', 'portrait', 'cover'),
    [cameraViewDimensions]
  );

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Mirrors what `usePoseDetection()` does internally to create/release a native
  // detector - see module comment for why this can't just be that hook.
  useEffect(() => {
    let handle: number | undefined;
    let cancelled = false;
    PoseDetection.createDetector(
      1, // numPoses
      0.5, // minPoseDetectionConfidence
      0.5, // minPosePresenceConfidence
      0.5, // minTrackingConfidence
      false, // shouldOutputSegmentationMasks - always empty in this library version regardless (see README), no reason to pay for computing it
      POSE_MODEL,
      Delegate.GPU,
      RunningMode.LIVE_STREAM
    )
      .then((newHandle: number) => {
        if (cancelled) {
          PoseDetection.releaseDetector(newHandle);
          return;
        }
        handle = newHandle;
        setDetectorHandle(newHandle);
      })
      .catch((e: unknown) => console.error('[useBossFightCamera] createDetector failed', e));

    return () => {
      cancelled = true;
      if (handle !== undefined) PoseDetection.releaseDetector(handle);
    };
  }, []);

  useEffect(() => {
    if (detectorHandle === undefined) return;
    const resultsSub = poseEventEmitter.addListener(
      'onResults',
      (args: { handle: number } & PoseDetectionResultBundle) => {
        if (args.handle !== detectorHandle) return;
        callbacksRef.current.onPoseResults(args, viewCoordinator);
      }
    );
    const errorSub = poseEventEmitter.addListener('onError', (args: { handle: number } & DetectionError) => {
      if (args.handle !== detectorHandle) return;
      callbacksRef.current.onError(args);
    });
    return () => {
      resultsSub.remove();
      errorSub.remove();
    };
  }, [detectorHandle, viewCoordinator]);

  // VisionCamera v4's worklet runtime (react-native-worklets-core) can't access a
  // Nitro `jsi::NativeState` (the TfliteModel) directly - it must be boxed into a
  // jsi::HostObject before capture, then unboxed inside the worklet. This is the
  // officially documented pattern for react-native-fast-tflite + VisionCamera v4 (see
  // node_modules/react-native-fast-tflite/README.md, "Usage (VisionCamera)").
  const boxedModel = useMemo(
    () => (segmentationModel.state === 'loaded' ? NitroModules.box(segmentationModel.model) : undefined),
    [segmentationModel.state, segmentationModel.model]
  );

  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      'worklet';

      // 1. Rep counting - identical pose detection to every other screen. Results
      // arrive asynchronously via the event listener above, not synchronously here.
      if (detectorHandle !== undefined) {
        posePlugin?.call(frame, { detectorHandle, orientation: 'portrait' });
      }

      // 2. Person-segmentation cutout, composited over a transparent canvas so the
      // boss (a plain RN view rendered *behind* this <Camera>) shows through anywhere
      // the mask says "not a person". The model only ever saw a centered square crop
      // of the frame (see resize() call below), so the cutout is limited to that same
      // square - the square is centered, so mirroring it around the frame's full width
      // lands it in the same place, no extra offset math needed.
      const squareSize = Math.min(frame.width, frame.height);
      const squareX = (frame.width - squareSize) / 2;
      const squareY = (frame.height - squareSize) / 2;
      const srcSquare = Skia.XYWHRect(squareX, squareY, squareSize, squareSize);
      const dstSquare = srcSquare;

      frame.save();
      // Mirror horizontally for a natural "selfie" view - matches `mirrored: true`
      // passed to BaseViewCoordinator above, so the skeleton overlay lines up with it.
      frame.translate(frame.width, 0);
      frame.scale(-1, 1);

      if (boxedModel == null) {
        // Model still loading - fall back to a plain (mirrored, cropped-to-square)
        // camera image rather than showing nothing.
        frame.drawImageRect(frame.__skImage, srcSquare, dstSquare, Skia.Paint());
        frame.restore();
        return;
      }

      const tflite = boxedModel.unbox();

      const resized = resize(frame, {
        crop: { x: squareX, y: squareY, width: squareSize, height: squareSize },
        scale: { width: SEGMENTATION_SIZE, height: SEGMENTATION_SIZE },
        pixelFormat: 'rgb',
        dataType: 'float32',
      });
      // TypedArrays may have a non-zero byteOffset into a shared buffer - slice out
      // exactly the bytes belonging to this array (same pattern as the library's own
      // documented example).
      const inputBuffer = resized.buffer.slice(resized.byteOffset, resized.byteOffset + resized.byteLength) as ArrayBuffer;
      const outputs = tflite.runSync([inputBuffer]);
      const maskFloat = new Float32Array(outputs[0]!);

      const maskBytes = new Uint8Array(SEGMENTATION_SIZE * SEGMENTATION_SIZE);
      for (let i = 0; i < maskBytes.length; i++) {
        maskBytes[i] = Math.max(0, Math.min(255, Math.round(maskFloat[i]! * 255)));
      }
      const maskImage = Skia.Image.MakeImage(
        { width: SEGMENTATION_SIZE, height: SEGMENTATION_SIZE, colorType: ColorType.Alpha_8, alphaType: AlphaType.Opaque },
        Skia.Data.fromBytes(maskBytes),
        SEGMENTATION_SIZE
      );

      frame.saveLayer();
      frame.drawImageRect(frame.__skImage, srcSquare, dstSquare, Skia.Paint());
      if (maskImage != null) {
        // DstIn: keeps the existing layer content (the camera image just drawn) only
        // where this mask has alpha - i.e. only the "person" pixels survive.
        const maskPaint = Skia.Paint();
        maskPaint.setBlendMode(BlendMode.DstIn);
        frame.drawImageRect(maskImage, Skia.XYWHRect(0, 0, SEGMENTATION_SIZE, SEGMENTATION_SIZE), dstSquare, maskPaint);
      }
      frame.restore(); // saveLayer
      frame.restore(); // mirror transform
    },
    [detectorHandle, boxedModel, resize]
  );

  return {
    hasPermission,
    requestPermission,
    device,
    frameProcessor,
    cameraViewLayoutChangeHandler: (event: LayoutChangeEvent) => {
      setCameraViewDimensions({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
    },
    cameraViewDimensions,
    segmentationReady: boxedModel != null,
  };
}
