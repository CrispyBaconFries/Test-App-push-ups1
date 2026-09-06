import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/AuthContext';
import { useDuelIdentity } from '../ranking/useDuelIdentity';
import {
  loadDivisionLeaderboard,
  loadFriendsLeaderboard,
  loadTotalRepsLeaderboard,
  loadWeeklyLeaderboard,
  type LeaderboardEntry,
} from '../ranking/leaderboardStore';
import { addFriendByCode } from '../ranking/friendsStore';
import { isFriendsFeatureEnabled, setFriendsFeatureEnabled } from '../ranking/friendsFeatureFlag';
import { loadPlayerProfile } from '../ranking/playerProfileStore';
import { flushPendingLeaderboardSync } from '../ranking/leaderboardSync';
import { loadPendingSyncQueue } from '../ranking/leaderboardSyncQueue';
import { RANK_TIERS, tierForLp } from '../ranking/ranks';
import { weekKey } from '../gamification/missions';
import { RankFrame } from '../components/RankFrame';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

type LeaderboardTab = 'total' | 'weekly' | 'division' | 'friends';

const BASE_TABS: { key: LeaderboardTab; label: string; valueLabel: string }[] = [
  { key: 'total', label: 'Gesamt', valueLabel: 'Liegestütze' },
  { key: 'weekly', label: 'Diese Woche', valueLabel: 'Liegestütze' },
  { key: 'division', label: 'Meine Liga', valueLabel: 'LP' },
  { key: 'friends', label: 'Freunde', valueLabel: 'Liegestütze' },
];

