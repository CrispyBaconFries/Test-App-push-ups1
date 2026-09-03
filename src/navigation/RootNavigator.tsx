import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WorkoutSession } from '../storage/workoutStorage';
import { HomeScreen } from '../screens/HomeScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { HistoryScreen } from '../screens/HistoryScreen';

export type RootStackParamList = {
  Home: undefined;
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
        <Stack.Screen name="Workout" component={WorkoutScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
