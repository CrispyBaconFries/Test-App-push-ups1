import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AvatarIconId } from '../ranking/avatar';
import type { FrameThemeId } from '../ranking/frameThemes';
import type { ShopItem } from './shop';
import { spendCoins } from './currencyStore';
import { addHeldStreakFreeze } from './streakFreezeStore';
import { updateEquippedAvatar, updateEquippedFrameTheme } from '../ranking/playerProfileStore';

/**
 * Lokales Besitz-Register für die kosmetischen Shop-Items (Avatare/Rahmen-Themes) -
 * *nur* welche man schon gekauft hat, damit man später gefahrlos zwischen bereits
 * besessenen Items wechseln kann, ohne erneut zu bezahlen. Das eigentliche "gerade
 * ausgerüstete" Item ist NICHT hier gespeichert, sondern direkt das Firestore-Feld
 * `players/{uid}.avatar`/`frameThemeId` (siehe playerProfileStore.ts) - so sehen auch
 * andere Spieler (Duelle, Rangliste) sofort dieselbe Wahl, ohne einen zweiten
 * Sync-Mechanismus zu brauchen. Die Streak-Rettung ist rein lokal (kein Firestore
 * nötig) und wird komplett in streakFreezeStore.ts verwaltet, nicht hier.
 *
 * Bewusste Grenze: dieser Besitz ist rein lokal auf diesem Gerät - eine Neuinstallation
 * oder ein Gerätewechsel verliert den Kaufverlauf der Kosmetik (nicht aber die
 * Münzen/Missionen, die serverseitig bzw. wie der Rest der App lokal überleben würden
 * ohnehin nur auf diesem Gerät existieren). Für ein Hobby-Projekt akzeptabel; ein
 * sauberer Fix wäre, den Besitz zusätzlich in Firestore zu spiegeln.
 */
const OWNED_AVATARS_KEY = '@pushup/ownedAvatarIconIds';
const OWNED_FRAMES_KEY = '@pushup/ownedFrameThemeIds';

async function loadOwnedSet(key: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function loadOwnedAvatarIconIds(): Promise<Set<AvatarIconId>> {
  return (await loadOwnedSet(OWNED_AVATARS_KEY)) as Set<AvatarIconId>;
}

export async function loadOwnedFrameThemeIds(): Promise<Set<FrameThemeId>> {
  return (await loadOwnedSet(OWNED_FRAMES_KEY)) as Set<FrameThemeId>;
}

async function markOwned(key: string, id: string): Promise<void> {
  const owned = await loadOwnedSet(key);
  owned.add(id);
  await AsyncStorage.setItem(key, JSON.stringify([...owned]));
}

export type PurchaseFailureReason = 'insufficient_funds' | 'not_signed_in';

export interface PurchaseResult {
  ok: boolean;
  reason?: PurchaseFailureReason;
  balance: number;
}

/**
 * Kauft (und für Avatar/Rahmen: rüstet direkt aus) ein Shop-Item. `uid` ist nur für
 * Avatar/Rahmen nötig (die serverseitig sichtbar sein sollen) - `null` für die
 * Streak-Rettung, die rein lokal funktioniert. Bereits besessene Avatare/Rahmen können
 * (und sollen) stattdessen über `equipOwnedAvatar`/`equipOwnedFrameTheme` unten erneut
 * ausgerüstet werden, ohne ein zweites Mal zu bezahlen - diese Funktion hier ist nur für
 * den *ersten* Kauf.
 */
export async function purchaseItem(item: ShopItem, uid: string | null): Promise<PurchaseResult> {
  if (item.category !== 'streak_freeze' && !uid) {
    return { ok: false, reason: 'not_signed_in', balance: 0 };
  }

  const spend = await spendCoins(item.price);
  if (!spend.ok) return { ok: false, reason: 'insufficient_funds', balance: spend.balance };

  if (item.category === 'streak_freeze') {
    await addHeldStreakFreeze();
  } else if (item.category === 'avatar') {
    await markOwned(OWNED_AVATARS_KEY, item.id);
    await updateEquippedAvatar(uid!, { type: 'icon', iconId: item.iconId });
  } else {
    await markOwned(OWNED_FRAMES_KEY, item.id);
    await updateEquippedFrameTheme(uid!, item.frameThemeId);
  }

  return { ok: true, balance: spend.balance };
}

export async function equipOwnedAvatar(uid: string, iconId: AvatarIconId): Promise<void> {
  await updateEquippedAvatar(uid, { type: 'icon', iconId });
}

export async function equipOwnedFrameTheme(uid: string, frameThemeId: FrameThemeId): Promise<void> {
  await updateEquippedFrameTheme(uid, frameThemeId);
}
