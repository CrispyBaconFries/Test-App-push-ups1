import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'react-native-vision-camera';
import type { PoseDetectionResultBundle, ViewCoordinator, DetectionError } from 'react-native-mediapipe';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { PushUpAnalyzer, type FormIssue, type LiveFeedback, type RepResult } from '../pose/formAnalysis';
import { liveCueLabelDe } from '../pose/feedbackText';
import { SkeletonOverlay, type ViewPoint } from '../components/SkeletonOverlay';
import { ProgressBar } from '../components/ProgressBar';
import { useRepSounds } from '../audio/repSounds';
import { buildSession, computeStats, loadSessions, saveSession } from '../storage/workoutStorage';
import { computeBadgeStatuses, newlyUnlockedBadges } from '../gamification/badges';
import { computeMissions } from '../gamification/missions';
import { claimCompletedMissions } from '../gamification/currencyStore';
import { loadDuelLog } from '../duel/duelLog';
import { bossMaxHp, bossName, REP_DAMAGE_HP } from '../bossmode/bossDefinitions';
import { loadBossProgress, saveBossProgress, type BossProgress } from '../bossmode/bossProgressStorage';
import { useBossFightCamera } from '../bossmode/useBossFightCamera';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

const OVERLAY_FRAME_SKIP = 2;
const BOSS_DEFEATED_BANNER_MS = 1800;

// Nur ein Platzhalter-Look, solange die echten Boss-Artworks noch nicht existieren
// (siehe README) - Farbe wechselt zumindest pro Boss, damit es nicht komplett gleich aussieht.
const BOSS_TINTS = [colors.danger, colors.accent, '#B23AFF', '#5AC8E8'];

type Props = NativeStackScreenProps<RootStackParamList, 'BossFight'>;

