import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { isFirebaseConfigured } from '../firebase/firebaseConfig';
import { ensureFirebaseBridged } from '../firebase/firebaseAuthBridge';
import { loadOrCreatePlayerProfile } from './playerProfileStore';
import { tierForLp } from './ranks';
import type { DuelPlayerInfo } from '../duel/duelSession';

export type DuelIdentityStatus = 'loading' | 'notConfigured' | 'needsReauth' | 'ready' | 'error';

export interface DuelIdentity {
  status: DuelIdentityStatus;
  me: DuelPlayerInfo | null;
}

/**
 * Gemeinsame Voraussetzung für jeden Ranking-Screen (Freundschaftsspiel-Lobby,
 * Ranked-Matchmaking, ...): Firebase muss eingerichtet sein, der Nutzer bei Google
 * angemeldet, mit Firebase Auth verknüpft, und das Firestore-Spielerprofil geladen
 * (bzw. beim ersten Mal angelegt). Bündelt das an einer Stelle statt es in jedem Screen
 * zu wiederholen.
 */
export function useDuelIdentity(): DuelIdentity {
  const auth = useAuth();
  const [status, setStatus] = useState<DuelIdentityStatus>('loading');
  const [me, setMe] = useState<DuelPlayerInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!isFirebaseConfigured()) {
        setStatus('notConfigured');
        return;
      }
      if (auth.status !== 'signedIn' || !auth.profile) {
        setStatus('needsReauth');
        return;
      }
      const uid = await ensureFirebaseBridged();
      if (!uid) {
        setStatus('needsReauth');
        return;
      }
      const profile = await loadOrCreatePlayerProfile(uid, auth.profile.name ?? auth.profile.email, auth.profile.photoUrl);
      if (cancelled) return;
      setMe({
        uid,
        displayName: profile.displayName,
        avatar: profile.avatar,
        tier: tierForLp(profile.lp).tier,
        lp: profile.lp,
      });
      setStatus('ready');
    }

    setup().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, me };
}
