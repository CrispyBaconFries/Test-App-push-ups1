import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/AuthContext';
import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import { ensureFirebaseBridged } from '../firebase/firebaseAuthBridge';
import { loadOrCreatePlayerProfile } from '../ranking/playerProfileStore';
import { tierForLp } from '../ranking/ranks';
import { generateDuelCode, isValidDuelCodeFormat, normalizeDuelCode } from '../duel/duelCode';
import { createDuel, joinDuel, leaveDuel, listenToDuel, type DuelPlayerInfo } from '../duel/duelSession';
import { RankFrame } from '../components/RankFrame';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'DuelLobby'>;

type Mode = 'loading' | 'notConfigured' | 'needsReauth' | 'menu' | 'creating' | 'waiting' | 'joiningForm' | 'joining' | 'error';

export function DuelLobbyScreen({ navigation }: Props) {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('loading');
  const [me, setMe] = useState<DuelPlayerInfo | null>(null);
  const [code, setCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const createdCodeRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!isFirebaseConfigured()) {
        setMode('notConfigured');
        return;
      }
      if (auth.status !== 'signedIn' || !auth.profile) {
        setMode('needsReauth');
        return;
      }
      const uid = await ensureFirebaseBridged();
      if (!uid) {
        setMode('needsReauth');
        return;
      }
      const profile = await loadOrCreatePlayerProfile(uid, auth.profile.name ?? auth.profile.email, auth.profile.photoUrl);
      if (cancelled) return;
      setMe({
        uid,
        displayName: profile.displayName,
        avatar: profile.avatar,
        tier: tierForLp(profile.lp).tier,
        lp: profile.lp,
      });
      setMode('menu');
    }

    setup().catch(() => {
      if (!cancelled) setMode('error');
    });

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      // Best-effort Aufräumen: wenn man ein Duell erstellt und noch niemand
      // beigetreten ist, den eigenen Eintrag wieder entfernen, statt eine leere
      // Warteschlangen-Leiche in der Datenbank zu hinterlassen.
      if (createdCodeRef.current && me) {
        leaveDuel(createdCodeRef.current, me.uid).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = useCallback(async () => {
    if (!me) return;
    setMode('creating');
    setErrorText(null);
    const newCode = generateDuelCode();
    try {
      await createDuel(newCode, me);
      createdCodeRef.current = newCode;
      setCode(newCode);
      setMode('waiting');
      unsubscribeRef.current = listenToDuel(newCode, (state) => {
        if (state && Object.keys(state.players).length === 2) {
          unsubscribeRef.current?.();
          createdCodeRef.current = null; // erfolgreich gestartet - nicht mehr aufräumen
          navigation.replace('Duel', { duelCode: newCode, me, isRanked: false });
        }
      });
    } catch {
      setMode('error');
    }
  }, [me, navigation]);

  const submitJoin = useCallback(async () => {
    if (!me) return;
    const normalized = normalizeDuelCode(joinCodeInput);
    if (!isValidDuelCodeFormat(normalized)) {
      setErrorText('Bitte den 6-stelligen Code prüfen.');
      return;
    }
    setMode('joining');
    setErrorText(null);
    try {
      const result = await joinDuel(normalized, me);
      if (result === 'joined') {
        navigation.replace('Duel', { duelCode: normalized, me, isRanked: false });
        return;
      }
      setErrorText(result === 'full' ? 'Dieses Duell ist bereits voll.' : 'Kein Duell mit diesem Code gefunden.');
      setMode('joiningForm');
    } catch {
      setErrorText('Beitritt fehlgeschlagen. Bitte erneut versuchen.');
      setMode('joiningForm');
    }
  }, [me, joinCodeInput, navigation]);

  return (
    <View style={styles.container}>
      <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </Pressable>

      <Text style={styles.title}>Freundschaftsspiel</Text>
      <Text style={styles.subtitle}>60 Sekunden Liegestütze - wer schafft mehr?</Text>

      {mode === 'loading' && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

      {mode === 'notConfigured' && (
        <Text style={styles.infoText}>
          Das Ranking-System ist noch nicht eingerichtet (siehe README „Ranking-System einrichten").
        </Text>
      )}

      {mode === 'needsReauth' && (
        <Text style={styles.infoText}>Bitte melde dich auf dem Home-Screen zuerst mit Google an.</Text>
      )}

      {mode === 'error' && <Text style={styles.infoText}>Etwas ist schiefgelaufen. Bitte erneut versuchen.</Text>}

      {me && (mode === 'menu' || mode === 'creating' || mode === 'joiningForm' || mode === 'joining') && (
        <View style={styles.avatarPreview}>
          <RankFrame avatar={me.avatar} tier={me.tier} lp={me.lp} size={64} />
          <Text style={styles.avatarName}>{me.displayName}</Text>
        </View>
      )}

      {mode === 'menu' && (
        <View style={styles.menu}>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={startCreate}>
            <Ionicons name="add-circle-outline" size={20} color="#0B0F14" />
            <Text style={styles.primaryButtonText}>Duell erstellen</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => setMode('joiningForm')}
          >
            <Ionicons name="enter-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.secondaryButtonText}>Mit Code beitreten</Text>
          </Pressable>
        </View>
      )}

      {mode === 'creating' && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

      {mode === 'waiting' && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingLabel}>Dein Code - teile ihn mit deinem Gegner</Text>
          <Text style={styles.code}>{code}</Text>
          <ActivityIndicator color={colors.primary} style={styles.spacingTop} />
          <Text style={styles.waitingHint}>Warte auf den zweiten Spieler…</Text>
        </View>
      )}

      {(mode === 'joiningForm' || mode === 'joining') && (
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
            editable={mode === 'joiningForm'}
          />
          {errorText && <Text style={styles.errorText}>{errorText}</Text>}
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, mode === 'joining' && styles.disabled]}
            onPress={submitJoin}
            disabled={mode === 'joining'}
          >
            {mode === 'joining' ? (
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
