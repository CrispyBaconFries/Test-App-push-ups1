import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { PushUpAnalyzer, type FormIssue, type LiveFeedback, type RepResult } from '../pose/formAnalysis';
import { SkeletonOverlay, type ViewPoint } from '../components/SkeletonOverlay';
import { RepHud } from '../components/RepHud';
import { useRepSounds } from '../audio/repSounds';
import { buildSession, computeStats, loadSessions, saveSession } from '../storage/workoutStorage';
import { computeBadgeStatuses, newlyUnlockedBadges } from '../gamification/badges';
import { computeMissions } from '../gamification/missions';
import { claimCompletedMissions } from '../gamification/currencyStore';
import { loadDuelLog } from '../duel/duelLog';
import { syncLeaderboardProgress } from '../ranking/leaderboardSync';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const POSE_MODEL = 'pose_landmarker_lite.task';
/** Only rebuild the on-screen skeleton every Nth pose result; the rep/form logic still runs every frame. */
const OVERLAY_FRAME_SKIP = 2;

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;

export function WorkoutScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const auth = useAuth();
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
  // Sound only, deliberately no vibration (see README) - kept in a ref so `onResults`
  // (a stable-identity useCallback below) always calls the latest player instances
  // without needing them in its dependency array.
  const playRepSound = useRepSounds();
  const playRepSoundRef = useRef(playRepSound);
  playRepSoundRef.current = playRepSound;

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
      playRepSoundRef.current(completedRep.issues.length === 0);
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
    const previousSessions = await loadSessions();
    const previousStats = computeStats(previousSessions);
    const badgesBefore = computeBadgeStatuses(previousStats, previousSessions);

    const session = buildSession(repsRef.current, startedAtRef.current, new Date().toISOString(), 'training');
    await saveSession(session);

    // Bewusst nicht awaited - ein Netzwerkproblem beim Online-Rangliste-Sync darf das
    // Beenden des Workouts nicht verzögern (siehe leaderboardSync.ts).
    syncLeaderboardProgress(auth.profile, session.totalReps).catch(() => {});

    const allSessions = [session, ...previousSessions];
    const badgesAfter = computeBadgeStatuses(computeStats(allSessions), allSessions);
    const newBadges = newlyUnlockedBadges(badgesBefore, badgesAfter);

    // Only a "record" if there was a previous best to actually beat - on the very first
    // session ever, trivially "beating" a baseline of 0 isn't a meaningful record.
    const hasHistory = previousSessions.length > 0;
    const newBestReps = hasHistory && session.totalReps > previousStats.bestSessionReps;
    const newBestFormScore = hasHistory && session.averageFormScore > previousStats.bestAverageFormScore;

    // `claimCompletedMissions` only ever pays out a given mission once per day/week
    // (see currencyStore.ts), so it's safe to call here even though HomeScreen also
    // calls it on every focus - whichever runs first gets the "newly completed" credit.
    const duelLog = await loadDuelLog();
    const missions = computeMissions({ sessions: allSessions, duelLog, appOpenedToday: true });
    const { coinsEarned, newlyCompleted: newlyCompletedMissions } = await claimCompletedMissions(missions);

    navigation.replace('Summary', { session, newBadges, newBestReps, newBestFormScore, coinsEarned, newlyCompletedMissions });
  }, [navigation, auth.profile]);

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
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={requestPermission}
        >
          <Text style={styles.primaryButtonText}>Kamerazugriff erlauben</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
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

      <Pressable
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
        <Text style={styles.iconButtonText}>Zurück</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.finishButton, pressed && styles.pressed]}
        onPress={finishWorkout}
        disabled={finishing}
      >
        <Ionicons name="checkmark-circle" size={18} color="#0B0F14" />
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    color: '#0B0F14',
    fontSize: 16,
  },
  linkButton: {
    marginTop: 16,
    padding: 8,
  },
  linkButtonText: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 14,
  },
  finishButton: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  backButton: {
    position: 'absolute',
    bottom: 44,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  iconButtonText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
