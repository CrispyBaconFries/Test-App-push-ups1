import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { computeStats, loadSessions, type WorkoutStats } from '../storage/workoutStorage';
import { levelForPoints } from '../gamification/points';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type MenuItem = {
  key: 'Workout' | 'History' | 'Camera';
  title: string;
  subtitle: string;
  emphasis?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'Workout',
    title: 'Training starten',
    subtitle: 'Kamera + Skelett-Overlay, zählt deine Liegestütze automatisch',
    emphasis: true,
  },
  {
    key: 'History',
    title: 'Trainingsverlauf',
    subtitle: 'Alle Workouts mit Wiederholungen, Datum und Uhrzeit',
  },
  {
    key: 'Camera',
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
    <View style={styles.container}>
      <Text style={styles.title}>Liegestütz-Coach</Text>
      <Text style={styles.subtitle}>Stelle dein Handy vor dir auf dem Boden auf – die Frontkamera prüft deine Form live.</Text>

      <View style={styles.statsCard}>
        <StatRow label="Level" value={`${level.level}`} />
        <StatRow label="Punkte" value={`${stats?.totalPoints ?? 0}`} />
        <StatRow label="Liegestütze gesamt" value={`${stats?.totalReps ?? 0}`} />
        <StatRow label="Streak" value={`${stats?.currentStreakDays ?? 0} Tage`} />
      </View>

      <View style={styles.menu}>
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.menuItem, item.emphasis && styles.menuItemEmphasis]}
            onPress={() => navigation.navigate(item.key)}
          >
            <Text style={[styles.menuItemTitle, item.emphasis && styles.menuItemTitleEmphasis]}>{item.title}</Text>
            <Text style={[styles.menuItemSubtitle, item.emphasis && styles.menuItemSubtitleEmphasis]}>
              {item.subtitle}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 21,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  menu: {
    gap: 12,
  },
  menuItem: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItemEmphasis: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  menuItemTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  menuItemTitleEmphasis: {
    color: '#0B0F14',
  },
  menuItemSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  menuItemSubtitleEmphasis: {
    color: 'rgba(11,15,20,0.7)',
  },
});
