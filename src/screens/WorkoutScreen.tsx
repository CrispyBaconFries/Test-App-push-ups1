import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import {
  usePoseDetection,
  MediapipeCamera,
  RunningMode,
  Delegate,
  type PoseDetectionResultBundle,
  type ViewCoordinator,
  type DetectionError,
} from 'react-native-mediapipe';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { PushUpAnalyzer, type FormIssue, type LiveFeedback, type RepResult } from '../pose/formAnalysis';
import { SkeletonOverlay, type ViewPoint } from '../components/SkeletonOverlay';
import { RepHud } from '../components/RepHud';
import { buildSession, saveSession } from '../storage/workoutStorage';
import { colors } from '../theme/colors';

const POSE_MODEL = 'pose_landmarker_lite.task';
/** Only rebuild the on-screen skeleton every Nth pose result; the rep/form logic still runs every frame. */
const OVERLAY_FRAME_SKIP = 2;

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;

export function WorkoutScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const analyzerRef = useRef(new PushUpAnalyzer());
  const startedAtRef = useRef(new Date().toISOString());
  const frameCounterRef = useRef(0);
  const repsRef = useRef<RepResult[]>([]);

  const [repCount, setRepCount] = useState(0);
  const [lastRep, setLastRep] = useState<RepResult | null>(null);
  const [live, setLive] = useState<LiveFeedback | null>(null);
  const [skeletonPoints, setSkeletonPoints] = useState<ViewPoint[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Mirrors `finishing`, but read synchronously inside the `beforeRemove` listener
  // below: state updates aren't visible in already-created closures until React
  // re-renders and the effect re-subscribes, which isn't guaranteed to happen before
  // `finishWorkout`'s own `navigation.replace()` call re-triggers that same listener.
  const finishingRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const onResults = useCallback((result: PoseDetectionResultBundle, vc: ViewCoordinator) => {
    const bundle = result.results[0];
    const imageLandmarks = bundle?.landmarks?.[0];
    const worldLandmarks = bundle?.worldLandmarks?.[0];

    if (!imageLandmarks || !worldLandmarks) {
      setSkeletonPoints(null);
      setLive((prev) => (prev ? { ...prev, trackingOk: false } : prev));
      return;
    }

    const { live: liveResult, completedRep } = analyzerRef.current.processFrame(worldLandmarks, Date.now());
    setLive(liveResult);

    if (completedRep) {
      repsRef.current = [...repsRef.current, completedRep];
      setLastRep(completedRep);
      setRepCount(repsRef.current.length);
      Haptics.impactAsync(
        completedRep.issues.length === 0 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
    }

    frameCounterRef.current += 1;
    if (frameCounterRef.current % OVERLAY_FRAME_SKIP === 0) {
      const frameDims = vc.getFrameDims(result);
      const points = imageLandmarks.map((lm) => vc.convertPoint(frameDims, { x: lm.x, y: lm.y }));
      setSkeletonPoints(points);
    }
  }, []);

  const onError = useCallback((error: DetectionError) => {
    console.warn('[WorkoutScreen] pose detection error', error.code, error.message);
  }, []);

  const solution = usePoseDetection({ onResults, onError }, RunningMode.LIVE_STREAM, POSE_MODEL, {
    delegate: Delegate.GPU,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    mirrorMode: 'mirror-front-only',
  });

  const finishWorkout = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (repsRef.current.length === 0) {
      // Nothing done yet - don't clutter the Trainingsverlauf with an empty session.
      navigation.goBack();
      return;
    }
    setFinishing(true);
    const session = buildSession(repsRef.current, startedAtRef.current, new Date().toISOString());
    await saveSession(session);
    navigation.replace('Summary', { session });
  }, [navigation]);

  // Leaving this screen (Android back button/gesture, or the in-app "Zurück" button -
  // both dispatch the same navigation event) used to discard any reps done so far
  // without saving. Results should never be thrown away, so any exit with at least one
  // completed rep now saves and finishes the workout instead of just backing out -
  // "Zurück" mid-session behaves exactly like tapping "Workout beenden". Skipped once
  // finishWorkout is already under way (its own navigation.replace() re-triggers this
  // same listener) and when there's nothing yet to save.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (finishingRef.current || repsRef.current.length === 0) return;
      e.preventDefault();
      finishWorkout();
    });
  }, [navigation, finishWorkout]);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          Diese App benötigt Zugriff auf die Frontkamera, um deine Liegestütz-Form live zu analysieren.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Kamerazugriff erlauben</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const activeIssue: FormIssue | null = live && live.cue && live.cue !== 'GOOD_FORM' ? live.cue : null;

  return (
    <View style={styles.container}>
      <MediapipeCamera style={StyleSheet.absoluteFill} solution={solution} activeCamera="front" resizeMode="cover" />

      <SkeletonOverlay
        width={solution.cameraViewDimensions.width}
        height={solution.cameraViewDimensions.height}
        points={skeletonPoints}
        activeIssue={activeIssue}
      />

      <RepHud repCount={repCount} live={live} lastRep={lastRep} trackingOk={live?.trackingOk ?? true} />

      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.iconButtonText}>Zurück</Text>
      </Pressable>

      <Pressable style={styles.finishButton} onPress={finishWorkout} disabled={finishing}>
        <Text style={styles.primaryButtonText}>Workout beenden</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0B0F14',
    fontSize: 16,
    fontWeight: '800',
  },
  linkButton: {
    marginTop: 16,
    padding: 8,
  },
  linkButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  finishButton: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  backButton: {
    position: 'absolute',
    bottom: 44,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
