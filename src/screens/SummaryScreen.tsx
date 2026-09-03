import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ISSUE_SHORT_LABELS_DE } from '../pose/feedbackText';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

export function SummaryScreen({ route, navigation }: Props) {
  const { session } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workout abgeschlossen</Text>

      <View style={styles.heroRow}>
        <HeroStat value={`${session.totalReps}`} label="Liegestütze" />
        <HeroStat value={`${session.averageFormScore}`} label="Ø Form-Score" />
        <HeroStat value={`+${session.points}`} label="Punkte" accent />
      </View>

      <Text style={styles.sectionTitle}>Wiederholungen im Detail</Text>
      {session.reps.map((rep) => (
        <View key={rep.index} style={styles.repRow}>
          <View style={styles.repIndexBadge}>
            <Text style={styles.repIndexText}>{rep.index + 1}</Text>
          </View>
          <View style={styles.repInfo}>
            <Text style={styles.repScore}>{rep.formScore} / 100</Text>
            <Text style={styles.repIssues}>
              {rep.issues.length === 0 ? 'Saubere Ausführung' : rep.issues.map((i) => ISSUE_SHORT_LABELS_DE[i]).join(', ')}
            </Text>
          </View>
        </View>
      ))}
      {session.reps.length === 0 && <Text style={styles.repIssues}>Keine Wiederholungen erkannt.</Text>}

      <Pressable style={styles.primaryButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.primaryButtonText}>Fertig</Text>
      </Pressable>
    </ScrollView>
  );
}

function HeroStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroValue, accent && { color: colors.primary }]}>{value}</Text>
      <Text style={styles.heroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 24,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  repIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  repIndexText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  repInfo: {
    flex: 1,
  },
  repScore: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  repIssues: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  primaryButtonText: {
    color: '#0B0F14',
    fontSize: 16,
    fontWeight: '800',
  },
});
