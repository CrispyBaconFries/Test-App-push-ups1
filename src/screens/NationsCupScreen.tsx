import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useDuelIdentity } from '../ranking/useDuelIdentity';
import { COUNTRIES, countryLabel, flagEmoji, searchCountries, type Country } from '../nations/countries';
import {
  activeNationsEvent,
  computeStandings,
  formatDurationDe,
  formatEventRangeDe,
  mostRecentFinishedEventWindow,
  registrationOpensAtMs,
  type CountryStanding,
  type NationsEventResult,
} from '../nations/nationsEvent';
import { loadNationsChoice, saveNationsChoice } from '../nations/nationsChoiceStore';
import { joinEvent, loadOrFinalizeResult, loadParticipants, loadRecentResults } from '../nations/nationsStore';
import { colors } from '../theme/colors';
import { font, radius, space } from '../theme/layout';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'NationsCup'>;

/**
 * Wie oft die Restzeit neu berechnet wird. Eine Minute reicht: Angezeigt werden Tage,
 * Stunden und Minuten, und ein Sekundentakt würde nur Strom kosten.
 */
const CLOCK_REFRESH_MS = 60_000;

export function NationsCupScreen({ navigation }: Props) {
  const identity = useDuelIdentity();
  const me = identity.me;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // Läuft gerade ein Event, geht es um dieses - sonst schon um das nächste. Welche Phase
  // gilt, entscheidet `activeNationsEvent` (getestet, siehe nationsEvent.ts).
  const active = useMemo(() => activeNationsEvent(nowMs), [nowMs]);
  const activeWindow = active.window;
  /**
   * Als *Werte* in die Abhängigkeiten von `refresh`, nicht das Fenster-Objekt selbst:
   * `activeNationsEvent` liefert bei jedem Minutentakt ein neues Objekt mit gleichem
   * Inhalt. Mit dem Objekt in den Abhängigkeiten würde die Tabelle jede Minute neu
   * geladen, ohne dass sich etwas geändert hat.
   */
  const isRunning = active.phase === 'running';
  const canChoose = active.phase !== 'closed';

  const [chosenCountry, setChosenCountry] = useState<string | null>(null);
  const [myReps, setMyReps] = useState(0);
  const [standings, setStandings] = useState<CountryStanding[] | null>(null);
  const [pastResults, setPastResults] = useState<NationsEventResult[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  // Die lokal gespeicherte Wahl steht sofort und ohne Internet zur Verfügung; der
  // Firestore-Stand darf sie danach korrigieren (z. B. wenn auf einem zweiten Gerät
  // bereits ein anderes Land gewählt wurde).
  useEffect(() => {
    let cancelled = false;
    loadNationsChoice(activeWindow.id).then((choice) => {
      if (!cancelled && choice) setChosenCountry(choice.countryCode);
    });
    return () => {
      cancelled = true;
    };
  }, [activeWindow.id]);

  const refresh = useCallback(async () => {
    if (identity.status !== 'ready' || !me) return;
    setLoadFailed(false);
    try {
      const [participants, results] = await Promise.all([
        loadParticipants(activeWindow.id),
        loadRecentResults(),
      ]);
      let own = participants.find((participant) => participant.uid === me.uid) ?? null;

      // Wahl nachreichen: Wer sein Land gewählt hat, bevor das Ranking-System
      // eingerichtet war (oder ohne Internet), steht nur lokal. Sobald beides da ist,
      // wird der Eintrag hier nachgetragen - sonst zählten seine Liegestütze nie.
      if (!own) {
        const localChoice = await loadNationsChoice(activeWindow.id);
        if (localChoice) {
          const effective = await joinEvent({
            window: activeWindow,
            uid: me.uid,
            displayName: me.displayName,
            countryCode: localChoice.countryCode,
          });
          own = { uid: me.uid, countryCode: effective, reps: 0 };
          participants.push(own);
        }
      }

      if (own) {
        setChosenCountry(own.countryCode);
        setMyReps(own.reps);
        await saveNationsChoice({
          eventId: activeWindow.id,
          countryCode: own.countryCode,
          chosenAtIso: new Date().toISOString(),
        });
      }
      setStandings(computeStandings(participants));

      // Ist das zuletzt gelaufene Event vorbei und noch nicht ausgewertet, wird es hier
      // festgeschrieben - siehe `loadOrFinalizeResult`: Ohne Server macht das der erste
      // Client, der nach dem Ende hinschaut. Bewusst `Date.now()` und nicht der
      // Minutentakt-Zustand `nowMs`: Der wäre in dieser Funktion eine veraltete Kopie.
      const justFinished = mostRecentFinishedEventWindow(Date.now());
      const finalized = justFinished ? await loadOrFinalizeResult(justFinished, Date.now()).catch(() => null) : null;

      // Erst nach der Auswertung setzen, sonst fehlt das eben beendete Event in der Liste
      // und taucht erst beim nächsten Öffnen auf.
      setPastResults(
        finalized && !results.some((entry) => entry.eventId === finalized.eventId)
          ? [finalized, ...results]
          : results
      );
    } catch {
      setLoadFailed(true);
    }
  }, [identity.status, me, activeWindow.id, isRunning]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirmChoice = useCallback(
    (country: Country) => {
      Alert.alert(
        `Für ${country.name} antreten?`,
        'Diese Wahl lässt sich bis zum Ende des Events nicht mehr ändern. Alle deine ' +
          'Liegestütze in diesem Zeitraum zählen für dieses Land.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Endgültig wählen',
            style: 'destructive',
            onPress: async () => {
              setJoining(true);
              try {
                // Immer zuerst lokal festhalten. Das funktioniert ohne Internet, ohne
                // Anmeldung und ohne eingerichtetes Ranking-System - und ohne das könnte
                // sich niemand ein Land aussuchen, solange chris Firebase noch nicht
                // eingerichtet hat. Nachgetragen wird es in `refresh`, sobald es geht.
                await saveNationsChoice({
                  eventId: activeWindow.id,
                  countryCode: country.code,
                  chosenAtIso: new Date().toISOString(),
                });
                setChosenCountry(country.code);
                setPickerOpen(false);

                if (identity.status !== 'ready' || !me) {
                  Alert.alert(
                    'Land gespeichert',
                    `Du trittst für ${country.name} an. Sobald das Ranking-System eingerichtet und ` +
                      'du angemeldet bist, werden deine Liegestütze automatisch für dein Land gezählt.'
                  );
                  return;
                }

                const effective = await joinEvent({
                  window: activeWindow,
                  uid: me.uid,
                  displayName: me.displayName,
                  countryCode: country.code,
                });
                if (effective !== country.code) {
                  // Kann nur passieren, wenn auf einem anderen Gerät schon gewählt wurde.
                  await saveNationsChoice({
                    eventId: activeWindow.id,
                    countryCode: effective,
                    chosenAtIso: new Date().toISOString(),
                  });
                  setChosenCountry(effective);
                  Alert.alert(
                    'Bereits gewählt',
                    `Du bist für dieses Event schon für ${countryLabel(effective)} angemeldet.`
                  );
                }
                await refresh();
              } catch {
                // Die lokale Wahl steht bereits - es fehlt nur die Übertragung, und die
                // holt `refresh` beim nächsten Öffnen nach. Deshalb kein Fehler, sondern
                // ein Hinweis.
                Alert.alert(
                  'Noch nicht übertragen',
                  `Du trittst für ${country.name} an. Die Übertragung hat nicht geklappt und wird ` +
                    'automatisch nachgeholt, sobald du wieder online bist.'
                );
              } finally {
                setJoining(false);
              }
            },
          },
        ]
      );
    },
    [activeWindow, identity.status, me, refresh]
  );

  const registrationOpensAt = useMemo(() => registrationOpensAtMs(activeWindow), [activeWindow]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.title}>Länderspiel</Text>
          <Text style={styles.subtitle}>Trainiere für dein Land</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isRunning ? styles.statusDotLive : styles.statusDotIdle]} />
            <Text style={styles.statusText}>
              {isRunning ? 'Läuft gerade' : `Startet in ${formatDurationDe(activeWindow.startsAtMs - nowMs)}`}
            </Text>
          </View>
          <Text style={styles.eventRange}>{formatEventRangeDe(activeWindow)}</Text>
          {isRunning && (
            <Text style={styles.eventRemaining}>Noch {formatDurationDe(activeWindow.endsAtMs - nowMs)} Zeit</Text>
          )}
          {!isRunning && canChoose && (
            <Text style={styles.eventRemaining}>Anmeldung läuft - du kannst dein Land jetzt schon wählen</Text>
          )}
          {!canChoose && registrationOpensAt !== null && (
            <Text style={styles.eventRange}>
              Anmeldung öffnet in {formatDurationDe(registrationOpensAt - nowMs)}
            </Text>
          )}
        </View>

        {/* Die Länderwahl steht bewusst VOR und außerhalb der Ranking-Prüfung: Sie
            funktioniert lokal, ohne Anmeldung und ohne eingerichtetes Firebase. Sonst
            könnte niemand sein Land aussuchen, solange das Ranking-System fehlt. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dein Land</Text>
          {chosenCountry ? (
            <>
              <View style={styles.myCountryRow}>
                <Text style={styles.myCountryFlag}>{flagEmoji(chosenCountry)}</Text>
                <View style={styles.myCountryTextWrap}>
                  <Text style={styles.myCountryName}>{countryLabel(chosenCountry)}</Text>
                  <Text style={styles.myCountryReps}>
                    {myReps} {myReps === 1 ? 'Liegestütz' : 'Liegestütze'} beigetragen
                  </Text>
                </View>
                <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.lockedHint}>Deine Wahl steht bis zum Ende des Events fest.</Text>
            </>
          ) : canChoose ? (
            <>
              <Text style={styles.chooseHint}>
                Wähle ein Land. Alle deine Liegestütze im Eventzeitraum zählen dann für dieses Land.
              </Text>
              <View style={styles.warningRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.warningText}>Die Wahl ist bis zum Ende des Events nicht mehr änderbar.</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={() => setPickerOpen(true)}
              >
                <Ionicons name="flag-outline" size={18} color="#0B0F14" />
                <Text style={styles.primaryButtonText}>Land wählen</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.chooseHint}>
              Die Anmeldung für das nächste Länderspiel ist noch nicht offen.
            </Text>
          )}
        </View>

        {identity.status === 'loading' && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

        {(identity.status === 'notConfigured' || identity.status === 'needsReauth') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Wertung</Text>
            <Text style={styles.infoText}>
              {identity.status === 'notConfigured'
                ? 'Das Zusammenzählen über alle Spieler braucht das Ranking-System (siehe README „Ranking-System einrichten"). Deine Länderwahl ist trotzdem schon gespeichert und wird automatisch übernommen, sobald es eingerichtet ist.'
                : 'Melde dich auf dem Home-Screen mit Google an, damit deine Liegestütze für dein Land zählen. Deine Wahl bleibt gespeichert.'}
            </Text>
          </View>
        )}

        {identity.status === 'error' && (
          <Text style={styles.infoText}>Etwas ist schiefgelaufen. Bitte erneut versuchen.</Text>
        )}

        {identity.status === 'ready' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{isRunning ? 'Zwischenstand' : 'Angemeldet'}</Text>
              {loadFailed && <Text style={styles.infoText}>Tabelle konnte nicht geladen werden.</Text>}
              {!loadFailed && standings == null && <ActivityIndicator color={colors.primary} />}
              {!loadFailed && standings != null && standings.length === 0 && (
                <Text style={styles.infoText}>Noch kein Land dabei. Sei der Erste.</Text>
              )}
              {standings?.map((standing, index) => (
                <StandingRow
                  key={standing.countryCode}
                  rank={index + 1}
                  standing={standing}
                  isMine={standing.countryCode === chosenCountry}
                />
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vergangene Länderspiele</Text>
              {pastResults == null && !loadFailed && <ActivityIndicator color={colors.primary} />}
              {pastResults != null && pastResults.length === 0 && (
                <Text style={styles.infoText}>Noch kein Länderspiel abgeschlossen.</Text>
              )}
              {pastResults?.map((result) => <ResultCard key={result.eventId} result={result} />)}
            </View>
          </>
        )}
      </ScrollView>

      <CountryPickerModal
        visible={pickerOpen}
        busy={joining}
        onClose={() => setPickerOpen(false)}
        onSelect={confirmChoice}
      />
    </View>
  );
}

function StandingRow({
  rank,
  standing,
  isMine,
}: {
  rank: number;
  standing: CountryStanding;
  isMine: boolean;
}) {
  return (
    <View style={[styles.standingRow, isMine && styles.standingRowMine]}>
      <Text style={styles.standingRank}>{rank}</Text>
      <Text style={styles.standingFlag}>{flagEmoji(standing.countryCode)}</Text>
      <View style={styles.standingTextWrap}>
        <Text style={styles.standingName} numberOfLines={1}>
          {countryLabel(standing.countryCode)}
        </Text>
        {/* Wer sich angemeldet, aber noch nichts gemacht hat, zählt nicht als Spieler und
            geht nicht in den Schnitt ein - "0 Spieler · ⌀ 0" wäre dafür eine irreführende
            Anzeige. Solange niemand aus dem Land etwas beigetragen hat, steht hier
            stattdessen die Zahl der Anmeldungen. */}
        <Text style={styles.standingMeta}>
          {standing.players === 0
            ? `${standing.registeredPlayers} angemeldet, noch nichts beigetragen`
            : `${standing.players} ${standing.players === 1 ? 'Spieler' : 'Spieler'} · ⌀ ${standing.averageReps}`}
        </Text>
      </View>
      <Text style={styles.standingReps}>{standing.reps}</Text>
    </View>
  );
}

