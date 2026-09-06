import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/AuthContext';
import { useDuelIdentity } from '../ranking/useDuelIdentity';
import { loadPlayerProfile } from '../ranking/playerProfileStore';
import type { RankedPlayerProfile } from '../ranking/playerProfile';
import { tierForLp, RANK_TIERS } from '../ranking/ranks';
import { startOfWeek, weekKey } from '../gamification/missions';
import { loadSessions, computeStats, type WorkoutSession } from '../storage/workoutStorage';
import { computeBadgeStatuses } from '../gamification/badges';
import { levelForPoints } from '../gamification/points';
import { RankFrame } from '../components/RankFrame';
import { LevelProgressBar } from '../components/LevelProgressBar';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ route, navigation }: Props) {
  const viewingUid = route.params?.uid;
  const isOwnProfile = viewingUid === undefined;

  const auth = useAuth();
  const identity = useDuelIdentity();
  const me = identity.me;

  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [onlineProfile, setOnlineProfile] = useState<RankedPlayerProfile | null>(null);
  const [otherProfile, setOtherProfile] = useState<RankedPlayerProfile | null | 'not_found'>(null);

  useFocusEffect(
    useCallback(() => {
      if (isOwnProfile) loadSessions().then(setSessions);
    }, [isOwnProfile])
  );

  useEffect(() => {
    if (isOwnProfile && me) {
      loadPlayerProfile(me.uid).then(setOnlineProfile);
    }
  }, [isOwnProfile, me]);

  useEffect(() => {
    if (!isOwnProfile && viewingUid) {
      loadPlayerProfile(viewingUid).then((p) => setOtherProfile(p ?? 'not_found'));
    }
  }, [isOwnProfile, viewingUid]);

  if (!isOwnProfile) {
    if (otherProfile === null) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (otherProfile === 'not_found') {
      return (
        <View style={styles.centered}>
          <Text style={styles.infoText}>Profil nicht gefunden.</Text>
          <BackLink navigation={navigation} />
        </View>
      );
    }
    return <OtherProfileView profile={otherProfile} navigation={navigation} />;
  }

  const stats = sessions ? computeStats(sessions) : null;
  const badgeCount = sessions && stats ? computeBadgeStatuses(stats, sessions).filter((b) => b.unlocked).length : 0;
  const weeklyReps = sessions
    ? sessions.filter((s) => new Date(s.finishedAtIso) >= startOfWeek(new Date())).reduce((sum, s) => sum + s.totalReps, 0)
    : 0;
  const level = stats ? levelForPoints(stats.totalPoints) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.title}>Mein Profil</Text>
          <Text style={styles.subtitle}>{auth.profile?.name ?? auth.profile?.email ?? 'Nicht angemeldet'}</Text>
        </View>
      </View>

      {me && (
        <View style={styles.avatarRow}>
          <RankFrame avatar={me.avatar} tier={me.tier} lp={me.lp} size={72} frameThemeId={onlineProfile?.frameThemeId} />
          <View style={styles.avatarTextWrap}>
            <Text style={styles.tierLabel}>{RANK_TIERS.find((t) => t.tier === me.tier)?.label ?? me.tier}</Text>
            <Text style={styles.lpLabel}>{me.lp} LP</Text>
            {onlineProfile && (
              <Text style={styles.recordLabel}>
                {onlineProfile.wins} Siege · {onlineProfile.losses} Niederlagen
              </Text>
            )}
          </View>
        </View>
      )}

      {level && (
        <View style={styles.card}>
          <LevelProgressBar
            level={level.level}
            pointsIntoLevel={level.pointsIntoLevel}
            pointsForNextLevel={level.pointsForNextLevel}
            isMaxLevel={level.isMaxLevel}
          />
        </View>
      )}

      <View style={styles.statsRow}>
        <StatTile icon="barbell-outline" value={`${stats?.totalReps ?? 0}`} label="Liegestütze gesamt" />
        <StatTile icon="calendar-outline" value={`${weeklyReps}`} label="Diese Woche" />
        <StatTile icon="flame" value={`${stats?.currentStreakDays ?? 0}`} label="Tage Streak" iconColor={colors.accent} />
        <StatTile icon="ribbon-outline" value={`${badgeCount}`} label="Abzeichen" />
      </View>

      {onlineProfile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Freundescode</Text>
          <Text style={styles.friendCode}>{onlineProfile.friendCode}</Text>
          <Text style={styles.cardHint}>Teile diesen Code, damit dich andere zu ihrer Freundesliste hinzufügen können.</Text>
        </View>
      )}

      <Pressable style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]} onPress={() => navigation.navigate('Shop')}>
        <Ionicons name="cash" size={18} color="#0B0F14" />
        <Text style={styles.shopButtonText}>Zum Münz-Shop</Text>
      </Pressable>
    </ScrollView>
  );
}

function OtherProfileView({
  profile,
  navigation,
}: {
  profile: RankedPlayerProfile;
  navigation: Props['navigation'];
}) {
  const tier = tierForLp(profile.lp).tier;
  const tierDefinition = RANK_TIERS.find((t) => t.tier === tier);
  const level = levelForPoints(profile.totalPoints ?? 0);
  const weeklyReps = profile.weeklyBucketKey === weekKey(new Date()) ? profile.weeklyReps ?? 0 : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.title}>{profile.displayName}</Text>
          <Text style={styles.subtitle}>Profil</Text>
        </View>
      </View>

      <View style={styles.avatarRow}>
        <RankFrame avatar={profile.avatar} tier={tier} lp={profile.lp} size={72} frameThemeId={profile.frameThemeId} />
        <View style={styles.avatarTextWrap}>
          <Text style={styles.tierLabel}>{tierDefinition?.label ?? tier}</Text>
          <Text style={styles.lpLabel}>{profile.lp} LP</Text>
          <Text style={styles.recordLabel}>
            {profile.wins} Siege · {profile.losses} Niederlagen
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <LevelProgressBar
          level={level.level}
          pointsIntoLevel={level.pointsIntoLevel}
          pointsForNextLevel={level.pointsForNextLevel}
          isMaxLevel={level.isMaxLevel}
        />
      </View>

      <View style={styles.statsRow}>
        <StatTile icon="barbell-outline" value={`${profile.totalReps ?? 0}`} label="Liegestütze gesamt" />
        <StatTile icon="calendar-outline" value={`${weeklyReps}`} label="Diese Woche" />
      </View>
    </ScrollView>
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

function BackLink({ navigation }: { navigation: Props['navigation'] }) {
  return (
    <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
      <Text style={styles.linkButtonText}>Zurück</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatarTextWrap: {
    flex: 1,
  },
  tierLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  lpLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recordLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
  },
  friendCode: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statTile: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  shopButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#0B0F14',
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  linkButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    fontSize: 14,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
