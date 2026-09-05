import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export interface LevelProgressBarProps {
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
}

export function LevelProgressBar({ level, pointsIntoLevel, pointsForNextLevel }: LevelProgressBarProps) {
  const progress = pointsForNextLevel > 0 ? pointsIntoLevel / pointsForNextLevel : 0;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Level {level}</Text>
        <Text style={styles.pointsLabel}>
          {pointsIntoLevel} / {pointsForNextLevel}
        </Text>
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
