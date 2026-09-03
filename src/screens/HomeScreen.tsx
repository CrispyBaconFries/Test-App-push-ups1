import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { computeStats, loadSessions, type WorkoutStats } from '../storage/workoutStorage';
import { levelForPoints } from '../gamification/points';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [stats, setStats] = useState<WorkoutStats | null>(null);

  const refresh = useCallback(async () => {
    const sessions = await loadSessions();
    setStats(computeStats(sessions));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
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

      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Camera')}>
        <Text style={styles.primaryButtonText}>Start</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('History')}>
        <Text style={styles.secondaryButtonText}>Verlauf ansehen</Text>
      </Pressable>
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
    marginBottom: 32,
    lineHeight: 21,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#0B0F14',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
