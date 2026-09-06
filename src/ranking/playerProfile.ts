import { avatarFromGooglePhoto, type PlayerAvatar } from './avatar';
import { STARTING_LP } from './ranks';
import { weekKey } from '../gamification/missions';
import type { FrameThemeId } from './frameThemes';
// Derselbe generische 6-stellige Code wie für Freundschaftsspiel-Einladungen (kein
// verwechselbares 0/O/1/I/L) - hier als dauerhafter "Freundescode" pro Spieler
// wiederverwendet statt einen zweiten, fast identischen Generator zu bauen.
import { generateDuelCode } from '../duel/duelCode';

/** Firestore-Dokument `players/{uid}` (uid = Firebase-Auth-uid, siehe firebaseAuthBridge.ts). */
export interface RankedPlayerProfile {
  uid: string;
  displayName: string;
  avatar: PlayerAvatar;
  lp: number;
  wins: number;
  losses: number;
  /** All-time Liegestütze, aus lokalen WorkoutSessions synchronisiert (siehe leaderboardSync.ts) - Grundlage der Gesamtrangliste. */
  totalReps: number;
  /** Liegestütze innerhalb der durch `weeklyBucketKey` benannten Woche - wird ohne Cloud Function "faul" zurückgesetzt, siehe `syncTrainingProgress` in playerProfileStore.ts. */
  weeklyReps: number;
  weeklyBucketKey: string;
  /** Wie `totalReps`, aber die Form-Score-gewichteten Punkte (`src/gamification/points.ts`) - Grundlage fürs Level auf dem Profil-Screen, auch für fremde Profile (siehe ProfileScreen.tsx). */
  totalPoints: number;
  /** Gekauftes Rahmen-Theme aus dem Münz-Shop (siehe frameThemes.ts) - 'default' = normale Rang-Farbe. */
  frameThemeId: FrameThemeId;
  /** Kurzer, teilbarer Code zum Hinzufügen als Freund (siehe friendsStore.ts) - einmalig bei Profilerstellung generiert. */
  friendCode: string;
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
    totalReps: 0,
    weeklyReps: 0,
    weeklyBucketKey: weekKey(new Date(now)),
    totalPoints: 0,
    frameThemeId: 'default',
    friendCode: generateDuelCode(),
    updatedAt: now,
  };
}
