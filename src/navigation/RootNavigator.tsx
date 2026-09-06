import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WorkoutSession } from '../storage/workoutStorage';
import type { BadgeDefinition } from '../gamification/badges';
import type { MissionDefinition } from '../gamification/missions';
import type { DuelPlayerInfo } from '../duel/duelSession';
import { HomeScreen } from '../screens/HomeScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { DuelLobbyScreen } from '../screens/DuelLobbyScreen';
import { RankedMatchmakingScreen } from '../screens/RankedMatchmakingScreen';
import { DuelScreen } from '../screens/DuelScreen';
import { DuelResultScreen } from '../screens/DuelResultScreen';
import { BossFightScreen } from '../screens/BossFightScreen';

// `WorkoutScreen` (MediaPipe pose detection) needs native modules that only exist in a
// custom-built app (a local Android Studio / Xcode build, or an EAS dev client) - it
// crashes immediately in plain Expo Go. Since this build is meant to be compiled
// locally with Android Studio (see README.md "Auf dem Handy installieren"), it's wired
// in here as usual. If you ever go back to testing via plain Expo Go, unregister the
// "Workout" screen below again (react-native-mediapipe touches native APIs at import
// time), and point HomeScreen's "Training starten" entry at "Camera" instead.

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Workout: undefined;
  Summary: {
    session: WorkoutSession;
    newBadges: BadgeDefinition[];
    newBestReps: boolean;
    newBestFormScore: boolean;
    coinsEarned: number;
    newlyCompletedMissions: MissionDefinition[];
  };
  History: undefined;
  Achievements: undefined;
  DuelLobby: undefined;
  RankedMatchmaking: undefined;
  Duel: { duelCode: string; me: DuelPlayerInfo; isRanked: boolean };
  DuelResult: { duelCode: string; me: DuelPlayerInfo; isRanked: boolean };
  BossFight: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Workout" component={WorkoutScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} />
        <Stack.Screen name="DuelLobby" component={DuelLobbyScreen} />
        <Stack.Screen name="RankedMatchmaking" component={RankedMatchmakingScreen} />
        <Stack.Screen name="Duel" component={DuelScreen} />
        <Stack.Screen name="DuelResult" component={DuelResultScreen} />
        <Stack.Screen name="BossFight" component={BossFightScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
