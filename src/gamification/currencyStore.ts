import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MissionDefinition, MissionsSnapshot } from './missions';

const BALANCE_KEY = '@pushup/coinBalance';
const CLAIMED_KEY = '@pushup/claimedMissionRewards';
/** Claimed-reward keys older than this are never checked again anyway (their day/week has long passed) - bounding the list keeps storage from growing forever. */
const MAX_CLAIMED_KEYS = 500;

export async function getCoinBalance(): Promise<number> {
  const raw = await AsyncStorage.getItem(BALANCE_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

async function loadClaimedKeys(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CLAIMED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Credits `amount` coins for `claimKey` and remembers it as claimed - calling this again
 * with the same key (e.g. the same mission, same day/week) is a no-op, so callers don't
 * need their own "already rewarded" bookkeeping and can call this as often as they like
 * (every time a screen recomputes mission progress, say) without double-paying out.
 */
export async function claimReward(claimKey: string, amount: number): Promise<{ balance: number; alreadyClaimed: boolean }> {
  const claimed = await loadClaimedKeys();
  if (claimed.includes(claimKey)) {
    return { balance: await getCoinBalance(), alreadyClaimed: true };
  }
  const balance = (await getCoinBalance()) + amount;
  await AsyncStorage.setItem(BALANCE_KEY, String(balance));
  await AsyncStorage.setItem(CLAIMED_KEY, JSON.stringify([...claimed, claimKey].slice(-MAX_CLAIMED_KEYS)));
  return { balance, alreadyClaimed: false };
}

export interface ClaimResult {
  balance: number;
  coinsEarned: number;
  newlyCompleted: MissionDefinition[];
}

/**
 * Walks every mission in `snapshot` and claims the reward for each one that's complete -
 * safe to call from anywhere (HomeScreen on every focus, right after a workout/duel
 * finishes, ...) since `claimReward` above is idempotent per period+mission. Returns only
 * what's newly claimed *this call*, so callers can show a "you just earned this" toast
 * without re-announcing rewards claimed earlier.
 */
export async function claimCompletedMissions(snapshot: MissionsSnapshot): Promise<ClaimResult> {
  let balance = await getCoinBalance();
  let coinsEarned = 0;
  const newlyCompleted: MissionDefinition[] = [];

  for (const { definition, complete } of [...snapshot.daily, ...snapshot.weekly]) {
    if (!complete) continue;
    const periodKey = definition.period === 'daily' ? snapshot.dayKey : snapshot.weekKey;
    const result = await claimReward(`${periodKey}:${definition.id}`, definition.rewardCoins);
    balance = result.balance;
    if (!result.alreadyClaimed) {
      coinsEarned += definition.rewardCoins;
      newlyCompleted.push(definition);
    }
  }

  return { balance, coinsEarned, newlyCompleted };
}
