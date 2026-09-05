import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export interface LevelProgressBarProps {
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
}

export function LevelProgressBar({ level, pointsIntoLevel, pointsForNextLevel }: LevelProgressBarProps) {
  const progress = pointsForNextLevel > 0 ? pointsIntoLevel / pointsForNextLevel : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false, // animating `width` isn't supported by the native driver
    }).start();
  }, [progress, widthAnim]);

  const width = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Level {level}</Text>
        <Text style={styles.pointsLabel}>
          {pointsIntoLevel} / {pointsForNextLevel}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
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
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
