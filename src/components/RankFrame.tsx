import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PlayerAvatar } from '../ranking/avatar';
import type { RankTier } from '../ranking/ranks';
import { frameStyleForTier } from '../ranking/rankFrameStyle';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Props {
  avatar: PlayerAvatar;
  tier: RankTier;
  /** Aktuelle LP - wird anstelle des Platzhalter-Icons angezeigt (siehe AvatarContent). */
  lp: number;
  /** Durchmesser des Avatars selbst (ohne Rahmen). */
  size?: number;
}

/**
 * Avatar (Icon oder Foto) mit einem Rahmen, der den erreichten Rang zeigt - wird von
 * Bronze zu Challenger optisch immer aufwendiger (dicker, Farbverlauf, Leuchten,
 * leichtes Pulsieren bei Challenger). Die konkrete Icon-/Bild-Auswahl kommt in einem
 * späteren Schritt; hier zählt nur, dass der Rahmen schon jetzt für jeden Rang steht.
 */
export function RankFrame({ avatar, tier, lp, size = 56 }: Props) {
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
          <AvatarContent avatar={avatar} lp={lp} size={size} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function AvatarContent({ avatar, lp, size }: { avatar: PlayerAvatar; lp: number; size: number }) {
  if (avatar.type === 'photo') {
    return <Image source={{ uri: avatar.photoUrl }} style={{ width: size, height: size }} />;
  }
  // Platzhalter-Icons (avatar.iconId) sind noch nicht final gestaltet - bis dahin
  // zeigt der Avatar stattdessen die aktuelle Rang-Punktzahl (LP), das ist informativer
  // als ein austauschbares Symbol. Sobald die richtigen Icons/Fotos da sind, kann
  // dieser Zweig wieder `avatar.iconId` rendern.
  return (
    <View style={[styles.iconBackground, { width: size, height: size }]}>
      <Text
        style={[styles.lpText, { fontSize: size * 0.34 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        allowFontScaling={false}
      >
        {lp}
      </Text>
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
  lpText: {
    fontFamily: fonts.extraBold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  glowShadow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
});
