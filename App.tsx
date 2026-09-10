import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Sora_400Regular, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/auth/AuthContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { installGlobalErrorHandler } from './src/diagnostics/globalErrorHandler';
import { colors } from './src/theme/colors';

// Vor allem anderen: Der Behandler muss stehen, bevor irgendein Modul etwas tun kann, das
// werfen könnte. Auf Modulebene und nicht in einem Effekt, denn ein Effekt läuft erst nach
// dem ersten Zeichnen - genau die Phase, in der die meisten Startfehler passieren.
installGlobalErrorHandler();

export default function App() {
  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  if (!fontsLoaded) {
    // Fonts load from bundled assets in well under a second; a plain spinner avoids
    // flashing system-font text for a frame before Sora is ready.
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/*
        Die Fehlergrenze liegt INNERHALB von SafeAreaProvider, aber AUSSERHALB von
        AuthProvider und Navigation: So ist sie selbst noch da, wenn die Anmeldung oder ein
        Bildschirm beim Zeichnen wirft - und sie kann ihre Meldung trotzdem in den sicheren
        Bereich setzen, statt unter die Statusleiste zu rutschen.
      */}
      <ErrorBoundary>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
