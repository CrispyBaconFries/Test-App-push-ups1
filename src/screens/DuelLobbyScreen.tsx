import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useDuelIdentity } from '../ranking/useDuelIdentity';
import { generateDuelCode, isValidDuelCodeFormat, normalizeDuelCode } from '../duel/duelCode';
import { createDuel, joinDuel, leaveDuel, listenToDuel } from '../duel/duelSession';
import { RankFrame } from '../components/RankFrame';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'DuelLobby'>;

type FlowMode = 'menu' | 'creating' | 'waiting' | 'joiningForm' | 'joining' | 'error';

export function DuelLobbyScreen({ navigation }: Props) {
  const identity = useDuelIdentity();
  const me = identity.me;
  const [flow, setFlow] = useState<FlowMode>('menu');
  const [code, setCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const createdCodeRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const startCreate = useCallback(async () => {
    if (!me) return;
    setFlow('creating');
    setErrorText(null);
    const newCode = generateDuelCode();
    try {
      await createDuel(newCode, me);
      createdCodeRef.current = newCode;
      setCode(newCode);
      setFlow('waiting');
      unsubscribeRef.current = listenToDuel(newCode, (state) => {
        if (state && Object.keys(state.players).length === 2) {
          unsubscribeRef.current?.();
          createdCodeRef.current = null; // erfolgreich gestartet - nicht mehr aufräumen
          navigation.replace('Duel', { duelCode: newCode, me, isRanked: false });
        }
      });
    } catch {
      setFlow('error');
    }
  }, [me, navigation]);

  const submitJoin = useCallback(async () => {
    if (!me) return;
    const normalized = normalizeDuelCode(joinCodeInput);
    if (!isValidDuelCodeFormat(normalized)) {
      setErrorText('Bitte den 6-stelligen Code prüfen.');
      return;
    }
    setFlow('joining');
    setErrorText(null);
    try {
      const result = await joinDuel(normalized, me);
      if (result === 'joined') {
        navigation.replace('Duel', { duelCode: normalized, me, isRanked: false });
        return;
      }
      setErrorText(result === 'full' ? 'Dieses Duell ist bereits voll.' : 'Kein Duell mit diesem Code gefunden.');
      setFlow('joiningForm');
    } catch {
      setErrorText('Beitritt fehlgeschlagen. Bitte erneut versuchen.');
      setFlow('joiningForm');
    }
  }, [me, joinCodeInput, navigation]);

  const goBack = useCallback(() => {
    unsubscribeRef.current?.();
    if (createdCodeRef.current && me) {
      leaveDuel(createdCodeRef.current, me.uid).catch(() => {});
    }
    navigation.goBack();
  }, [me, navigation]);

  return (
    <View style={styles.container}>
      <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={goBack}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </Pressable>

      <Text style={styles.title}>Freundschaftsspiel</Text>
      <Text style={styles.subtitle}>60 Sekunden Liegestütze - wer schafft mehr?</Text>

      {identity.status === 'loading' && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

      {identity.status === 'notConfigured' && (
        <Text style={styles.infoText}>
          Das Ranking-System ist noch nicht eingerichtet (siehe README „Ranking-System einrichten").
        </Text>
      )}

      {identity.status === 'needsReauth' && (
        <Text style={styles.infoText}>Bitte melde dich auf dem Home-Screen zuerst mit Google an.</Text>
      )}

      {identity.status === 'error' && <Text style={styles.infoText}>Etwas ist schiefgelaufen. Bitte erneut versuchen.</Text>}

      {me && (
        <View style={styles.avatarPreview}>
          <RankFrame avatar={me.avatar} tier={me.tier} lp={me.lp} size={64} />
          <Text style={styles.avatarName}>{me.displayName}</Text>
        </View>
      )}

      {me && flow === 'menu' && (
        <View style={styles.menu}>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={startCreate}>
            <Ionicons name="add-circle-outline" size={20} color="#0B0F14" />
            <Text style={styles.primaryButtonText}>Duell erstellen</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => setFlow('joiningForm')}
          >
            <Ionicons name="enter-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.secondaryButtonText}>Mit Code beitreten</Text>
          </Pressable>
        </View>
      )}

      {flow === 'error' && <Text style={styles.infoText}>Etwas ist schiefgelaufen. Bitte erneut versuchen.</Text>}

      {flow === 'creating' && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

      {flow === 'waiting' && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingLabel}>Dein Code - teile ihn mit deinem Gegner</Text>
          <Text style={styles.code}>{code}</Text>
          <ActivityIndicator color={colors.primary} style={styles.spacingTop} />
          <Text style={styles.waitingHint}>Warte auf den zweiten Spieler…</Text>
        </View>
      )}

      {(flow === 'joiningForm' || flow === 'joining') && (
        <View style={styles.joinCard}>
          <Ionicons name="key-outline" size={22} color={colors.textSecondary} />
          <TextInput
            style={styles.codeInput}
            value={joinCodeInput}
            onChangeText={setJoinCodeInput}
            placeholder="CODE"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            editable={flow === 'joiningForm'}
          />
          {errorText && <Text style={styles.errorText}>{errorText}</Text>}
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, flow === 'joining' && styles.disabled]}
            onPress={submitJoin}
            disabled={flow === 'joining'}
          >
            {flow === 'joining' ? (
              <ActivityIndicator color="#0B0F14" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={20} color="#0B0F14" />
                <Text style={styles.primaryButtonText}>Beitreten</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 24,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  spacingTop: {
    marginTop: 24,
  },
  avatarPreview: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  avatarName: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  menu: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    color: '#0B0F14',
    fontSize: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  waitingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waitingLabel: {
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  code: {
    fontFamily: fonts.extraBold,
    color: colors.primary,
    fontSize: 40,
    letterSpacing: 8,
    marginTop: 12,
  },
  waitingHint: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  joinCard: {
    alignItems: 'center',
    gap: 14,
  },
  codeInput: {
    fontFamily: fonts.extraBold,
    fontSize: 32,
    letterSpacing: 8,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    width: '100%',
  },
  errorText: {
    fontFamily: fonts.regular,
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
