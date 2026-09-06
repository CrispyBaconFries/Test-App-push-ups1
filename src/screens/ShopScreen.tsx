import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useDuelIdentity } from '../ranking/useDuelIdentity';
import { loadPlayerProfile } from '../ranking/playerProfileStore';
import type { RankedPlayerProfile } from '../ranking/playerProfile';
import { SHOP_ITEMS, type ShopItem } from '../gamification/shop';
import {
  equipOwnedAvatar,
  equipOwnedFrameTheme,
  loadOwnedAvatarIconIds,
  loadOwnedFrameThemeIds,
  purchaseItem,
} from '../gamification/inventoryStore';
import { getCoinBalance } from '../gamification/currencyStore';
import { getHeldStreakFreezes } from '../gamification/streakFreezeStore';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Shop'>;

export function ShopScreen({ navigation }: Props) {
  const identity = useDuelIdentity();
  const me = identity.me;

  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [heldFreezes, setHeldFreezes] = useState<number | null>(null);
  const [profile, setProfile] = useState<RankedPlayerProfile | null>(null);
  const [ownedAvatars, setOwnedAvatars] = useState<Set<string>>(new Set());
  const [ownedFrames, setOwnedFrames] = useState<Set<string>>(new Set());
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setCoinBalance(await getCoinBalance());
    setHeldFreezes(await getHeldStreakFreezes());
    setOwnedAvatars(await loadOwnedAvatarIconIds());
    setOwnedFrames(await loadOwnedFrameThemeIds());
    if (me) setProfile(await loadPlayerProfile(me.uid));
  }, [me]);

  useEffect(() => {
    reload();
  }, [reload]);

  const buy = useCallback(
    async (item: ShopItem) => {
      setBusyItemId(item.id);
      const result = await purchaseItem(item, me?.uid ?? null);
      setBusyItemId(null);
      if (!result.ok) {
        if (result.reason === 'insufficient_funds') {
          Alert.alert('Zu wenig Münzen', `Dafür fehlen dir noch ${item.price - result.balance} Münzen.`);
        } else {
          Alert.alert('Nicht angemeldet', 'Dafür musst du auf dem Home-Screen zuerst mit Google angemeldet sein.');
        }
        return;
      }
      await reload();
    },
    [me, reload]
  );

  const equip = useCallback(
    async (item: ShopItem) => {
      if (!me) return;
      if (item.category === 'avatar') await equipOwnedAvatar(me.uid, item.iconId);
      if (item.category === 'frame') await equipOwnedFrameTheme(me.uid, item.frameThemeId);
      await reload();
    },
    [me, reload]
  );

  const isEquipped = (item: ShopItem): boolean => {
    if (item.category === 'avatar') return profile?.avatar.type === 'icon' && profile.avatar.iconId === item.iconId;
    if (item.category === 'frame') return profile?.frameThemeId === item.frameThemeId;
    return false;
  };

  const streakFreezeItems = SHOP_ITEMS.filter((i) => i.category === 'streak_freeze');
  const avatarItems = SHOP_ITEMS.filter((i) => i.category === 'avatar');
  const frameItems = SHOP_ITEMS.filter((i) => i.category === 'frame');
  const cosmeticsReady = identity.status === 'ready';

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
          <Text style={styles.title}>Münz-Shop</Text>
          <Text style={styles.subtitle}>Münzen aus Missionen gegen Kosmetik & Sicherheitsnetze eintauschen</Text>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceChip}>
          <Ionicons name="cash" size={16} color={colors.warning} />
          <Text style={styles.balanceChipText}>{coinBalance ?? '…'}</Text>
        </View>
        <View style={styles.balanceChip}>
          <Ionicons name="snow" size={16} color={colors.primary} />
          <Text style={styles.balanceChipText}>{heldFreezes ?? '…'} Rettungen</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Streak-Rettung</Text>
      <Text style={styles.sectionHint}>
        Rein lokal, keine Anmeldung nötig - schützt automatisch vor dem nächsten verpassten Trainingstag.
      </Text>
      {streakFreezeItems.map((item) => (
        <ShopRow
          key={item.id}
          item={item}
          owned={false}
          equipped={false}
          disabled={busyItemId === item.id}
          onBuy={() => buy(item)}
          onEquip={() => {}}
          actionLabel={`Kaufen (+1)`}
        />
      ))}

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Avatare</Text>
      {!cosmeticsReady ? (
        <GatedHint status={identity.status} />
      ) : (
        avatarItems.map((item) => (
          <ShopRow
            key={item.id}
            item={item}
            owned={ownedAvatars.has(item.id)}
            equipped={isEquipped(item)}
            disabled={busyItemId === item.id}
            onBuy={() => buy(item)}
            onEquip={() => equip(item)}
          />
        ))
      )}

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Rahmen-Themes</Text>
      {!cosmeticsReady ? (
        <GatedHint status={identity.status} />
      ) : (
        frameItems.map((item) => (
          <ShopRow
            key={item.id}
            item={item}
            owned={ownedFrames.has(item.id)}
            equipped={isEquipped(item)}
            disabled={busyItemId === item.id}
            onBuy={() => buy(item)}
            onEquip={() => equip(item)}
          />
        ))
      )}
    </ScrollView>
  );
}

function GatedHint({ status }: { status: string }) {
  if (status === 'loading') return <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} />;
  return (
    <Text style={styles.infoText}>
      {status === 'notConfigured'
        ? 'Das Ranking-System ist noch nicht eingerichtet (siehe README „Ranking-System einrichten").'
        : 'Bitte melde dich auf dem Home-Screen zuerst mit Google an - Avatare/Rahmen werden serverseitig gespeichert, damit andere sie in Duellen/Ranglisten sehen.'}
    </Text>
  );
}

function ShopRow({
  item,
  owned,
  equipped,
  disabled,
  onBuy,
  onEquip,
  actionLabel,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  disabled: boolean;
  onBuy: () => void;
  onEquip: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconBadge, equipped && styles.iconBadgeEquipped]}>
        <Ionicons name={item.icon as never} size={20} color={equipped ? '#0B0F14' : colors.textPrimary} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDescription}>{item.description}</Text>
      </View>
      {owned ? (
        <Pressable
          style={({ pressed }) => [styles.actionButton, equipped && styles.actionButtonEquipped, pressed && styles.pressed]}
          disabled={equipped}
          onPress={onEquip}
        >
          <Text style={[styles.actionButtonText, equipped && styles.actionButtonTextEquipped]}>
            {equipped ? 'Ausgerüstet' : 'Ausrüsten'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          disabled={disabled}
          onPress={onBuy}
        >
          {disabled ? (
            <ActivityIndicator color="#0B0F14" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>{actionLabel ?? `${item.price} 🪙`}</Text>
          )}
        </Pressable>
      )}
    </View>
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
    fontSize: 22,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    maxWidth: 260,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceChipText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeEquipped: {
    backgroundColor: colors.primary,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowDescription: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 84,
    alignItems: 'center',
  },
  actionButtonEquipped: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#0B0F14',
  },
  actionButtonTextEquipped: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
