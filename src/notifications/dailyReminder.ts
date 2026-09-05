import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'daily-reminder';
const REMINDER_HOUR = 18;
const REMINDER_MINUTE = 0;
/** Stored in the notification's data payload so we can find "our" reminder among any others already scheduled, instead of guessing by identifier. */
const REMINDER_TAG = 'daily-training-reminder';

async function findScheduledReminder() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.find((n) => n.content.data?.tag === REMINDER_TAG) ?? null;
}

export async function isDailyReminderEnabled(): Promise<boolean> {
  return (await findScheduledReminder()) !== null;
}

/**
 * Requests notification permission and, once granted, schedules a repeating daily
 * local reminder (18:00, device-local time) to train. Returns false without scheduling
 * anything if permission was denied.
 */
export async function enableDailyReminder(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Trainings-Erinnerung',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  if (await findScheduledReminder()) return true; // already scheduled, don't stack duplicates

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Zeit für Liegestütze 💪',
      body: 'Schau vorbei und schließ dein Tagesziel im Liegestütz-Coach ab.',
      data: { tag: REMINDER_TAG },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  const existing = await findScheduledReminder();
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing.identifier);
  }
}
