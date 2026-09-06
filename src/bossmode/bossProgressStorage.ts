import AsyncStorage from '@react-native-async-storage/async-storage';
import { bossMaxHp } from './bossDefinitions';

export interface BossProgress {
  bossNumber: number;
  /** Verbleibende Lebenspunkte des aktuellen Bosses - überlebt App-Neustarts, damit ein
   * nicht besiegter Boss beim nächsten Mal genau dort weitergeht, wo man aufgehört hat. */
  currentHp: number;
}

const PROGRESS_KEY = '@pushup/bossProgress';

const FIRST_BOSS_PROGRESS: BossProgress = { bossNumber: 1, currentHp: bossMaxHp(1) };

export async function loadBossProgress(): Promise<BossProgress> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  if (!raw) return FIRST_BOSS_PROGRESS;
  try {
    const parsed = JSON.parse(raw) as BossProgress;
    if (typeof parsed.bossNumber !== 'number' || typeof parsed.currentHp !== 'number') {
      return FIRST_BOSS_PROGRESS;
    }
    return parsed;
  } catch {
    return FIRST_BOSS_PROGRESS;
  }
}

export async function saveBossProgress(progress: BossProgress): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export async function resetBossProgress(): Promise<void> {
  await AsyncStorage.removeItem(PROGRESS_KEY);
}