export function BossFightScreen({ navigation }: Props) {
  const analyzerRef = useRef(new PushUpAnalyzer());
  const startedAtRef = useRef(new Date().toISOString());
  const frameCounterRef = useRef(0);
  const repsRef = useRef<RepResult[]>([]);
  const bossRef = useRef<BossProgress | null>(null);

  const [boss, setBoss] = useState<BossProgress | null>(null);
  const [defeatedBanner, setDefeatedBanner] = useState<number | null>(null);
  const [live, setLive] = useState<LiveFeedback | null>(null);
  const [skeletonPoints, setSkeletonPoints] = useState<ViewPoint[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);

  const playRepSound = useRepSounds();
  const playRepSoundRef = useRef(playRepSound);
  playRepSoundRef.current = playRepSound;

  useEffect(() => {
    loadBossProgress().then((progress) => {
      bossRef.current = progress;
      setBoss(progress);
    });
  }, []);

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

    if (completedRep && bossRef.current) {
      repsRef.current = [...repsRef.current, completedRep];
      playRepSoundRef.current(completedRep.issues.length === 0);

      let { bossNumber, currentHp } = bossRef.current;
      currentHp -= REP_DAMAGE_HP;
      if (currentHp <= 0) {
        bossNumber += 1;
        currentHp = bossMaxHp(bossNumber);
        setDefeatedBanner(bossNumber - 1);
        setTimeout(() => setDefeatedBanner(null), BOSS_DEFEATED_BANNER_MS);
      }
      const next: BossProgress = { bossNumber, currentHp };
      bossRef.current = next;
      setBoss(next);
      saveBossProgress(next).catch(() => {});
    }

    frameCounterRef.current += 1;
    if (frameCounterRef.current % OVERLAY_FRAME_SKIP === 0) {
      const frameDims = vc.getFrameDims(result);
      const points = imageLandmarks.map((lm) => vc.convertPoint(frameDims, { x: lm.x, y: lm.y }));
      setSkeletonPoints(points);
    }
  }, []);

  const onError = useCallback((error: DetectionError) => {
    console.warn('[BossFightScreen] pose detection error', error.code, error.message);
  }, []);

  const {
    hasPermission,
    requestPermission,
    device,
    frameProcessor,
    cameraViewLayoutChangeHandler,
    cameraViewDimensions,
  } = useBossFightCamera({ onPoseResults: onResults, onError });

  // Genau wie WorkoutScreen: die in dieser Sitzung gemachten Liegestütze zählen ganz
  // normal fürs Trainingsverlauf/Punkte/Auszeichnungen - der Boss-Modus ist eine andere
  // Verpackung desselben Trainings, kein getrennter Fortschritt.
  const finishFight = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (repsRef.current.length === 0) {
      navigation.goBack();
      return;
    }
    setFinishing(true);
    const previousSessions = await loadSessions();
    const previousStats = computeStats(previousSessions);
    const badgesBefore = computeBadgeStatuses(previousStats, previousSessions);

    const session = buildSession(repsRef.current, startedAtRef.current, new Date().toISOString(), 'boss');
    await saveSession(session);

    const allSessions = [session, ...previousSessions];
    const badgesAfter = computeBadgeStatuses(computeStats(allSessions), allSessions);
    const newBadges = newlyUnlockedBadges(badgesBefore, badgesAfter);

    const hasHistory = previousSessions.length > 0;
    const newBestReps = hasHistory && session.totalReps > previousStats.bestSessionReps;
    const newBestFormScore = hasHistory && session.averageFormScore > previousStats.bestAverageFormScore;

    // See WorkoutScreen's finishWorkout for why this is safe to call unconditionally.
    const duelLog = await loadDuelLog();
    const missions = computeMissions({ sessions: allSessions, duelLog, appOpenedToday: true });
    const { coinsEarned, newlyCompleted: newlyCompletedMissions } = await claimCompletedMissions(missions);

    navigation.replace('Summary', { session, newBadges, newBestReps, newBestFormScore, coinsEarned, newlyCompletedMissions });
  }, [navigation]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (finishingRef.current || repsRef.current.length === 0) return;
      e.preventDefault();
      finishFight();
    });
  }, [navigation, finishFight]);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          Diese App benötigt Zugriff auf die Frontkamera für den Boss-Kampf.
        </Text>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Kamerazugriff erlauben</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Keine Frontkamera gefunden.</Text>
        <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const activeIssue: FormIssue | null = live && live.cue && live.cue !== 'GOOD_FORM' ? live.cue : null;
  const cueLabel = live ? liveCueLabelDe(live.cue) : '';
  const bossTint = boss ? BOSS_TINTS[(boss.bossNumber - 1) % BOSS_TINTS.length] : colors.danger;
  const bossMax = boss ? bossMaxHp(boss.bossNumber) : 1;

  return (
    <View style={styles.container}>
      {/* Platzhalter-"Boss" - echte Personen-Freistellung (siehe README "Boss-Modus"):
          die <Camera> darüber zeichnet nur noch die per Segmentierung freigestellten
          Nutzer-Pixel auf einer sonst transparenten Fläche, sodass dieser Hintergrund
          überall sonst durchscheint. Die eigentliche Boss-Grafik kommt in einem
          späteren Schritt - aktuell ein eingefärbtes Platzhalter-Icon. */}
      {boss && (
        <View style={styles.bossArtwork} pointerEvents="none">
          <Ionicons name="skull" size={220} color={bossTint} />
        </View>
      )}

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        frameProcessor={frameProcessor}
        onLayout={cameraViewLayoutChangeHandler}
      />

      <SkeletonOverlay
        width={cameraViewDimensions.width}
        height={cameraViewDimensions.height}
        points={skeletonPoints}
        activeIssue={activeIssue}
      />

      {boss && (
        <View style={styles.bossHud} pointerEvents="none">
          <View style={styles.bossHeaderRow}>
            <Text style={styles.bossName}>{bossName(boss.bossNumber)}</Text>
            <Text style={styles.bossHpText}>
              {Math.max(0, boss.currentHp)} / {bossMax} HP
            </Text>
          </View>
          <ProgressBar progress={boss.currentHp / bossMax} color={bossTint} height={10} />
        </View>
      )}

      <View style={styles.repCounterRow} pointerEvents="none">
        <View style={styles.repCounterBadge}>
          <Text style={styles.repCountText}>{repsRef.current.length}</Text>
          <Text style={styles.repCountLabel}>Wiederholungen</Text>
        </View>
      </View>

      {defeatedBanner != null && (
        <View style={styles.defeatedBanner} pointerEvents="none">
          <Ionicons name="trophy" size={22} color="#0B0F14" />
          <Text style={styles.defeatedText}>{bossName(defeatedBanner)} besiegt!</Text>
        </View>
      )}

      {!defeatedBanner && cueLabel !== '' && (
        <View style={styles.cueBar} pointerEvents="none">
          <Text style={styles.cueText}>{cueLabel}</Text>
        </View>
      )}

      <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
        <Text style={styles.iconButtonText}>Zurück</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.finishButton, pressed && styles.pressed]}
        onPress={finishFight}
        disabled={finishing}
      >
        <Ionicons name="checkmark-circle" size={18} color="#0B0F14" />
        <Text style={styles.primaryButtonText}>Kampf beenden</Text>
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
  bossArtwork: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 120,
  },
  bossHud: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
  },
  bossHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bossName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  bossHpText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontVariant: ['tabular-nums'],
  },
  repCounterRow: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  repCounterBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  repCountText: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  repCountLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  defeatedBanner: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
  },
  defeatedText: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: '#0B0F14',
  },
  cueBar: {
    position: 'absolute',
    bottom: 108,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  cueText: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.danger,
    textAlign: 'center',
    overflow: 'hidden',
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
