import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

export function CameraScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');

  if (!permission) {
    return <View style={styles.centered} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Diese App benötigt Zugriff auf die Kamera.</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={requestPermission}
        >
          <Text style={styles.primaryButtonText}>Kamerazugriff erlauben</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing={facing} />

      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textPrimary} />
          <Text style={styles.iconButtonText}>Zurück</Text>
        </Pressable>
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          onPress={() => setFacing((current) => (current === 'front' ? 'back' : 'front'))}
        >
          <Ionicons name="camera-reverse-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.iconButtonText}>{facing === 'front' ? 'Zur Rückkamera' : 'Zur Frontkamera'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    color: '#0B0F14',
    fontSize: 16,
  },
  linkButton: {
    marginTop: 16,
    padding: 8,
  },
  linkButtonText: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 14,
  },
  topBar: {
    position: 'absolute',
    top: 56,
    left: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 44,
    alignSelf: 'center',
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  iconButtonText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
