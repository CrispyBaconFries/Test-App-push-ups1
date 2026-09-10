import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import {
  usePoseDetection,
  MediapipeCamera,
  RunningMode,
  type PoseDetectionResultBundle,
  type ViewCoordinator,
  type DetectionError,
} from 'react-native-mediapipe';
import { POSE_DETECTION_OPTIONS, POSE_MODEL } from '../pose/poseDetectionOptions';
import { usePushUpAnalyzer } from '../pose/usePushUpAnalyzer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { type FormIssue } from '../pose/formAnalysis';
import { SkeletonOverlay, type ViewPoint } from '../components/SkeletonOverlay';
import { StartPositionOverlay } from '../components/StartPositionOverlay';
import type { StartPositionProgress } from '../pose/startPosition';
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
import { font, radius, space } from '../theme/layout';
import { fonts } from '../theme/typography';

const OVERLAY_FRAME_SKIP = 2;

/**
 * Wie lange höchstens auf die eigene Startposition gewartet wird, bevor trotzdem "bereit"
 * gemeldet wird. Etwas mehr als die Zeitgrenze der Startpositions-Prüfung selbst (30 s),
 * damit im Normalfall diese greift und nicht die Notbremse hier.
 */
const DUEL_READY_FALLBACK_MS = 35000;

type Props = NativeStackScreenProps<RootStackParamList, 'Duel'>;

type Phase = 'waitingOpponent' | 'countdown' | 'running' | 'finished';

export function DuelScreen({ route, navigation }: Props) {
  const { duelCode, me, isRanked } = route.params;
  const { hasPermission, requestPermission } = useCameraPermission();

  const analyzer = usePushUpAnalyzer();
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
  const [startPosition, setStartPosition] = useState<StartPositionProgress | null>(null);

  const playRepSound = useRepSounds();
  const playRepSoundRef = useRef(playRepSound);
  playRepSoundRef.current = playRepSound;

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const sendReady = useCallback(() => {
    if (readySentRef.current) return;
    readySentRef.current = true;
    setPlayerReady(duelCode, me.uid).catch(() => {});
  }, [duelCode, me.uid]);

  /**
   * Notbremse für den Fall, dass gar keine Kamerabilder ankommen.
   *
   * "Bereit" hängt seit der Startpositions-Prüfung daran, dass der eigene Stütz erkannt
   * wurde (siehe `onResults`) - das ist der richtige Zeitpunkt, weil der Countdown sonst
   * losläuft, während man noch aufsteht. Die Prüfung selbst hat zwar eine eigene
   * Zeitgrenze, die aber an Frames hängt: Kommt gar keiner an, läuft sie nie ab. Für den
   * Gegner sähe das aus wie ein Spieler, der ewig nicht bereit wird.
   */
  useEffect(() => {
    if (!hasPermission) return;
    const timer = setTimeout(sendReady, DUEL_READY_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [hasPermission, sendReady]);

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

      const { live, completedRep, discardedRep } = analyzer.processFrame(
        worldLandmarks,
        Date.now(),
        // Die Bildlandmarken sind die einzige verlässliche Auskunft darüber, ob ein
        // Körperteil überhaupt IM Bild ist: MediaPipe liefert auch für alles außerhalb
        // Koordinaten, und der Sichtbarkeitswert, der das aussortieren würde, kommt bei
        // react-native-mediapipe nie in JS an (siehe landmarks.ts).
        imageLandmarks
      );
      setActiveIssue(live && live.cue && live.cue !== 'GOOD_FORM' ? live.cue : null);
      setStartPosition(live.startPosition);

      // Erst bereit melden, wenn die eigene Startposition wirklich steht. Vorher hing das
      // an der Kameraberechtigung - der Countdown konnte damit anlaufen, während man noch
      // zwei Schritte vom Handy entfernt stand, und die 60 Sekunden liefen bereits.
      if (live.startPosition === null) {
        if (!readySentRef.current) playRepSoundRef.current(true);
        sendReady();
      }

      if (completedRep) {
        repsRef.current += 1;
        setMyReps(repsRef.current);
        submitLiveRepCount(duelCode, me.uid, repsRef.current).catch(() => {});
        playRepSoundRef.current(completedRep.issues.length === 0);
      }

      // Im Duell zählt eine verworfene Bewegung nicht - das ist beabsichtigt und für
      // beide Seiten fair, denn die Alternative wäre, 300-ms-Zuckungen als Punkte zu
      // werten. Hier nur protokolliert, damit sich Beschwerden über "der hat nicht
      // gezählt" später nachvollziehen lassen.
      if (__DEV__ && discardedRep) console.log('[DIAG] Wiederholung verworfen', discardedRep);

      const frameDims = vc.getFrameDims(result);
      const points = imageLandmarks.map((lm) => vc.convertPoint(frameDims, { x: lm.x, y: lm.y }));
      setSkeletonPoints(points);
    },
    [duelCode, me.uid, sendReady]
  );

  const onError = useCallback((error: DetectionError) => {
    console.warn('[DuelScreen] pose detection error', error.code, error.message);
  }, []);

  const solution = usePoseDetection({ onResults, onError }, RunningMode.LIVE_STREAM, POSE_MODEL, POSE_DETECTION_OPTIONS);

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

      {startPosition && <StartPositionOverlay progress={startPosition} />}

      <View style={styles.hudRow} pointerEvents="none">
        <PlayerBadge label={me.displayName} avatar={me.avatar} tier={me.tier} lp={me.lp} reps={myReps} align="left" />
        {opponent && (
          <PlayerBadge
            label={opponent.displayName}
            avatar={opponent.avatar}
            tier={opponent.tier}
            lp={opponent.lp}
            reps={opponent.reps}
            align="right"
          />
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
  lp,
  reps,
  align,
}: {
  label: string;
  avatar: DuelPlayerState['avatar'];
  tier: DuelPlayerState['tier'];
  lp: number;
  reps: number;
  align: 'left' | 'right';
}) {
  return (
    <View style={[styles.badge, align === 'right' && styles.badgeRight]}>
      <RankFrame avatar={avatar} tier={tier} lp={lp} size={36} />
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
    padding: space(32),
  },
  permissionText: {
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    fontSize: font(16),
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
    borderRadius: radius(16),
    padding: space(6),
    gap: space(8),
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
    fontSize: font(20),
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  badgeName: {
    fontFamily: fonts.semiBold,
    fontSize: font(11),
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
    fontSize: font(18),
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius(14),
    paddingHorizontal: space(18),
    paddingVertical: space(10),
  },
  countdownText: {
    fontFamily: fonts.extraBold,
    fontSize: font(96),
    color: '#FFFFFF',
  },
  timerText: {
    position: 'absolute',
    top: 90,
    fontFamily: fonts.extraBold,
    fontSize: font(32),
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius(14),
    paddingHorizontal: space(16),
    paddingVertical: space(6),
  },
});