export function LeaderboardScreen({ navigation }: Props) {
  const auth = useAuth();
  const identity = useDuelIdentity();
  const me = identity.me;
  const [tab, setTab] = useState<LeaderboardTab>('total');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [friendsEnabled, setFriendsEnabled] = useState<boolean | null>(null);
  const [myFriendCode, setMyFriendCode] = useState<string | null>(null);
  const [addCodeInput, setAddCodeInput] = useState('');
  const [addFriendBusy, setAddFriendBusy] = useState(false);
  const [addFriendMessage, setAddFriendMessage] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const tabs = BASE_TABS.filter((t) => t.key !== 'friends' || friendsEnabled);

  useEffect(() => {
    isFriendsFeatureEnabled().then(setFriendsEnabled);
  }, []);

  // Nachholen liegengebliebener Rangliste-Syncs (siehe leaderboardSyncQueue.ts) - beim
  // Betreten dieses Screens ist Internet ohnehin gerade nötig, also eine gute
  // Gelegenheit dafür.
  useEffect(() => {
    flushPendingLeaderboardSync(auth.profile)
      .catch(() => {})
      .finally(() => {
        loadPendingSyncQueue().then((q) => setPendingSyncCount(q.length));
      });
  }, [auth.profile]);

  const myTier = me ? tierForLp(me.lp).tier : null;
  const myTierDefinition = RANK_TIERS.find((t) => t.tier === myTier) ?? null;

  const load = useCallback(async () => {
    if (!me) return;
    setEntries(null);
    setLoadError(false);
    try {
      if (tab === 'total') {
        setEntries(await loadTotalRepsLeaderboard());
      } else if (tab === 'weekly') {
        setEntries(await loadWeeklyLeaderboard(weekKey(new Date())));
      } else if (tab === 'friends') {
        setEntries(await loadFriendsLeaderboard(me.uid));
      } else if (myTierDefinition) {
        setEntries(await loadDivisionLeaderboard(myTierDefinition));
      }
    } catch {
      setLoadError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'friends' && me) {
      loadPlayerProfile(me.uid).then((p) => setMyFriendCode(p?.friendCode ?? null));
    }
  }, [tab, me]);

  const toggleFriendsFeature = useCallback(async (value: boolean) => {
    setFriendsEnabled(value);
    await setFriendsFeatureEnabled(value);
    if (!value) setTab((current) => (current === 'friends' ? 'total' : current));
  }, []);

  const submitAddFriend = useCallback(async () => {
    if (!me || addCodeInput.trim().length === 0) return;
    setAddFriendBusy(true);
    setAddFriendMessage(null);
    try {
      const result = await addFriendByCode(me.uid, addCodeInput);
      if (result === 'added') {
        setAddFriendMessage('Hinzugefügt!');
        setAddCodeInput('');
        load();
      } else if (result === 'already_friends') {
        setAddFriendMessage('Hast du schon in deiner Liste.');
      } else if (result === 'is_self') {
        setAddFriendMessage('Das ist dein eigener Code.');
      } else {
        setAddFriendMessage('Code nicht gefunden.');
      }
    } catch {
      setAddFriendMessage('Etwas ist schiefgelaufen.');
    }
    setAddFriendBusy(false);
  }, [me, addCodeInput, load]);

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
          <Text style={styles.title}>Rangliste</Text>
          <Text style={styles.subtitle}>Wie du im Vergleich zu allen anderen dastehst</Text>
        </View>
      </View>

      {pendingSyncCount > 0 && (
        <Text style={styles.pendingHint}>
          {pendingSyncCount} Session{pendingSyncCount === 1 ? '' : 's'} warte{pendingSyncCount === 1 ? 't' : 'n'} noch auf
          Synchronisierung (kein Internet beim Trainieren) - wird automatisch nachgeholt.
        </Text>
      )}

      <View style={styles.friendsToggleRow}>
        <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.friendsToggleLabel}>Freunde-Tab anzeigen</Text>
        <Switch
          value={friendsEnabled ?? false}
          onValueChange={toggleFriendsFeature}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={({ pressed }) => [styles.tabButton, tab === t.key && styles.tabButtonActive, pressed && styles.pressed]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabButtonText, tab === t.key && styles.tabButtonTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {identity.status === 'loading' && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

      {identity.status === 'notConfigured' && (
        <Text style={styles.infoText}>
          Das Ranking-System ist noch nicht eingerichtet (siehe README „Ranking-System einrichten").
        </Text>
      )}

      {identity.status === 'needsReauth' && (
        <Text style={styles.infoText}>Bitte melde dich auf dem Home-Screen zuerst mit Google an, um Ranglisten zu sehen.</Text>
      )}

      {identity.status === 'error' && <Text style={styles.infoText}>Etwas ist schiefgelaufen. Bitte erneut versuchen.</Text>}

      {identity.status === 'ready' && tab === 'division' && myTierDefinition && (
        <Text style={styles.divisionHint}>Liga: {myTierDefinition.label}</Text>
      )}

      {identity.status === 'ready' && tab === 'friends' && (
        <View style={styles.addFriendCard}>
          {myFriendCode && <Text style={styles.myCodeHint}>Dein Code zum Teilen: {myFriendCode}</Text>}
          <View style={styles.addFriendRow}>
            <TextInput
              style={styles.addFriendInput}
              value={addCodeInput}
              onChangeText={setAddCodeInput}
              placeholder="Freundescode eingeben"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              maxLength={6}
            />
            <Pressable
              style={({ pressed }) => [styles.addFriendButton, pressed && styles.pressed]}
              onPress={submitAddFriend}
              disabled={addFriendBusy}
            >
              {addFriendBusy ? (
                <ActivityIndicator color="#0B0F14" size="small" />
              ) : (
                <Text style={styles.addFriendButtonText}>Hinzufügen</Text>
              )}
            </Pressable>
          </View>
          {addFriendMessage && <Text style={styles.addFriendMessage}>{addFriendMessage}</Text>}
        </View>
      )}

      {identity.status === 'ready' && entries == null && !loadError && (
        <ActivityIndicator color={colors.primary} style={styles.spacingTop} />
      )}

      {identity.status === 'ready' && loadError && (
        <Text style={styles.infoText}>Rangliste konnte nicht geladen werden. Bitte erneut versuchen.</Text>
      )}

      {identity.status === 'ready' && entries != null && entries.length === 0 && (
        <Text style={styles.infoText}>Hier ist noch niemand gelistet - sei der/die Erste!</Text>
      )}

      {identity.status === 'ready' && entries != null && entries.length > 0 && (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <LeaderboardRow
              rank={index + 1}
              entry={item}
              isMe={item.uid === me?.uid}
              valueLabel={tabs.find((t) => t.key === tab)?.valueLabel ?? BASE_TABS.find((t) => t.key === tab)!.valueLabel}
              onPress={() => navigation.navigate('Profile', item.uid === me?.uid ? undefined : { uid: item.uid })}
            />
          )}
        />
      )}
    </View>
  );
}

function LeaderboardRow({
  rank,
  entry,
  isMe,
  valueLabel,
  onPress,
}: {
  rank: number;
  entry: LeaderboardEntry;
  isMe: boolean;
  valueLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, isMe && styles.rowMe, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.rank}>{rank}</Text>
      <RankFrame avatar={entry.avatar} tier={tierForLp(entry.lp).tier} lp={entry.lp} size={36} frameThemeId={entry.frameThemeId} />
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowName} numberOfLines={1}>
          {entry.displayName}
          {isMe ? ' (du)' : ''}
        </Text>
      </View>
      <View style={styles.rowValueWrap}>
        <Text style={styles.rowValue}>{entry.value}</Text>
        <Text style={styles.rowValueLabel}>{valueLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    fontSize: 22,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pendingHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.warning,
    marginBottom: 10,
    lineHeight: 16,
  },
  friendsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  friendsToggleLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#0B0F14',
  },
  spacingTop: {
    marginTop: 24,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 8,
  },
  divisionHint: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  addFriendCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myCodeHint: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  addFriendRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addFriendInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
  },
  addFriendButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addFriendButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#0B0F14',
  },
  addFriendMessage: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  rowMe: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  rank: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
    width: 22,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rowTextWrap: {
    flex: 1,
  },
  rowName: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowValueWrap: {
    alignItems: 'flex-end',
  },
  rowValue: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rowValueLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
