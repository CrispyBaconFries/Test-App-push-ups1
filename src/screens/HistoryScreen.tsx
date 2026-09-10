import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { loadSessions, type WorkoutSession } from '../storage/workoutStorage';
import { colors } from '../theme/colors';
import { font, radius, space } from '../theme/layout';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Trainingsverlauf</Text>
      </View>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Noch keine Workouts aufgezeichnet.</Text>
          </View>
        }
        renderItem={({ item }) => <SessionRow session={item} />}
      />
    </View>
  );
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const date = new Date(session.finishedAtIso);
  const dateLabel = date.toLocaleDateString('de-DE');
  const timeLabel = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.row}>
      <View style={styles.rowIconBadge}>
        <Ionicons name="barbell" size={18} color={colors.primary} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowDate}>
          {dateLabel} · {timeLabel} Uhr
        </Text>
        <Text style={styles.rowSub}>
          {session.totalReps} Liegestütze · Ø {session.averageFormScore} Punkte Form
        </Text>
      </View>
      <Text style={styles.rowPoints}>+{session.points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: space(56),
    paddingHorizontal: space(24),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space(20),
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: space(12),
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: font(24),
    color: colors.textPrimary,
  },
  listContent: {
    paddingBottom: space(40),
  },
  emptyState: {
    alignItems: 'center',
    marginTop: space(60),
    gap: space(12),
  },
  emptyText: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: font(14),
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius(16),
    padding: space(14),
    marginBottom: space(12),
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius(12),
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(12),
  },
  rowTextWrap: {
    flex: 1,
  },
  rowDate: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: font(15),
  },
  rowSub: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: font(13),
    marginTop: space(2),
  },
  rowPoints: {
    fontFamily: fonts.extraBold,
    color: colors.primary,
    fontSize: font(18),
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
