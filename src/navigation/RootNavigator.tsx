import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WorkoutSession } from '../storage/workoutStorage';
import { HomeScreen } from '../screens/HomeScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { HistoryScreen } from '../screens/HistoryScreen';

// NOTE: `WorkoutScreen` (the MediaPipe pose-detection screen) is intentionally not
// wired in here yet. It imports `react-native-mediapipe`, which touches native camera
// modules at import time - that only exists once a custom dev client is built (EAS or
// a local Xcode/Android Studio build), and crashes immediately in plain Expo Go. Wiring
// it back in is a matter of restoring the "Workout" screen/route below once that build
// exists (see README.md).

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  // Not registered as a <Stack.Screen> below yet (see note above) - kept in the type
  // so WorkoutScreen.tsx keeps compiling and wiring it back in later is a one-line change.
  Workout: undefined;
  Summary: { session: WorkoutSession };
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
