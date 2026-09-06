import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { computeStats, loadSessions, localDayKey, type WorkoutSession, type WorkoutStats } from '../storage/workoutStorage';
import { levelForPoints } from '../gamification/points';
import { computeBadgeStatuses } from '../gamification/badges';
import { computeMissions, buildDailyReminderBody, type MissionProgress } from '../gamification/missions';
import { claimCompletedMissions, getCoinBalance } from '../gamification/currencyStore';
import { recordAppOpenAndGetStreak, coinsForLoginStreak } from '../gamification/loginStreak';
import { reconcileStreakFreezes } from '../gamification/streakFreezeStore';
import { loadDuelLog, type DuelLogEntry } from '../duel/duelLog';
import { flushPendingLeaderboardSync } from '../ranking/leaderboardSync';
import {
  isDailyReminderEnabled,
  enableDailyReminder,
  disableDailyReminder,
  refreshDailyReminderContent,
} from '../notifications/dailyReminder';
import { useAuth } from '../auth/AuthContext';
// DEV CALIBRATION (temporär, siehe src/pose/calibrationLogger.ts) - entfernen, sobald
// die Schwellwert-Kalibrierung anhand echter Gerätedaten abgeschlossen ist.
import { shareCalibrationLog } from '../pose/calibrationLogger';
import { LevelProgressBar } from '../components/LevelProgressBar';
import { ProgressBar } from '../components/ProgressBar';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type MenuItem = {
  key:
    | 'Workout'
    | 'History'
    | 'Achievements'
    | 'Camera'
    | 'DuelLobby'
    | 'RankedMatchmaking'
    | 'BossFight'
    | 'Leaderboard'
    | 'Shop'
    | 'Profile';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  emphasis?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'Workout',
    icon: 'barbell',
    title: 'Training starten',
    subtitle: 'Kamera + Skelett-Overlay, zählt deine Liegestütze automatisch',
    emphasis: true,
  },
  {
    key: 'BossFight',
    icon: 'skull-outline',
    title: 'Boss-Modus',
    subtitle: 'Offline, allein gegen immer stärkere Bosse - kein Internet nötig',
  },
  {
    key: 'Leaderboard',
    icon: 'podium-outline',
    title: 'Rangliste',
    subtitle: 'Gesamt, diese Woche und deine Liga im Vergleich',
  },
  {
    key: 'Profile',
    icon: 'person-circle-outline',
    title: 'Mein Profil',
    subtitle: 'Level, Gesamt-/Wochen-Liegestütze, Freundescode',
  },
  {
    key: 'Shop',
    icon: 'cash-outline',
    title: 'Münz-Shop',
    subtitle: 'Münzen gegen Streak-Rettung, Avatare und Rahmen-Themes eintauschen',
  },
  {
    key: 'RankedMatchmaking',
    icon: 'trophy',
    title: 'Ranked',
    subtitle: 'Gegner mit ähnlichem Rang, 60 Sekunden, LP auf dem Spiel',
  },
  {
    key: 'DuelLobby',
    icon: 'people-circle-outline',
    title: 'Freundschaftsspiel',
    subtitle: '60-Sekunden-Duell gegen einen Freund per Einladungscode',
  },
  {
    key: 'History',
    icon: 'time-outline',
    title: 'Trainingsverlauf',
    subtitle: 'Alle Workouts mit Wiederholungen, Datum und Uhrzeit',
  },
  {
    key: 'Achievements',
    icon: 'ribbon-outline',
    title: 'Auszeichnungen',
    subtitle: 'Meilensteine und Abzeichen, die du schon erreicht hast',
  },
  {
    key: 'Camera',
    icon: 'camera-outline',
    title: 'Kamera-Test',
    subtitle: 'Nur Kamera ohne Auswertung – zum Prüfen, falls „Training starten“ Probleme macht',
  },
];

