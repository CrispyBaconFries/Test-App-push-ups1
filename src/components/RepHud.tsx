import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { LiveFeedback, RepResult } from '../pose/formAnalysis';
import { liveCueLabelDe } from '../pose/feedbackText';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export interface RepHudProps {
  repCount: number;
  live: LiveFeedback | null;
  lastRep: RepResult | null;
  trackingOk: boolean;
}

const CUE_COLORS: Record<string, string> = {
  GOOD_FORM: colors.primary,
  DEFAULT: colors.danger,
};

export function RepHud({ repCount, live, lastRep, trackingOk }: RepHudProps) {
  const cueLabel = live ? liveCueLabelDe(live.cue) : '';
  const cueColor = live?.cue === 'GOOD_FORM' ? CUE_COLORS.GOOD_FORM : CUE_COLORS.DEFAULT;

  // A small pop on every new rep - the one moment of tactile feedback a user gets mid-set.
  const scale = useRef(new Animated.Value(1)).current;
  const previousCount = useRef(repCount);
  useEffect(() => {
    if (repCount !== previousCount.current) {
      previousCount.current = repCount;
      scale.setValue(1.3);
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
    }
  }, [repCount, scale]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Rep counter: centered top, the one number a user glances at mid-set. */}
      <View style={styles.repCounterRow}>
        <Animated.View style={[styles.repCounterBadge, { transform: [{ scale }] }]}>
          <Text style={styles.repCountText}>{repCount}</Text>
          <Text style={styles.repCountLabel}>Wiederholungen</Text>
        </Animated.View>
      </View>

      {lastRep && (
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreValue}>{lastRep.formScore}</Text>
          <Text style={styles.scoreLabel}>Form-Score</Text>
        </View>
      )}

      {!trackingOk && (
        <View style={styles.cueBar}>
          <Text style={[styles.cueText, { color: colors.warning }]}>Nicht vollständig im Bild – bitte zurücktreten</Text>
        </View>
      )}

      {trackingOk && cueLabel !== '' && (
        <View style={styles.cueBar}>
          <Text style={[styles.cueText, { color: cueColor }]}>{cueLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // A full-width, transparent row so `alignItems: 'center'` centers the badge on the
  // screen regardless of the (variable-width) score badge sitting in the top-right corner.
  repCounterRow: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  repCounterBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  repCountText: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  repCountLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  scoreValue: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.primary,
  },
  scoreLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  cueBar: {
    position: 'absolute',
    bottom: 108,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  cueText: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'center',
    overflow: 'hidden',
  },
});
