import { avatarFromGooglePhoto, type PlayerAvatar } from './avatar';
import { STARTING_LP } from './ranks';
import { weekKey } from '../gamification/missions';

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
    updatedAt: now,
  };
}
