import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { PlayerAvatar } from '../ranking/avatar';
import type { RankTier } from '../ranking/ranks';
import { frameStyleForTier } from '../ranking/rankFrameStyle';
import { colors } from '../theme/colors';

interface Props {
  avatar: PlayerAvatar;
  tier: RankTier;
  /** Durchmesser des Avatars selbst (ohne Rahmen). */
  size?: number;
}

/**
 * Avatar (Icon oder Foto) mit einem Rahmen, der den erreichten Rang zeigt - wird von
 * Bronze zu Challenger optisch immer aufwendiger (dicker, Farbverlauf, Leuchten,
 * leichtes Pulsieren bei Challenger). Die konkrete Icon-/Bild-Auswahl kommt in einem
 * späteren Schritt; hier zählt nur, dass der Rahmen schon jetzt für jeden Rang steht.
 */
export function RankFrame({ avatar, tier, size = 56 }: Props) {
  const style = frameStyleForTier(tier);
  const outerSize = size + style.borderWidth * 2;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!style.pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [style.pulse, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View
      style={[
        style.pulse && { transform: [{ scale }] },
        style.glow && styles.glowShadow,
        style.glow && { shadowColor: style.gradientColors[style.gradientColors.length - 1] },
        style.pulse && { opacity: glowOpacity },
      ]}
    >
      <LinearGradient
        colors={style.gradientColors}
        style={[
          styles.ring,
          { width: outerSize, height: outerSize, borderRadius: outerSize / 2 },
        ]}
      >
        <View style={[styles.avatarClip, { width: size, height: size, borderRadius: size / 2 }]}>
          <AvatarContent avatar={avatar} size={size} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function AvatarContent({ avatar, size }: { avatar: PlayerAvatar; size: number }) {
  if (avatar.type === 'photo') {
    return <Image source={{ uri: avatar.photoUrl }} style={{ width: size, height: size }} />;
  }
  return (
    <View style={[styles.iconBackground, { width: size, height: size }]}>
      <Ionicons name={avatar.iconId} size={size * 0.6} color={colors.textPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClip: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  iconBackground: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  glowShadow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
});
