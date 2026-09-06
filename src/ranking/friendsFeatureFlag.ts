import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ob der "Freunde"-Tab auf dem Rangliste-Screen angezeigt wird - ein einfacher,
 * jederzeit umschaltbarer Ein/Aus-Schalter (siehe LeaderboardScreen), da die
 * Freundesliste ein Feature ist, das sich manche Nutzer vielleicht gar nicht wünschen.
 * Standard: an - über den Schalter dauerhaft und ohne App-Update ausblendbar.
 */
const KEY = '@pushup/friendsFeatureEnabled';

export async function isFriendsFeatureEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? true : raw === 'true';
}

export async function setFriendsFeatureEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, String(enabled));
}
