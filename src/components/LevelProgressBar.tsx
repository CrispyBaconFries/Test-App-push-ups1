import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export interface LevelProgressBarProps {
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  isMaxLevel?: boolean;
}

export function LevelProgressBar({ level, pointsIntoLevel, pointsForNextLevel, isMaxLevel }: LevelProgressBarProps) {
  const progress = isMaxLevel ? 1 : pointsForNextLevel > 0 ? pointsIntoLevel / pointsForNextLevel : 0;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Level {level}{isMaxLevel ? ' · MAX' : ''}</Text>
        <Text style={styles.pointsLabel}>{isMaxLevel ? 'Höchststufe erreicht' : `${pointsIntoLevel} / ${pointsForNextLevel}`}</Text>
      </View>
      <ProgressBar progress={progress} />
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  pointsLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
