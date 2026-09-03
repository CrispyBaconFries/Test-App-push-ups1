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
      <View style={styles.topRow}>
        <View style={styles.repBadge}>
          <Text style={styles.repCount}>{repCount}</Text>
          <Text style={styles.repLabel}>Wiederholungen</Text>
        </View>
        {lastRep && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>{lastRep.formScore}</Text>
            <Text style={styles.repLabel}>Form-Score</Text>
          </View>
        )}
      </View>

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
    justifyContent: 'space-between',
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  repBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scoreBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  repCount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#37E27C',
  },
  repLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  cueBar: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  cueText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
