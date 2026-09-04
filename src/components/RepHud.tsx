import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LiveFeedback, RepResult } from '../pose/formAnalysis';
import { liveCueLabelDe } from '../pose/feedbackText';

export interface RepHudProps {
  repCount: number;
  live: LiveFeedback | null;
  lastRep: RepResult | null;
  trackingOk: boolean;
}

const CUE_COLORS: Record<string, string> = {
  GOOD_FORM: '#37E27C',
  DEFAULT: '#FF5A5F',
};

export function RepHud({ repCount, live, lastRep, trackingOk }: RepHudProps) {
  const cueLabel = live ? liveCueLabelDe(live.cue) : '';
  const cueColor = live?.cue === 'GOOD_FORM' ? CUE_COLORS.GOOD_FORM : CUE_COLORS.DEFAULT;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Rep counter: centered top, the one number a user glances at mid-set. */}
      <View style={styles.repCounterRow}>
        <View style={styles.repCounterBadge}>
          <Text style={styles.repCountText}>{repCount}</Text>
          <Text style={styles.repCountLabel}>Wiederholungen</Text>
        </View>
      </View>

      {lastRep && (
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreValue}>{lastRep.formScore}</Text>
          <Text style={styles.scoreLabel}>Form-Score</Text>
        </View>
      )}

      {!trackingOk && (
        <View style={styles.cueBar}>
          <Text style={[styles.cueText, { color: '#FFC24B' }]}>Nicht vollständig im Bild – bitte zurücktreten</Text>
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
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  repCountLabel: {
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 20,
    fontWeight: '800',
    color: '#37E27C',
  },
  scoreLabel: {
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
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    overflow: 'hidden',
  },
});
