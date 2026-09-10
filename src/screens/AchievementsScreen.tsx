import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { loadSessions, computeStats } from '../storage/workoutStorage';
import { computeBadgeStatuses, type BadgeStatus } from '../gamification/badges';
import { colors } from '../theme/colors';
import { font, radius, space } from '../theme/layout';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

export function AchievementsScreen({ navigation }: Props) {
  const [badges, setBadges] = useState<BadgeStatus[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then((sessions) => {
        setBadges(computeBadgeStatuses(computeStats(sessions), sessions));
      });
    }, [])
  );

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.title}>Auszeichnungen</Text>
          <Text style={styles.subtitle}>
            {unlockedCount} / {badges.length} freigeschaltet
          </Text>
        </View>
      </View>

      <FlatList
        data={badges}
        keyExtractor={(item) => item.definition.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <BadgeRow status={item} />}
      />
    </View>
  );
}

function BadgeRow({ status }: { status: BadgeStatus }) {
  const { definition, unlocked, progressLabel } = status;
  return (
    <View style={[styles.row, !unlocked && styles.rowLocked]}>
      <View style={[styles.iconBadge, unlocked && styles.iconBadgeUnlocked]}>
        <Ionicons
          name={(unlocked ? definition.icon : 'lock-closed') as never}
          size={20}
          color={unlocked ? '#0B0F14' : colors.textSecondary}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.rowTitle, !unlocked && styles.rowTitleLocked]}>{definition.title}</Text>
        <Text style={styles.rowDescription}>{definition.description}</Text>
        {!unlocked && <Text style={styles.rowProgress}>{progressLabel}</Text>}
      </View>
      {unlocked && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: space(56),
    paddingHorizontal: space(24),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space(20),
    gap: space(12),
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: font(22),
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: font(13),
    color: colors.textSecondary,
    marginTop: space(2),
  },
  listContent: {
    paddingBottom: space(40),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius(16),
    padding: space(14),
    marginBottom: space(12),
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLocked: {
    opacity: 0.6,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius(14),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(14),
  },
  iconBadgeUnlocked: {
    backgroundColor: colors.primary,
  },
  textWrap: {
    flex: 1,
    marginRight: space(8),
  },
  rowTitle: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: font(15),
  },
  rowTitleLocked: {
    color: colors.textSecondary,
  },
  rowDescription: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: font(12),
    marginTop: space(2),
  },
  rowProgress: {
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    fontSize: font(12),
    marginTop: space(4),
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