function ResultCard({ result }: { result: NationsEventResult }) {
  const date = new Date(result.startsAtMs).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  // Nur Länder zählen, aus denen wirklich jemand etwas beigetragen hat. Ein Land, in dem
  // sich nur jemand angemeldet und dann nichts gemacht hat, hat nicht "teilgenommen".
  const countriesWithReps = result.standings.filter((standing) => standing.reps > 0).length;
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultDate}>{date}</Text>
      {result.winnerCountryCode ? (
        <>
          <View style={styles.resultWinnerRow}>
            <Text style={styles.resultTrophy}>🏆</Text>
            <Text style={styles.resultFlag}>{flagEmoji(result.winnerCountryCode)}</Text>
            <Text style={styles.resultWinnerName} numberOfLines={1}>
              {countryLabel(result.winnerCountryCode)}
            </Text>
          </View>
          <Text style={styles.resultMeta}>
            {result.winnerReps} Liegestütze · {result.winnerPlayers}{' '}
            {result.winnerPlayers === 1 ? 'Spieler' : 'Spieler'} · ⌀ {result.winnerAverageReps} je Spieler
          </Text>
          <Text style={styles.resultTotals}>
            Insgesamt {result.totalReps} Liegestütze von {result.totalPlayers}{' '}
            {result.totalPlayers === 1 ? 'Spieler' : 'Spielern'} aus {countriesWithReps}{' '}
            {countriesWithReps === 1 ? 'Land' : 'Ländern'}
          </Text>
        </>
      ) : (
        <Text style={styles.resultMeta}>Kein Sieger - in diesem Zeitraum wurde nichts eingetragen.</Text>
      )}
    </View>
  );
}

