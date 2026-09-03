import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { loadSessions, type WorkoutSession } from '../storage/workoutStorage';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen(_props: Props) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verlauf</Text>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Noch keine Workouts aufgezeichnet.</Text>}
        renderItem={({ item }) => <SessionRow session={item} />}
      />
    </View>
  );
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const date = new Date(session.finishedAtIso);
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.rowDate}>{date.toLocaleDateString('de-DE')}</Text>
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
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowDate: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  rowSub: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  rowPoints: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
});
