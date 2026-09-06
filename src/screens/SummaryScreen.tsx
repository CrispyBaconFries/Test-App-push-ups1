import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ISSUE_SHORT_LABELS_DE } from '../pose/feedbackText';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

export function SummaryScreen({ route, navigation }: Props) {
  const { session, newBadges, newBestReps, newBestFormScore, coinsEarned, newlyCompletedMissions } = route.params;

  const recordLabels = [
    newBestReps && 'meiste Wiederholungen in einer Session',
    newBestFormScore && 'höchster Ø Form-Score',
  ].filter((label): label is string => Boolean(label));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <View style={styles.trophyBadge}>
          <Ionicons name="trophy" size={22} color="#0B0F14" />
        </View>
        <Text style={styles.title}>Workout abgeschlossen</Text>
      </View>

      {recordLabels.length > 0 && (
        <View style={styles.recordCard}>
          <Ionicons name="trending-up" size={20} color="#0B0F14" />
          <View style={styles.newBadgeTextWrap}>
            <Text style={styles.newBadgeTitle}>Neue Bestleistung!</Text>
            <Text style={styles.recordNames}>{recordLabels.join(' · ')}</Text>
          </View>
        </View>
      )}

      {coinsEarned > 0 && (
        <View style={styles.coinCard}>
          <Ionicons name="cash" size={20} color="#0B0F14" />
          <View style={styles.newBadgeTextWrap}>
            <Text style={styles.newBadgeTitle}>+{coinsEarned} Münzen verdient!</Text>
            <Text style={styles.newBadgeNames}>
              {newlyCompletedMissions.map((m) => m.title).join(' · ')}
            </Text>
          </View>
        </View>
      )}

      {newBadges.length > 0 && (
        <View style={styles.newBadgeCard}>
          <Ionicons name="sparkles" size={20} color="#0B0F14" />
          <View style={styles.newBadgeTextWrap}>
            <Text style={styles.newBadgeTitle}>
              {newBadges.length === 1 ? 'Neue Auszeichnung freigeschaltet!' : `${newBadges.length} neue Auszeichnungen freigeschaltet!`}
            </Text>
            <Text style={styles.newBadgeNames}>{newBadges.map((b) => b.title).join(' · ')}</Text>
          </View>
        </View>
      )}

      <LinearGradient colors={['#1C3A29', colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroRow}>
        <HeroStat value={`${session.totalReps}`} label="Liegestütze" />
        <HeroStat value={`${session.averageFormScore}`} label="Ø Form-Score" />
        <HeroStat value={`+${session.points}`} label="Punkte" accent />
      </LinearGradient>

      <Text style={styles.sectionTitle}>Wiederholungen im Detail</Text>
      {session.reps.map((rep) => {
        const clean = rep.issues.length === 0;
        return (
          <View key={rep.index} style={styles.repRow}>
            <Ionicons
              name={clean ? 'checkmark-circle' : 'alert-circle'}
              size={26}
              color={clean ? colors.primary : colors.warning}
              style={styles.repIcon}
            />
            <View style={styles.repInfo}>
              <Text style={styles.repScore}>
                Wiederholung {rep.index + 1} · {rep.formScore} / 100
              </Text>
              <Text style={styles.repIssues}>
                {clean ? 'Saubere Ausführung' : rep.issues.map((i) => ISSUE_SHORT_LABELS_DE[i]).join(', ')}
              </Text>
            </View>
          </View>
        );
      })}
      {session.reps.length === 0 && <Text style={styles.repIssues}>Keine Wiederholungen erkannt.</Text>}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        onPress={() => navigation.popToTop()}
      >
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  trophyBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  recordNames: {
    fontFamily: fonts.regular,
    color: 'rgba(11,15,20,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  newBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  coinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  newBadgeTextWrap: {
    flex: 1,
  },
  newBadgeTitle: {
    fontFamily: fonts.bold,
    color: '#0B0F14',
    fontSize: 15,
  },
  newBadgeNames: {
    fontFamily: fonts.regular,
    color: 'rgba(11,15,20,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroValue: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
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
  repIcon: {
    marginRight: 12,
  },
  repInfo: {
    flex: 1,
  },
  repScore: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  repIssues: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    color: '#0B0F14',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
