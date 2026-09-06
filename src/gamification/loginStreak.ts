import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from '../storage/workoutStorage';

/**
 * Eigener Login-Streak, getrennt von der Trainings-Streak (`computeStats().
 * currentStreakDays`, die einen echten Satz Liegestütze braucht) - hier zählt allein,
 * dass die App an aufeinanderfolgenden Kalendertagen geöffnet wurde. Treibt die
 * dynamische Belohnung der "Täglich dabei"-Mission (siehe `coinsForLoginStreak` unten)
 * und kann später auch für die Streak-Rettung im Shop wiederverwendet werden.
 */
const STREAK_KEY = '@pushup/loginStreak';

interface LoginStreakState {
  streakDays: number;
  lastLoginDayKey: string;
}

async function loadState(): Promise<LoginStreakState | null> {
  const raw = await AsyncStorage.getItem(STREAK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginStreakState;
  } catch {
    return null;
  }
}

/**
 * Am besten einmal pro App-Start/Fokussieren des Home-Screens aufgerufen. Ein zweiter
 * Aufruf am selben Kalendertag ändert nichts (gibt einfach denselben Streak-Wert
 * zurück) - so kann man das gefahrlos bei jedem Fokussieren aufrufen, ohne den Streak
 * künstlich hochzuzählen.
 */
export async function recordAppOpenAndGetStreak(now: Date = new Date()): Promise<number> {
  const todayKey = localDayKey(now);
  const state = await loadState();
  if (state?.lastLoginDayKey === todayKey) return state.streakDays;

  let streakDays = 1;
  if (state) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (state.lastLoginDayKey === localDayKey(yesterday)) {
      streakDays = state.streakDays + 1;
    }
  }
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ streakDays, lastLoginDayKey: todayKey }));
  return streakDays;
}

/** Reiner Lesezugriff, ohne den heutigen Login zu vermerken - z. B. für eine Anzeige, bevor `recordAppOpenAndGetStreak` gelaufen ist. */
export async function currentLoginStreak(): Promise<number> {
  return (await loadState())?.streakDays ?? 0;
}

/**
 * Steigt an den ersten 5 Tagen um 5 Münzen je Tag (10/15/20/25/30), danach gedeckelt bei
 * 30 - schnell spürbare Belohnung fürs Dranbleiben, ohne dass ein sehr langer Streak
 * einzelne Tage absurd wertvoll macht. Der Deckel bei 30 ist auch die Grundlage für die
 * Preis-Kalkulation der Streak-Rettung im Münz-Shop (siehe shop.ts).
 */
const LOGIN_BONUS_BASE = 10;
const LOGIN_BONUS_STEP = 5;
const LOGIN_BONUS_RAMP_DAYS = 5;

export function coinsForLoginStreak(streakDays: number): number {
  const cappedDays = Math.min(Math.max(streakDays, 1), LOGIN_BONUS_RAMP_DAYS);
  return LOGIN_BONUS_BASE + (cappedDays - 1) * LOGIN_BONUS_STEP;
}
