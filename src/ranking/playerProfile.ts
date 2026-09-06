import { avatarFromGooglePhoto, type PlayerAvatar } from './avatar';
import { STARTING_LP } from './ranks';

/** Firestore-Dokument `players/{uid}` (uid = Firebase-Auth-uid, siehe firebaseAuthBridge.ts). */
export interface RankedPlayerProfile {
  uid: string;
  displayName: string;
  avatar: PlayerAvatar;
  lp: number;
  wins: number;
  losses: number;
  updatedAt: number;
}

export function createDefaultPlayerProfile(
  uid: string,
  displayName: string,
  googlePhotoUrl: string | null,
  now: number = Date.now()
): RankedPlayerProfile {
  return {
    uid,
    displayName,
    avatar: avatarFromGooglePhoto(googlePhotoUrl),
    lp: STARTING_LP,
    wins: 0,
    losses: 0,
    updatedAt: now,
  };
}