/**
 * Vollbild-Auswahl mit Suchfeld. Bewusst ein `Modal` und kein eigener Navigations-
 * Eintrag: Die Auswahl ist ein Zwischenschritt innerhalb dieses Bildschirms, und der
 * Warnhinweis zur Unumkehrbarkeit gehört direkt daneben.
 */
function CountryPickerModal({
  visible,
  busy,
  onClose,
  onSelect,
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
}) {
  const [term, setTerm] = useState('');
  const results = useMemo(() => searchCountries(term), [term]);

  // Beim erneuten Öffnen soll wieder die volle Liste stehen, nicht die alte Suche.
  useEffect(() => {
    if (visible) setTerm('');
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.modalContainer}>
        <View style={styles.headerRow}>
          <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          <View>
            <Text style={styles.title}>Land wählen</Text>
            <Text style={styles.subtitle}>{COUNTRIES.length} Länder</Text>
          </View>
        </View>

        <View style={styles.warningRow}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
          <Text style={styles.warningText}>
            Nicht änderbar bis zum Ende des Events.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={term}
            onChangeText={setTerm}
            placeholder="Land suchen"
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {term.length > 0 && (
            <Pressable onPress={() => setTerm('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {busy && <ActivityIndicator color={colors.primary} style={styles.spacingTop} />}

        <FlatList
          data={results}
          keyExtractor={(country) => country.code}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.infoText}>Kein Land gefunden.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.countryRow, pressed && styles.pressed]}
              onPress={() => onSelect(item)}
              disabled={busy}
            >
              <Text style={styles.countryFlag}>{flagEmoji(item.code)}</Text>
              <Text style={styles.countryName}>{item.name}</Text>
              <Text style={styles.countryCode}>{item.code}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: space(56), paddingHorizontal: space(24) },
  modalContainer: { flex: 1, backgroundColor: colors.background, paddingTop: space(56), paddingHorizontal: space(24) },
  scrollContent: { paddingBottom: space(40), gap: space(16) },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space(16), gap: space(12) },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius(12),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  title: { fontFamily: fonts.bold, fontSize: font(22), color: colors.textPrimary },
  subtitle: { fontSize: font(13), color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius(18),
    padding: space(16),
    borderWidth: 1,
    borderColor: colors.border,
    gap: space(10),
  },
  cardTitle: { fontFamily: fonts.semiBold, fontSize: font(15), color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space(8) },
  statusDot: { width: 10, height: 10, borderRadius: radius(5) },
  statusDotLive: { backgroundColor: colors.primary },
  statusDotIdle: { backgroundColor: colors.textSecondary },
  statusText: { fontFamily: fonts.semiBold, fontSize: font(15), color: colors.textPrimary },
  eventRange: { fontSize: font(13), color: colors.textSecondary },
  eventRemaining: { fontSize: font(13), color: colors.primary, fontFamily: fonts.semiBold },
  infoText: { fontSize: font(13), color: colors.textSecondary, lineHeight: font(19) },
  spacingTop: { marginTop: space(16) },
  chooseHint: { fontSize: font(13), color: colors.textSecondary, lineHeight: font(19) },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(8),
    backgroundColor: 'rgba(255,194,75,0.12)',
    borderRadius: radius(12),
    paddingHorizontal: space(12),
    paddingVertical: space(10),
    marginBottom: space(12),
  },
  warningText: { flex: 1, fontSize: font(12), color: colors.warning, lineHeight: font(17) },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(8),
    backgroundColor: colors.primary,
    borderRadius: radius(14),
    paddingVertical: space(13),
  },
  primaryButtonText: { fontFamily: fonts.bold, fontSize: font(15), color: '#0B0F14' },
  myCountryRow: { flexDirection: 'row', alignItems: 'center', gap: space(12) },
  myCountryFlag: { fontSize: font(32) },
  myCountryTextWrap: { flex: 1 },
  myCountryName: { fontFamily: fonts.bold, fontSize: font(17), color: colors.textPrimary },
  myCountryReps: { fontSize: font(13), color: colors.textSecondary },
  lockedHint: { fontSize: font(12), color: colors.textSecondary },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(10),
    paddingVertical: space(8),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  standingRowMine: { backgroundColor: colors.primaryMuted, borderRadius: radius(10), paddingHorizontal: space(8) },
  standingRank: { width: 22, fontFamily: fonts.bold, fontSize: font(14), color: colors.textSecondary },
  standingFlag: { fontSize: font(22) },
  standingTextWrap: { flex: 1 },
  standingName: { fontFamily: fonts.semiBold, fontSize: font(14), color: colors.textPrimary },
  standingMeta: { fontSize: font(11), color: colors.textSecondary },
  standingReps: { fontFamily: fonts.bold, fontSize: font(16), color: colors.primary },
  resultCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space(12),
    gap: space(4),
  },
  resultDate: { fontSize: font(12), color: colors.textSecondary },
  resultWinnerRow: { flexDirection: 'row', alignItems: 'center', gap: space(8) },
  resultTrophy: { fontSize: font(18) },
  resultFlag: { fontSize: font(22) },
  resultWinnerName: { flex: 1, fontFamily: fonts.bold, fontSize: font(16), color: colors.textPrimary },
  resultMeta: { fontSize: font(12), color: colors.textSecondary },
  resultTotals: { fontSize: font(12), color: colors.textSecondary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(8),
    backgroundColor: colors.surface,
    borderRadius: radius(14),
    paddingHorizontal: space(12),
    paddingVertical: space(10),
    marginBottom: space(12),
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: font(15), padding: 0 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(12),
    paddingVertical: space(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryFlag: { fontSize: font(26) },
  countryName: { flex: 1, fontSize: font(15), color: colors.textPrimary },
  countryCode: { fontSize: font(12), color: colors.textSecondary, fontFamily: fonts.semiBold },
});
