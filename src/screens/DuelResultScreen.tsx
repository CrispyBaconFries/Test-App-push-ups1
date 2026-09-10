import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { listenToDuel, type DuelPlayerState } from '../duel/duelSession';
import { recordDuelCompleted } from '../duel/duelLog';
import { applyDuelResult } from '../ranking/playerProfileStore';
import { RankFrame } from '../components/RankFrame';
import { colors } from '../theme/colors';
import { font, radius, space } from '../theme/layout';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'DuelResult'>;

type Outcome = 'win' | 'loss' | 'draw';

export function DuelResultScreen({ route, navigation }: Props) {
  const { duelCode, me, isRanked } = route.params;
  const [opponent, setOpponent] = useState<DuelPlayerState | null>(null);
  const [myFinalReps, setMyFinalReps] = useState<number | null>(null);
  const [lpChange, setLpChange] = useState<number | null>(null);
  const lpAppliedRef = useRef(false);
  const duelLoggedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = listenToDuel(duelCode, (state) => {
      if (!state) return;
      const mine = state.players[me.uid];
      const opponentEntry = Object.entries(state.players).find(([uid]) => uid !== me.uid);
      if (mine?.finished) setMyFinalReps(mine.finishedReps);
      if (opponentEntry?.[1]?.finished) setOpponent(opponentEntry[1]);
    });
    return unsubscribe;
  }, [duelCode, me.uid]);

  const bothFinished = myFinalReps != null && opponent != null;
  const outcome: Outcome | null = bothFinished
    ? myFinalReps! > opponent!.finishedReps!
      ? 'win'
      : myFinalReps! < opponent!.finishedReps!
        ? 'loss'
        : 'draw'
    : null;

  useEffect(() => {
    if (!bothFinished || !isRanked || outcome === 'draw' || lpAppliedRef.current || !opponent) return;
    lpAppliedRef.current = true;
    applyDuelResult({
      myUid: me.uid,
      myLpBefore: me.lp,
      opponentLpBefore: opponent.lp,
      didIWin: outcome === 'win',
    })
      .then(({ lpChange: change }) => setLpChange(change))
      .catch(() => {});
  }, [bothFinished, isRanked, outcome, opponent, me]);

  // Any concluded duel (win/loss/draw alike) counts toward the weekly "3
  // Freundschaftsspiele"/"3 Ranglistenspiele" missions - see src/gamification/missions.ts.
  useEffect(() => {
    if (!bothFinished || duelLoggedRef.current) return;
    duelLoggedRef.current = true;
    recordDuelCompleted(isRanked).catch(() => {});
  }, [bothFinished, isRanked]);

  return (
    <View style={styles.container}>
      {!bothFinished ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.waitingText}>Warte auf das Ergebnis deines Gegners…</Text>
        </View>
      ) : (
        <>
          <View style={styles.outcomeBadge}>
            <Ionicons
              name={outcome === 'win' ? 'trophy' : outcome === 'loss' ? 'flag-outline' : 'people-outline'}
              size={28}
              color="#0B0F14"
            />
          </View>
          <Text style={styles.outcomeTitle}>
            {outcome === 'win' ? 'Gewonnen!' : outcome === 'loss' ? 'Verloren' : 'Unentschieden'}
          </Text>

          <View style={styles.tallyRow}>
            <PlayerTally
              label={me.displayName}
              avatar={me.avatar}
              tier={me.tier}
              lp={me.lp}
              reps={myFinalReps!}
              highlight={outcome === 'win'}
            />
            <Text style={styles.vsText}>vs</Text>
            <PlayerTally
              label={opponent!.displayName}
              avatar={opponent!.avatar}
              tier={opponent!.tier}
              lp={opponent!.lp}
              reps={opponent!.finishedReps!}
              highlight={outcome === 'loss'}
            />
          </View>

          {isRanked && outcome !== 'draw' && (
            <Text style={[styles.lpText, { color: outcome === 'win' ? colors.primary : colors.danger }]}>
              {lpChange != null ? `${lpChange > 0 ? '+' : ''}${lpChange} LP` : 'LP wird berechnet…'}
            </Text>
          )}
          {!isRanked && <Text style={styles.friendlyHint}>Freundschaftsspiel - kein Einfluss auf deinen Rang.</Text>}

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => navigation.popToTop()}
          >
            <Text style={styles.primaryButtonText}>Fertig</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function PlayerTally({
  label,
  avatar,
  tier,
  lp,
  reps,
  highlight,
}: {
  label: string;
  avatar: DuelPlayerState['avatar'];
  tier: DuelPlayerState['tier'];
  lp: number;
  reps: number;
  highlight: boolean;
}) {
  return (
    <View style={styles.tallyItem}>
      <RankFrame avatar={avatar} tier={tier} lp={lp} size={56} />
      <Text style={[styles.tallyReps, highlight && { color: colors.primary }]}>{reps}</Text>
      <Text style={styles.tallyName} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: space(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: {
    alignItems: 'center',
    gap: space(16),
  },
  waitingText: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: font(15),
    textAlign: 'center',
  },
  outcomeBadge: {
    width: 56,
    height: 56,
    borderRadius: radius(18),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(16),
  },
  outcomeTitle: {
    fontFamily: fonts.extraBold,
    fontSize: font(26),
    color: colors.textPrimary,
    marginBottom: space(32),
  },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(24),
    marginBottom: space(24),
  },
  tallyItem: {
    alignItems: 'center',
    gap: space(8),
    width: 110,
  },
  tallyReps: {
    fontFamily: fonts.extraBold,
    fontSize: font(32),
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tallyName: {
    fontFamily: fonts.semiBold,
    fontSize: font(13),
    color: colors.textSecondary,
  },
  vsText: {
    fontFamily: fonts.bold,
    fontSize: font(14),
    color: colors.textSecondary,
  },
  lpText: {
    fontFamily: fonts.extraBold,
    fontSize: font(20),
    marginBottom: space(32),
  },
  friendlyHint: {
    fontFamily: fonts.regular,
    fontSize: font(13),
    color: colors.textSecondary,
    marginBottom: space(32),
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius(16),
    paddingVertical: space(16),
    paddingHorizontal: space(48),
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    color: '#0B0F14',
    fontSize: font(16),
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
