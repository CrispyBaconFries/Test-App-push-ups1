/**
 * Spieler-Avatar für Ranglisten/Duelle: entweder ein Icon aus einer festen
 * Auswahl, oder ein eigenes Foto (Selfie). Die eigentlichen Icon-/Bild-Assets
 * kommen in einem späteren Schritt - dieser Typ + eine Platzhalter-Icon-Liste
 * legen nur das Datenmodell fest, damit `RankFrame` (src/components/RankFrame.tsx)
 * und das Spielerprofil (`playerProfile.ts`) schon jetzt darauf aufbauen können.
 */

export type PlayerAvatar =
  | { type: 'icon'; iconId: AvatarIconId }
  | { type: 'photo'; photoUrl: string };

/**
 * Platzhalter-Auswahl (Ionicons-Namen, bereits im Projekt via @expo/vector-icons
 * verfügbar) - wird durch eigens gestaltete Icons ersetzt/ergänzt, sobald die
 * Bild-Assets fertig sind. Der Typ `AvatarIconId` bleibt dabei stabil, nur die
 * Zuordnung zu tatsächlichen Grafiken ändert sich.
 */
export const AVATAR_ICON_IDS = [
  'flame',
  'flash',
  'rocket',
  'skull',
  'paw',
  'planet',
  'diamond',
  'shield',
] as const;

export type AvatarIconId = (typeof AVATAR_ICON_IDS)[number];

/** Eigene Konstante (statt nur `DEFAULT_AVATAR.iconId`), weil `DEFAULT_AVATAR` als `PlayerAvatar`-Union typisiert ist und `.iconId` sich darauf nicht ohne Typ-Verengung zugreifen lässt - siehe RankFrame.tsx's `AvatarContent` für den Vergleich "wurde bewusst ein anderes Icon gewählt?". */
export const DEFAULT_AVATAR_ICON_ID: AvatarIconId = 'flame';

export const DEFAULT_AVATAR: PlayerAvatar = { type: 'icon', iconId: DEFAULT_AVATAR_ICON_ID };

/** Nutzt ein vorhandenes Google-Profilbild als Startpunkt, falls vorhanden. */
export function avatarFromGooglePhoto(photoUrl: string | null): PlayerAvatar {
  return photoUrl ? { type: 'photo', photoUrl } : DEFAULT_AVATAR;
}
