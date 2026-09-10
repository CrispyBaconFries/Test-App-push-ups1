import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { StartPositionProgress, StartPositionStatus } from '../pose/startPosition';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

/**
 * Der Bildschirm, solange noch nicht gezählt wird: "geh in Position und halt sie kurz".
 *
 * Bewusst großflächig und mit wenig Text: Wer das liest, liegt zwei Meter entfernt im
 * Stütz und schaut auf ein Handy am Boden. Der Fortschrittsbalken ist die eigentliche
 * Information - er zeigt, ob das Stillhalten gerade *anerkannt* wird oder nicht, und das
 * lässt sich auch aus dem Augenwinkel erkennen. Der Grund darunter beantwortet die einzige
 * Frage, die sonst offen bliebe: Warum passiert nichts?
 */

const TITLES: Record<StartPositionStatus, string> = {
  NO_POSE: 'Ich sehe dich nicht',
  ARMS_BENT: 'Geh in die Liegestütz-Position',
  NOT_A_PLANK: 'Geh in die Liegestütz-Position',
  MOVING: 'Ruhig halten',
  HOLDING: 'Ruhig halten',
};

const HINTS: Record<StartPositionStatus, string> = {
  NO_POSE: 'Stell das Handy weiter weg, sodass Kopf, Schultern und Arme im Bild sind.',
  ARMS_BENT: 'Arme durchstrecken – die obere Position eines Liegestützes.',
  NOT_A_PLANK: 'Körper strecken: Schultern, Hüfte und Knie auf einer Linie.',
  MOVING: 'Noch etwas unruhig – kurz nicht bewegen.',
  HOLDING: 'Position wird vermessen …',
};

export interface StartPositionOverlayProps {
  progress: StartPositionProgress;
}

export function StartPositionOverlay({ progress }: StartPositionOverlayProps) {
  const ratio = Math.min(1, progress.heldMs / Math.max(1, progress.requiredMs));
  // Nur 'HOLDING' ist grün: Der Balken soll ehrlich sagen, ob die Haltezeit gerade
  // *anerkannt* wird. 'MOVING' heißt "in Position, aber noch zu unruhig" - das ist ein
  // Hinweis, keine Bestätigung.
  const accepted = progress.status === 'HOLDING';

  // Der Balken wird animiert und nicht direkt gesetzt: Bei ~30 Bildern/s sähe ein
  // ungeglätteter Wert bei jedem verrutschten Frame wie ein Ruckeln aus, obwohl die
  // Messung in Ordnung ist.
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: ratio, duration: 120, useNativeDriver: false }).start();
  }, [ratio, width]);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.panel}>
        <Text style={styles.title}>{TITLES[progress.status]}</Text>
        <Text style={styles.hint}>{HINTS[progress.status]}</Text>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: accepted ? colors.primary : colors.warning,
                width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
        <Text style={styles.seconds}>
          {(progress.requiredMs / 1000).toFixed(0)} Sekunden ruhig halten – dann geht es los
        </Text>
      </View>
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
    backgroundColor: 'rgba(11,15,20,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(11,15,20,0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
  track: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 22,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
  },
  seconds: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
});
