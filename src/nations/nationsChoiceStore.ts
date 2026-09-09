import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Merkt sich lokal, welches Land der Nutzer für welches Event gewählt hat.
 *
 * Zwei Gründe, das zusätzlich zum Firestore-Dokument zu speichern:
 *
 * 1. **Offline.** Die App ist ausdrücklich ohne Internet nutzbar. Wer am Samstag ohne
 *    Netz trainiert, muss trotzdem sehen, für welches Land er antritt - und die
 *    Wiederholungen müssen beim Nachtragen dem richtigen Land gutgeschrieben werden.
 * 2. **Unumkehrbarkeit.** Die Wahl gilt bis zum Ende des Events. Der lokale Eintrag ist
 *    die schnelle Prüfung dafür; die verbindliche Prüfung passiert beim Schreiben nach
 *    Firestore (siehe `joinEvent` in nationsStore.ts), damit ein zweites Gerät desselben
 *    Nutzers die Wahl nicht überschreiben kann.
 *
 * Der Schlüssel enthält die Event-ID: Ein neues Event bedeutet eine neue, wieder freie
 * Wahl - genau das ist gewollt.
 */
export interface NationsChoice {
  eventId: string;
  countryCode: string;
  chosenAtIso: string;
}

const KEY_PREFIX = '@pushup/nationsChoice/';

export async function loadNationsChoice(eventId: string): Promise<NationsChoice | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + eventId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NationsChoice;
    return parsed.countryCode ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveNationsChoice(choice: NationsChoice): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + choice.eventId, JSON.stringify(choice));
}
