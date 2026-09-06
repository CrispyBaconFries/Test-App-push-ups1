import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { PushUpAnalyzer, type FormIssue } from '../pose/formAnalysis';
import { SkeletonOverlay, type ViewPoint } from '../components/SkeletonOverlay';
import { RankFrame } from '../components/RankFrame';
import { useRepSounds } from '../audio/repSounds';
import {
  DUEL_DURATION_MS,
  duelStartInLocalTime,
  estimateServerOffsetMs,
  listenToDuel,
  setPlayerReady,
  submitFinalResult,
  submitLiveRepCount,
  type DuelPlayerState,
} from '../duel/duelSession';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const POSE_MODEL = 'pose_landmarker_lite.task';
const OVERLAY_FRAME_SKIP = 2;

type Props = NativeStackScreenProps<RootStackParamList, 'Duel'>;

type Phase = 'waitingOpponent' | 'countdown' | 'running' | 'finished';

export function DuelScreen({ route, navigation }: Props) {
  const { duelCode, me, isRanked } = route.params;
  const { hasPermission, requestPermission } = useCameraPermission();

  const analyzerRef = useRef(new PushUpAnalyzer());
  const repsRef = useRef(0);
  const finishedRef = useRef(false);
  const readySentRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('waitingOpponent');
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(DUEL_DURATION_MS);
  const [myReps, setMyReps] = useState(0);
  const [opponent, setOpponent] = useState<DuelPlayerState | null>(null);
  const [skeletonPoints, setSkeletonPoints] = useState<ViewPoint[] | null>(null);
  const [activeIssue, setActiveIssue] = useState<FormIssue | null>(null);

  const playRepSound = useRepSounds();
  const playRepSoundRef = useRef(playRepSound);
  playRepSoundRef.current = playRepSound;

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Sobald die Kamera bereit ist, den eigenen Spieler als bereit melden - beide
  // Geräte sind sich schon vorher in der Lobby begegnet (2 Spieler im Duell-Dokument),
  // hier geht es nur noch um den synchronisierten Start.
  useEffect(() => {
    if (hasPermission && !readySentRef.current) {
      readySentRef.current = true;
      setPlayerReady(duelCode, me.uid).catch(() => {});
    }
  }, [hasPermission, duelCode, me.uid]);

  // Zentrale Zustandsmaschine: hört auf das Duell-Dokument und leitet Countdown/Ende
  // aus dem *gemeinsamen* `startsAtServerTime` ab (nicht aus einem eigenen Timer-Start),
  // damit beide Geräte exakt dasselbe 60-Sekunden-Fenster in der realen Zeit sehen.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const unsubscribe = listenToDuel(duelCode, (state) => {
      if (!state) return;
      const opponentEntry = Object.entries(state.players).find(([uid]) => uid !== me.uid);
      if (opponentEntry) setOpponent(opponentEntry[1]);

      if (state.status === 'starting' && state.startsAtServerTime != null && !intervalId) {
        const localStart = duelStartInLocalTime(state.startsAtServerTime, estimateServerOffsetMs());
        intervalId = setInterval(() => {
          const untilStart = localStart - Date.now();
          if (untilStart > 0) {
            setPhase('countdown');
            setCountdownSeconds(Math.ceil(untilStart / 1000));
            return;
          }
          const elapsed = Date.now() - localStart;
          const remaining = DUEL_DURATION_MS - elapsed;
          if (remaining > 0) {
            setPhase('running');
            setRemainingMs(remaining);
            return;
          }
          if (!finishedRef.current) {
            finishedRef.current = true;
            submitFinalResult(duelCode, me.uid, repsRef.current).catch(() => {});
            setPhase('finished');
            navigation.replace('DuelResult', { duelCode, me, isRanked });
          }
          if (intervalId) clearInterval(intervalId);
        }, 200);
      }
    });

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelCode]);

  const onResults = useCallback(
    (result: PoseDetectionResultBundle, vc: ViewCoordinator) => {
      const bundle = result.results[0];
      const imageLandmarks = bundle?.landmarks?.[0];
      const worldLandmarks = bundle?.worldLandmarks?.[0];

      if (!imageLandmarks || !worldLandmarks) {
        setSkeletonPoints(null);
        return;
      }

      if (finishedRef.current) return; // Zählung stoppt hart mit dem Duell-Ende.

      const { live, completedRep } = analyzerRef.current.processFrame(worldLandmarks, Date.now());
      setActiveIssue(live && live.cue && live.cue !== 'GOOD_FORM' ? live.cue : null);

      if (completedRep) {
        repsRef.current += 1;
        setMyReps(repsRef.current);
        submitLiveRepCount(duelCode, me.uid, repsRef.current).catch(() => {});
        playRepSoundRef.current(completedRep.issues.length === 0);
      }

      const frameDims = vc.getFrameDims(result);
      const points = imageLandmarks.map((lm) => vc.convertPoint(frameDims, { x: lm.x, y: lm.y }));
      setSkeletonPoints(points);
    },
    [duelCode, me.uid]
  );

  const onError = useCallback((error: DetectionError) => {
    console.warn('[DuelScreen] pose detection error', error.code, error.message);
  }, []);

  const solution = usePoseDetection({ onResults, onError }, RunningMode.LIVE_STREAM, POSE_MODEL, {
    delegate: Delegate.GPU,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    mirrorMode: 'mirror-front-only',
  });

  const remainingSeconds = useMemo(() => Math.max(0, Math.ceil(remainingMs / 1000)), [remainingMs]);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Diese App benötigt Zugriff auf die Frontkamera für das Duell.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediapipeCamera style={StyleSheet.absoluteFill} solution={solution} activeCamera="front" resizeMode="cover" />
      <SkeletonOverlay
        width={solution.cameraViewDimensions.width}
        height={solution.cameraViewDimensions.height}
        points={skeletonPoints}
        activeIssue={activeIssue}
      />

      <View style={styles.hudRow} pointerEvents="none">
        <PlayerBadge label={me.displayName} avatar={me.avatar} tier={me.tier} reps={myReps} align="left" />
        {opponent && (
          <PlayerBadge label={opponent.displayName} avatar={opponent.avatar} tier={opponent.tier} reps={opponent.reps} align="right" />
        )}
      </View>

      <View style={styles.centerOverlay} pointerEvents="none">
        {phase === 'waitingOpponent' && <Text style={styles.centerText}>Warte auf Gegner…</Text>}
        {phase === 'countdown' && countdownSeconds != null && (
          <Text style={styles.countdownText}>{countdownSeconds}</Text>
        )}
        {phase === 'running' && <Text style={styles.timerText}>{remainingSeconds}s</Text>}
      </View>
    </View>
  );
}

function PlayerBadge({
  label,
  avatar,
  tier,
  reps,
  align,
}: {
  label: string;
  avatar: DuelPlayerState['avatar'];
  tier: DuelPlayerState['tier'];
  reps: number;
  align: 'left' | 'right';
}) {
  return (
    <View style={[styles.badge, align === 'right' && styles.badgeRight]}>
      <RankFrame avatar={avatar} tier={tier} size={36} />
      <View style={align === 'right' ? styles.badgeTextWrapRight : styles.badgeTextWrap}>
        <Text style={styles.badgeReps}>{reps}</Text>
        <Text style={styles.badgeName} numberOfLines={1}>
          {label}
        </Text>
      </View>
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
  },
  hudRow: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 6,
    gap: 8,
    maxWidth: 150,
  },
  badgeRight: {
    flexDirection: 'row-reverse',
  },
  badgeTextWrap: {
    flexShrink: 1,
  },
  badgeTextWrapRight: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  badgeReps: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  badgeName: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  countdownText: {
    fontFamily: fonts.extraBold,
    fontSize: 96,
    color: '#FFFFFF',
  },
  timerText: {
    position: 'absolute',
    top: 90,
    fontFamily: fonts.extraBold,
    fontSize: 32,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
