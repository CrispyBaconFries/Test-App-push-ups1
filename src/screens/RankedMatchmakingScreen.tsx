import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useDuelIdentity } from '../ranking/useDuelIdentity';
import { searchRadiusForWaitTime } from '../ranking/matchmaking';
import { findCandidates, joinQueue, leaveQueue, listenToMyQueueEntry, tryClaimCandidate } from '../ranking/matchmakingQueue';
import { generateDuelCode } from '../duel/duelCode';
import { createDuel, joinDuel } from '../duel/duelSession';
import { RankFrame } from '../components/RankFrame';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'RankedMatchmaking'>;

const SEARCH_INTERVAL_MS = 2_500;

export function RankedMatchmakingScreen({ navigation }: Props) {
  const identity = useDuelIdentity();
  const me = identity.me;
  const [searching, setSearching] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const queuedAtRef = useRef<number | null>(null);
  const matchedRef = useRef(false);
  const searchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueUnsubscribeRef = useRef<(() => void) | null>(null);

  const stopSearching = useCallback(() => {
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    if (displayIntervalRef.current) clearInterval(displayIntervalRef.current);
    queueUnsubscribeRef.current?.();
    searchIntervalRef.current = null;
    displayIntervalRef.current = null;
    queueUnsubscribeRef.current = null;
  }, []);

  const enterDuel = useCallback(
    (duelCode: string) => {
      if (matchedRef.current) return;
      matchedRef.current = true;
      stopSearching();
      navigation.replace('Duel', { duelCode, me: me!, isRanked: true });
    },
    [me, navigation, stopSearching]
  );

  const startSearching = useCallback(async () => {
    if (!me) return;
    setSearching(true);
    queuedAtRef.current = Date.now();
    matchedRef.current = false;
    await joinQueue(me);

    // Jemand anderes könnte mich claimen, während ich selbst suche - beides läuft
    // parallel (siehe README "Ranking-System einrichten" für die Gesamt-Logik).
    queueUnsubscribeRef.current = listenToMyQueueEntry(me.uid, (entry) => {
      if (entry?.status === 'matched' && entry.matchedDuelCode) {
        joinDuel(entry.matchedDuelCode, me)
          .then(() => enterDuel(entry.matchedDuelCode!))
          .catch(() => {});
      }
    });

    displayIntervalRef.current = setInterval(() => {
      setWaitSeconds(Math.floor((Date.now() - (queuedAtRef.current ?? Date.now())) / 1000));
    }, 500);

    searchIntervalRef.current = setInterval(async () => {
      if (matchedRef.current || !queuedAtRef.current) return;
      const radius = searchRadiusForWaitTime(Date.now() - queuedAtRef.current);
      try {
        const candidates = await findCandidates(me.uid, me.lp, radius);
        for (const candidate of candidates) {
          const duelCode = generateDuelCode();
          const claimed = await tryClaimCandidate(candidate.uid, duelCode);
          if (claimed) {
            await createDuel(duelCode, me);
            enterDuel(duelCode);
            return;
          }
        }
      } catch {
        // Ein einzelner fehlgeschlagener Suchdurchlauf ist kein Problem - der nächste
        // Intervall-Tick versucht es einfach erneut.
      }
    }, SEARCH_INTERVAL_MS);
  }, [me, enterDuel]);

  const cancelSearch = useCallback(() => {
    stopSearching();
    setSearching(false);
    if (me) leaveQueue(me.uid).catch(() => {});
  }, [me, stopSearching]);

  useEffect(() => {
    return () => {
      stopSearching();
      if (matchedRef.current) return; // erfolgreich gematcht - Eintrag gehört jetzt zum Duell
      if (me) leaveQueue(me.uid).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        onPress={() => (searching ? cancelSearch() : navigation.goBack())}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </Pressable>

      <Text style={styles.title}>Ranked</Text>
      <Text style={styles.subtitle}>Gegner mit ähnlichem Rang, 60 Sekunden, LP auf dem Spiel.</Text>

      {identity.status === 'loading' && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

      {identity.status === 'notConfigured' && (
        <Text style={styles.infoText}>
          Das Ranking-System ist noch nicht eingerichtet (siehe README „Ranking-System einrichten").
        </Text>
      )}

      {identity.status === 'needsReauth' && (
        <Text style={styles.infoText}>Bitte melde dich auf dem Home-Screen zuerst mit Google an.</Text>
      )}

      {identity.status === 'error' && <Text style={styles.infoText}>Etwas ist schiefgelaufen. Bitte erneut versuchen.</Text>}

      {me && (
        <View style={styles.avatarPreview}>
          <RankFrame avatar={me.avatar} tier={me.tier} lp={me.lp} size={64} />
          <Text style={styles.avatarName}>{me.displayName}</Text>
        </View>
      )}

      {me && !searching && (
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={startSearching}>
          <Ionicons name="search-outline" size={20} color="#0B0F14" />
          <Text style={styles.primaryButtonText}>Gegner suchen</Text>
        </Pressable>
      )}

      {searching && (
        <View style={styles.waitingCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.waitingHint}>Suche Gegner… {waitSeconds}s</Text>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={cancelSearch}>
            <Text style={styles.secondaryButtonText}>Abbrechen</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 24,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  spacingTop: {
    marginTop: 24,
  },
  avatarPreview: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  avatarName: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    color: '#0B0F14',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  waitingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waitingHint: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