export function HomeScreen({ navigation }: Props) {
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [duelLog, setDuelLog] = useState<DuelLogEntry[] | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState<boolean | null>(null);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [loginStreakDays, setLoginStreakDays] = useState<number | null>(null);
  const [frozenDayKeys, setFrozenDayKeys] = useState<Set<string>>(new Set());
  const [heldStreakFreezes, setHeldStreakFreezes] = useState<number | null>(null);
  const [streakJustSaved, setStreakJustSaved] = useState(false);
  const auth = useAuth();

  // useFocusEffect already fires on initial mount (the screen is "focused" as soon as
  // it appears), so a separate mount-time useEffect here would just fetch twice.
  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
      loadDuelLog().then(setDuelLog);
    }, [])
  );

  useEffect(() => {
    isDailyReminderEnabled().then(setReminderEnabled);
    getCoinBalance().then(setCoinBalance);
    recordAppOpenAndGetStreak().then(setLoginStreakDays);
  }, []);

  // Liegestütze, die mangels Internet nicht in die Online-Rangliste kamen, nachholen -
  // beim App-Öffnen ist eine gute Gelegenheit dafür (siehe leaderboardSyncQueue.ts).
  useEffect(() => {
    flushPendingLeaderboardSync(auth.profile).catch(() => {});
  }, [auth.profile]);

  // Streak-Rettung aus dem Münz-Shop: prüft bei jedem Fokussieren, ob seit dem letzten
  // Training eine Lücke entstanden ist, und verbraucht dafür automatisch einen
  // gehaltenen Freeze (siehe streakFreezeStore.ts) - das Ergebnis fließt unten in
  // computeStats ein, damit currentStreakDays die geschützte Streak zeigt.
  useEffect(() => {
    if (sessions == null) return;
    const workoutDays = new Set(sessions.map((s) => localDayKey(new Date(s.finishedAtIso))));
    reconcileStreakFreezes(workoutDays).then(({ frozenDayKeys: frozen, heldFreezesRemaining, justFrozen }) => {
      setFrozenDayKeys(frozen);
      setHeldStreakFreezes(heldFreezesRemaining);
      if (justFrozen.length > 0) setStreakJustSaved(true);
    });
  }, [sessions]);

  const stats: WorkoutStats = useMemo(() => computeStats(sessions ?? [], frozenDayKeys), [sessions, frozenDayKeys]);
  const level = levelForPoints(stats.totalPoints);
  // Being on this screen at all means the app is open right now - the "täglich
  // einloggen" mission just reflects that directly, no separate tracking needed.
  const missions = useMemo(
    () => computeMissions({ sessions: sessions ?? [], duelLog: duelLog ?? [], appOpenedToday: true }),
    [sessions, duelLog]
  );
  const unlockedBadgeCount = useMemo(
    () => computeBadgeStatuses(stats, sessions ?? []).filter((b) => b.unlocked).length,
    [stats, sessions]
  );

  // Idempotent per mission/day/week (see currencyStore.ts) - safe to run on every
  // recompute, whether or not a mission actually just became complete. Der
  // "Täglich dabei"-Betrag hängt vom Login-Streak ab (siehe loginStreak.ts), daher der
  // Override statt der festen `rewardCoins` der Mission.
  useEffect(() => {
    if (sessions == null || duelLog == null || loginStreakDays == null) return;
    claimCompletedMissions(missions, { daily_app_open: coinsForLoginStreak(loginStreakDays) }).then(({ balance }) =>
      setCoinBalance(balance)
    );
  }, [missions, sessions, duelLog, loginStreakDays]);

  // Keeps tonight's reminder text pointed at whatever's still open, as of the last time
  // the app was opened (see dailyReminder.ts for why it can't be more "live" than that).
  useEffect(() => {
    if (!reminderEnabled) return;
    refreshDailyReminderContent(buildDailyReminderBody(missions.daily)).catch(() => {});
  }, [reminderEnabled, missions]);

  const toggleReminder = useCallback(async () => {
    if (reminderEnabled) {
      await disableDailyReminder();
      setReminderEnabled(false);
      return;
    }
    const granted = await enableDailyReminder(buildDailyReminderBody(missions.daily));
    setReminderEnabled(granted);
    if (!granted) {
      Alert.alert(
        'Keine Berechtigung',
        'Um dich täglich zu erinnern, braucht die App die Erlaubnis, Benachrichtigungen zu senden. Das kannst du in den Handy-Einstellungen für diese App nachträglich erlauben.'
      );
    }
  }, [reminderEnabled, missions]);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="barbell" size={22} color="#0B0F14" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              Liegestütz<Text style={styles.titleAccent}>Coach</Text>
            </Text>
            <Text style={styles.subtitle}>Handy vor dir auf dem Boden – die Frontkamera prüft deine Form live.</Text>
          </View>
        </View>

        {/* DEV CALIBRATION (temporär, siehe src/pose/calibrationLogger.ts) - Button
            entfernen, sobald die Schwellwert-Kalibrierung abgeschlossen ist. */}
        <Pressable
          style={({ pressed }) => [styles.devCalibrationButton, pressed && styles.pressed]}
          onPress={() =>
            shareCalibrationLog().catch((e: Error) => Alert.alert('Kalibrierungsdaten', e.message))
          }
        >
          <Text style={styles.devCalibrationButtonText}>🧪 Kalibrierungsdaten teilen (DEV)</Text>
        </Pressable>

        <View style={styles.accountCard}>
          {auth.status === 'signedIn' && auth.profile ? (
            <View style={styles.accountRow}>
              {auth.profile.photoUrl ? (
                <Image source={{ uri: auth.profile.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(auth.profile.name ?? auth.profile.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.accountTextWrap}>
                <Text style={styles.accountName} numberOfLines={1}>
                  {auth.profile.name ?? auth.profile.email}
                </Text>
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {auth.profile.email}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
                onPress={auth.signOut}
              >
                <Text style={styles.signOutButtonText}>Abmelden</Text>
              </Pressable>
            </View>
          ) : auth.status === 'signedOut' ? (
            <View style={styles.accountSignedOut}>
              <Text style={[styles.accountName, styles.accountTextCentered]}>Fortschritt sichern</Text>
              <Text style={[styles.accountEmail, styles.accountTextCentered]}>Optional mit Google anmelden</Text>
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Standard}
                color={GoogleSigninButton.Color.Dark}
                onPress={auth.signIn}
                style={styles.googleButton}
              />
            </View>
          ) : null}
          {auth.error && <Text style={styles.accountError}>{auth.error}</Text>}
        </View>

        {streakJustSaved && (
          <View style={styles.streakSavedBanner}>
            <Ionicons name="snow" size={18} color="#0B0F14" />
            <Text style={styles.streakSavedText}>
              Streak gerettet! Eine Streak-Rettung aus dem Münz-Shop wurde automatisch eingesetzt.
            </Text>
            <Pressable onPress={() => setStreakJustSaved(false)} hitSlop={8}>
              <Ionicons name="close" size={16} color="rgba(11,15,20,0.6)" />
            </Pressable>
          </View>
        )}

        <View style={styles.statsCard}>
          <LevelProgressBar
            level={level.level}
            pointsIntoLevel={level.pointsIntoLevel}
            pointsForNextLevel={level.pointsForNextLevel}
            isMaxLevel={level.isMaxLevel}
          />
          <View style={styles.statsDivider} />
          <View style={styles.statsRow}>
            <StatTile icon="star" value={`${stats.totalPoints}`} label="Punkte" />
            <StatTile icon="barbell-outline" value={`${stats.totalReps}`} label="Liegestütze" />
            <StatTile icon="flame" value={`${stats.currentStreakDays}`} label="Tage Streak" iconColor={colors.accent} />
            <StatTile icon="ribbon-outline" value={`${unlockedBadgeCount}`} label="Abzeichen" />
          </View>
          {!!heldStreakFreezes && (
            <View style={styles.freezeHintRow}>
              <Ionicons name="snow" size={12} color={colors.textSecondary} />
              <Text style={styles.freezeHint}>
                {heldStreakFreezes} Streak-Rettung{heldStreakFreezes === 1 ? '' : 'en'} im Vorrat
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Missionen</Text>
            <View style={styles.coinChip}>
              <Ionicons name="cash" size={14} color={colors.warning} />
              <Text style={styles.coinChipText}>{coinBalance ?? 0}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.reminderButton, pressed && styles.pressed, styles.reminderButtonStandalone]}
            onPress={toggleReminder}
          >
            <Ionicons
              name={reminderEnabled ? 'notifications' : 'notifications-outline'}
              size={16}
              color={reminderEnabled ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.reminderButtonText, reminderEnabled && { color: colors.primary }]}>
              {reminderEnabled ? 'Tägliche Erinnerung an' : 'Tägliche Erinnerung aus'}
            </Text>
          </Pressable>

          <Text style={styles.missionSectionLabel}>Heute</Text>
          {missions.daily.map((mission) => (
            <MissionRow
              key={mission.definition.id}
              mission={mission}
              rewardOverride={
                mission.definition.id === 'daily_app_open' && loginStreakDays != null
                  ? coinsForLoginStreak(loginStreakDays)
                  : undefined
              }
            />
          ))}

          <Text style={[styles.missionSectionLabel, { marginTop: 18 }]}>Diese Woche</Text>
          {missions.weekly.map((mission) => (
            <MissionRow key={mission.definition.id} mission={mission} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bestleistungen</Text>
          <View style={[styles.statsRow, { marginTop: 14 }]}>
            <StatTile icon="trending-up" value={`${stats.bestSessionReps}`} label="Beste Session" />
            <StatTile icon="checkmark-done" value={`${stats.bestAverageFormScore}`} label="Bester Score" />
            <StatTile icon="trophy-outline" value={`${stats.longestStreakDays}`} label="Rekord-Streak" />
          </View>
        </View>

        <View style={styles.menu}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.menuItem,
                item.emphasis && styles.menuItemEmphasis,
                pressed && styles.menuItemPressed,
              ]}
              onPress={() => navigation.navigate(item.key)}
            >
              <View style={[styles.menuIconBadge, item.emphasis && styles.menuIconBadgeEmphasis]}>
                <Ionicons name={item.icon} size={20} color={item.emphasis ? '#0B0F14' : colors.textPrimary} />
              </View>
              <View style={styles.menuItemTextWrap}>
                <Text style={[styles.menuItemTitle, item.emphasis && styles.menuItemTitleEmphasis]}>{item.title}</Text>
                <Text style={[styles.menuItemSubtitle, item.emphasis && styles.menuItemSubtitleEmphasis]}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={item.emphasis ? 'rgba(11,15,20,0.5)' : colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function MissionRow({ mission, rewardOverride }: { mission: MissionProgress; rewardOverride?: number }) {
  const { definition, progress, complete } = mission;
  return (
    <View style={styles.missionRow}>
      <View style={[styles.missionIconBadge, complete && styles.missionIconBadgeComplete]}>
        <Ionicons
          name={complete ? 'checkmark' : (definition.icon as keyof typeof Ionicons.glyphMap)}
          size={16}
          color={complete ? '#0B0F14' : colors.textPrimary}
        />
      </View>
      <View style={styles.missionTextWrap}>
        <View style={styles.missionTitleRow}>
          <Text style={styles.missionTitle}>{definition.title}</Text>
          <Text style={styles.missionReward}>+{rewardOverride ?? definition.rewardCoins}</Text>
        </View>
        <Text style={styles.missionDescription}>
          {definition.description} · {progress}/{definition.target}
          {complete ? ' ✓' : ''}
        </Text>
        <ProgressBar progress={progress / definition.target} height={5} color={complete ? colors.primary : colors.accent} />
      </View>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
  iconColor = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  iconColor?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  // DEV CALIBRATION (temporär, siehe src/pose/calibrationLogger.ts) - Styles entfernen,
  // sobald die Schwellwert-Kalibrierung abgeschlossen ist.
  devCalibrationButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  devCalibrationButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Google's "Wide" button is a fixed ~312dp - crammed into a row next to explanatory
  // text it either overflowed or squeezed the text to nothing, and read as "not
  // centered" with an oddly empty-looking card behind it. A centered column with the
  // smaller "Standard" button avoids both.
  accountSignedOut: {
    alignItems: 'center',
  },
  accountTextCentered: {
    textAlign: 'center',
  },
  googleButton: {
    marginTop: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarFallbackText: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: '#0B0F14',
  },
  accountTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  accountName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  accountEmail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  signOutButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  accountError: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.danger,
    marginTop: 10,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reminderButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  reminderButtonStandalone: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,194,75,0.14)',
  },
  coinChipText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.warning,
    fontVariant: ['tabular-nums'],
  },
  missionSectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  missionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  missionIconBadgeComplete: {
    backgroundColor: colors.primary,
  },
  missionTextWrap: {
    flex: 1,
  },
  missionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  missionReward: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.warning,
    fontVariant: ['tabular-nums'],
  },
  missionDescription: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  streakSavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  streakSavedText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#0B0F14',
  },
  freezeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    justifyContent: 'center',
  },
  freezeHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  statsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statTile: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  menu: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  menuItemPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  menuItemEmphasis: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  menuIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIconBadgeEmphasis: {
    backgroundColor: 'rgba(11,15,20,0.15)',
  },
  menuItemTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  menuItemTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  menuItemTitleEmphasis: {
    color: '#0B0F14',
  },
  menuItemSubtitle: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  menuItemSubtitleEmphasis: {
    color: 'rgba(11,15,20,0.7)',
  },
  pressed: {
    opacity: 0.8,
  },
});
