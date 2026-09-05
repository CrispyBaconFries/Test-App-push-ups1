import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { computeStats, loadSessions, type WorkoutStats } from '../storage/workoutStorage';
import { levelForPoints } from '../gamification/points';
import { LevelProgressBar } from '../components/LevelProgressBar';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type MenuItem = {
  key: 'Workout' | 'History' | 'Camera';
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
    key: 'Camera',
    icon: 'camera-outline',
    title: 'Kamera-Test',
    subtitle: 'Nur Kamera ohne Auswertung – zum Prüfen, falls „Training starten“ Probleme macht',
  },
];

export function HomeScreen({ navigation }: Props) {
  const [stats, setStats] = useState<WorkoutStats | null>(null);

  // useFocusEffect already fires on initial mount (the screen is "focused" as soon as
  // it appears), so a separate mount-time useEffect here would just fetch twice.
  useFocusEffect(
    useCallback(() => {
      loadSessions().then((sessions) => setStats(computeStats(sessions)));
    }, [])
  );

  const level = levelForPoints(stats?.totalPoints ?? 0);

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
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

      <View style={styles.statsCard}>
        <LevelProgressBar
          level={level.level}
          pointsIntoLevel={level.pointsIntoLevel}
          pointsForNextLevel={level.pointsForNextLevel}
        />
        <View style={styles.statsDivider} />
        <View style={styles.statsRow}>
          <StatTile icon="star" value={`${stats?.totalPoints ?? 0}`} label="Punkte" />
          <StatTile icon="barbell-outline" value={`${stats?.totalReps ?? 0}`} label="Liegestütze" />
          <StatTile
            icon="flame"
            value={`${stats?.currentStreakDays ?? 0}`}
            label="Tage Streak"
            iconColor={colors.accent}
          />
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
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
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
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 20,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
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
});
