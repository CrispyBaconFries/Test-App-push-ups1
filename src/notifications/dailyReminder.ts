import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'daily-reminder';
const REMINDER_HOUR = 18;
const REMINDER_MINUTE = 0;
/** Stored in the notification's data payload so we can find "our" reminder among any others already scheduled, instead of guessing by identifier. */
const REMINDER_TAG = 'daily-training-reminder';

const DEFAULT_BODY = 'Schau vorbei und schließ deine täglichen Missionen im Liegestütz-Coach ab.';

async function findScheduledReminder() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.find((n) => n.content.data?.tag === REMINDER_TAG) ?? null;
}

export async function isDailyReminderEnabled(): Promise<boolean> {
  return (await findScheduledReminder()) !== null;
}

async function scheduleReminder(body: string): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Trainings-Erinnerung',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Zeit für Liegestütze 💪',
      body,
      data: { tag: REMINDER_TAG },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: CHANNEL_ID,
    },
  });
}

/**
 * Requests notification permission and, once granted, schedules a repeating daily
 * local reminder (18:00, device-local time) to train. `body` lets the caller mention
 * today's still-open missions (see HomeScreen, which builds this from
 * `src/gamification/missions.ts`); falls back to a generic text if omitted. Returns
 * false without scheduling anything if permission was denied.
 */
export async function enableDailyReminder(body: string = DEFAULT_BODY): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;

  if (await findScheduledReminder()) return true; // already scheduled, don't stack duplicates
  await scheduleReminder(body);
  return true;
}

/**
 * Re-schedules the reminder with fresh `body` text, keeping the same daily time - a
 * no-op if the reminder isn't currently enabled. Local notifications can't compute their
 * own content at delivery time, so this is called opportunistically (see HomeScreen,
 * on every focus) to keep tonight's reminder text reasonably close to today's actual
 * mission progress, without needing a background task. See README "Missionen & Münzen"
 * for the honest limitation this implies (the text reflects progress as of the last time
 * the app was opened, not the exact moment the notification fires).
 */
export async function refreshDailyReminderContent(body: string): Promise<void> {
  const existing = await findScheduledReminder();
  if (!existing) return;
  await Notifications.cancelScheduledNotificationAsync(existing.identifier);
  await scheduleReminder(body);
}

export async function disableDailyReminder(): Promise<void> {
  const existing = await findScheduledReminder();
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing.identifier);
  }
}
