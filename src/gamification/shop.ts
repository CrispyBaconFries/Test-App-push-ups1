import { AVATAR_ICON_IDS, DEFAULT_AVATAR_ICON_ID, type AvatarIconId } from '../ranking/avatar';
import { FRAME_THEME_IDS, frameThemeById, type FrameThemeId } from '../ranking/frameThemes';

/**
 * Preis-Philosophie (siehe README "Münz-Shop" für die volle Herleitung): als Maßstab
 * dient, wie viele Münzen ein einigermaßen aktiver Tag/Woche realistisch einbringt
 * (Missionen, siehe missions.ts - grob 60-80 Münzen an einem vollen Tag, ~220 zusätzlich
 * pro Woche). Die Streak-Rettung ist bewusst am günstigsten (Nutzers eigene Idee: "3-4
 * Tage" Login-Bonus, siehe loginStreak.ts - die ersten 4 Tage ergeben 10+15+20+25=70,
 * daher 60 als runde Zahl knapp darunter). Avatare sind reine, günstige Sammel-Kosmetik
 * (~1-2 Tage). Rahmen-Themes sind sichtbarer (überall wo `RankFrame` auftaucht) und
 * daher spürbar teurer (~3-5 Tage) - ein glaubwürdiges "Flex"-Item, ohne eine ganze
 * Woche Grind zu verlangen.
 */
export const STREAK_FREEZE_PRICE = 60;
export const AVATAR_PRICE = 100;
export const FRAME_THEME_PRICE = 250;

export type ShopItemCategory = 'streak_freeze' | 'avatar' | 'frame';

interface ShopItemBase {
  id: string;
  category: ShopItemCategory;
  title: string;
  description: string;
  price: number;
  /** Ionicons-Name für die Shop-Liste selbst (nicht die Kosmetik im RankFrame). */
  icon: string;
}

export interface StreakFreezeShopItem extends ShopItemBase {
  category: 'streak_freeze';
}

export interface AvatarShopItem extends ShopItemBase {
  category: 'avatar';
  iconId: AvatarIconId;
}

export interface FrameShopItem extends ShopItemBase {
  category: 'frame';
  frameThemeId: FrameThemeId;
}

export type ShopItem = StreakFreezeShopItem | AvatarShopItem | FrameShopItem;

const STREAK_FREEZE_ITEM: StreakFreezeShopItem = {
  id: 'streak_freeze',
  category: 'streak_freeze',
  title: 'Streak-Rettung',
  description: 'Schützt deine Trainings-Streak automatisch vor dem nächsten verpassten Tag.',
  price: STREAK_FREEZE_PRICE,
  icon: 'snow',
};

// 'flame' ist der kostenlose Start-Avatar (DEFAULT_AVATAR_ICON_ID) - der taucht hier
// nicht auf, den "besitzt" ohnehin jeder schon.
const AVATAR_ITEMS: AvatarShopItem[] = AVATAR_ICON_IDS.filter((iconId) => iconId !== DEFAULT_AVATAR_ICON_ID).map(
  (iconId) => ({
    id: `avatar_${iconId}`,
    category: 'avatar' as const,
    title: `Avatar: ${iconId}`,
    description: 'Kosmetisches Avatar-Icon, sichtbar überall wo dein Profil auftaucht.',
    price: AVATAR_PRICE,
    icon: iconId,
    iconId,
  })
);

const FRAME_ITEMS: FrameShopItem[] = FRAME_THEME_IDS.filter((id) => id !== 'default').map((id) => ({
  id: `frame_${id}`,
  category: 'frame' as const,
  title: `Rahmen: ${frameThemeById(id).label}`,
  description: 'Färbt deinen Rang-Rahmen um - Ringdicke/Glow bleiben deinem Rang treu.',
  price: FRAME_THEME_PRICE,
  icon: 'ellipse',
  frameThemeId: id,
}));

export const SHOP_ITEMS: ShopItem[] = [STREAK_FREEZE_ITEM, ...AVATAR_ITEMS, ...FRAME_ITEMS];

export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
