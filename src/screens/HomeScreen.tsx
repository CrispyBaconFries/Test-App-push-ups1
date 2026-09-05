import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { computeStats, loadSessions, type WorkoutSession, type WorkoutStats } from '../storage/workoutStorage';
import { levelForPoints } from '../gamification/points';
import { computeBadgeStatuses } from '../gamification/badges';
import { computeChallengeProgress } from '../gamification/challenges';
import { isDailyReminderEnabled, enableDailyReminder, disableDailyReminder } from '../notifications/dailyReminder';
import { useAuth } from '../auth/AuthContext';
import { LevelProgressBar } from '../components/LevelProgressBar';
import { ProgressBar } from '../components/ProgressBar';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type MenuItem = {
  key: 'Workout' | 'History' | 'Achievements' | 'Camera';
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
  const [reminderEnabled, setReminderEnabled] = useState<boolean | null>(null);
  const auth = useAuth();

  // useFocusEffect already fires on initial mount (the screen is "focused" as soon as
  // it appears), so a separate mount-time useEffect here would just fetch twice.
  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, [])
  );

  useEffect(() => {
    isDailyReminderEnabled().then(setReminderEnabled);
  }, []);

  const stats: WorkoutStats = useMemo(() => computeStats(sessions ?? []), [sessions]);
  const level = levelForPoints(stats.totalPoints);
  const challenge = useMemo(() => computeChallengeProgress(sessions ?? []), [sessions]);
  const unlockedBadgeCount = useMemo(
    () => computeBadgeStatuses(stats, sessions ?? []).filter((b) => b.unlocked).length,
    [stats, sessions]
  );

  const toggleReminder = useCallback(async () => {
    if (reminderEnabled) {
      await disableDailyReminder();
      setReminderEnabled(false);
      return;
    }
    const granted = await enableDailyReminder();
    setReminderEnabled(granted);
    if (!granted) {
      Alert.alert(
        'Keine Berechtigung',
        'Um dich täglich zu erinnern, braucht die App die Erlaubnis, Benachrichtigungen zu senden. Das kannst du in den Handy-Einstellungen für diese App nachträglich erlauben.'
      );
    }
  }, [reminderEnabled]);

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
            <View style={styles.accountRow}>
              <View style={styles.accountTextWrap}>
                <Text style={styles.accountName}>Fortschritt sichern</Text>
                <Text style={styles.accountEmail}>Optional mit Google anmelden</Text>
              </View>
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Dark}
                onPress={auth.signIn}
              />
            </View>
          ) : null}
          {auth.error && <Text style={styles.accountError}>{auth.error}</Text>}
        </View>

        <View style={styles.statsCard}>
          <LevelProgressBar
            level={level.level}
            pointsIntoLevel={level.pointsIntoLevel}
            pointsForNextLevel={level.pointsForNextLevel}
          />
          <View style={styles.statsDivider} />
          <View style={styles.statsRow}>
            <StatTile icon="star" value={`${stats.totalPoints}`} label="Punkte" />
            <StatTile icon="barbell-outline" value={`${stats.totalReps}`} label="Liegestütze" />
            <StatTile icon="flame" value={`${stats.currentStreakDays}`} label="Tage Streak" iconColor={colors.accent} />
            <StatTile icon="ribbon-outline" value={`${unlockedBadgeCount}`} label="Abzeichen" />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Herausforderungen</Text>
            <Pressable
              style={({ pressed }) => [styles.reminderButton, pressed && styles.pressed]}
              onPress={toggleReminder}
            >
              <Ionicons
                name={reminderEnabled ? 'notifications' : 'notifications-outline'}
                size={16}
                color={reminderEnabled ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.reminderButtonText, reminderEnabled && { color: colors.primary }]}>
                {reminderEnabled ? 'Erinnerung an' : 'Erinnerung aus'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.challengeRow}>
            <Text style={styles.challengeLabel}>Heute</Text>
            <Text style={styles.challengeValue}>
              {challenge.dailyReps} / {challenge.dailyGoal}
              {challenge.dailyComplete ? ' ✓' : ''}
            </Text>
          </View>
          <ProgressBar progress={challenge.dailyReps / challenge.dailyGoal} height={6} />

          <View style={[styles.challengeRow, { marginTop: 14 }]}>
            <Text style={styles.challengeLabel}>Diese Woche</Text>
            <Text style={styles.challengeValue}>
              {challenge.weeklyReps} / {challenge.weeklyGoal}
              {challenge.weeklyComplete ? ' ✓' : ''}
            </Text>
          </View>
          <ProgressBar progress={challenge.weeklyReps / challenge.weeklyGoal} height={6} color={colors.accent} />
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
  challengeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  challengeLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  challengeValue: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
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
