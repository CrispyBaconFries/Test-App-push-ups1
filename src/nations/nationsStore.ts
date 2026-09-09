import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  buildEventResult,
  type NationsEventResult,
  type NationsEventWindow,
  type NationsParticipant,
} from './nationsEvent';

/**
 * Firestore-Zugriff für das Länderspiel.
 *
 * Datenmodell:
 *   nationsEvents/{eventId}                      -> Eckdaten + (nach Ende) das Ergebnis
 *   nationsEvents/{eventId}/participants/{uid}   -> Land und Liegestütze EINES Spielers
 *
 * Warum pro Spieler ein eigenes Dokument statt eines Zählers pro Land: Jeder Client
 * schreibt damit ausschließlich sein eigenes Dokument - dieselbe Regel, die schon für
 * `players/{uid}` gilt (siehe firestore.rules). Ein gemeinsamer Länder-Zähler müsste für
 * alle schreibbar sein und wäre von jedem beliebig manipulierbar. Die Länder-Tabelle
 * entsteht stattdessen beim Lesen (`computeStandings`), ganz ohne Cloud Function - passend
 * dazu, dass dieses Projekt bewusst keine hat.
 */

interface ParticipantDoc {
  countryCode: string;
  reps: number;
  displayName?: string;
  updatedAtMs: number;
}

interface EventDoc {
  startsAtMs: number;
  endsAtMs: number;
  result?: NationsEventResult;
  finalizedAtMs?: number;
}

function eventDoc(eventId: string) {
  return doc(getFirestore(), 'nationsEvents', eventId);
}

function participantsCollection(eventId: string) {
  return collection(getFirestore(), 'nationsEvents', eventId, 'participants');
}

function participantDoc(eventId: string, uid: string) {
  return doc(getFirestore(), 'nationsEvents', eventId, 'participants', uid);
}

/**
 * Trägt den Spieler mit seinem Land ein - **ohne** eine bereits vorhandene Wahl zu
 * überschreiben.
 *
 * Gibt das Land zurück, das danach gilt. Hat der Nutzer auf einem anderen Gerät bereits
 * gewählt, ist das dessen Land und nicht das gerade getippte: Die Wahl ist bis zum Ende
 * des Events bindend, und "bindend" muss auch dann halten, wenn jemand die App auf einem
 * zweiten Handy öffnet. Läuft als Transaktion, damit zwei gleichzeitig startende Geräte
 * nicht beide "war noch nichts da" sehen.
 */
export async function joinEvent(params: {
  window: NationsEventWindow;
  uid: string;
  displayName: string;
  countryCode: string;
}): Promise<string> {
  const { window, uid, displayName, countryCode } = params;
  return runTransaction(getFirestore(), async (tx) => {
    const ref = participantDoc(window.id, uid);
    const snapshot = await tx.get(ref);
    if (snapshot.exists()) {
      return (snapshot.data() as ParticipantDoc).countryCode;
    }
    tx.set(ref, {
      countryCode,
      reps: 0,
      displayName,
      updatedAtMs: Date.now(),
    } satisfies ParticipantDoc);
    return countryCode;
  }).then(async (effectiveCode) => {
    // Eckdaten des Events festhalten, damit die Ergebnisliste sie später anzeigen kann,
    // ohne den Zeitplan von damals nachrechnen zu müssen (der kann sich geändert haben).
    //
    // Bewusst mit `catch`: Das ist eine Bequemlichkeit, keine Voraussetzung. Scheitert es
    // (z. B. weil für dieses Event bereits ein Ergebnis festgeschrieben wurde und die
    // Sicherheitsregeln weitere Änderungen sperren), ist der Spieler trotzdem angemeldet -
    // und das darf ihm nicht als Fehlschlag angezeigt werden.
    await setDoc(
      eventDoc(window.id),
      { startsAtMs: window.startsAtMs, endsAtMs: window.endsAtMs } satisfies Partial<EventDoc>,
      { merge: true }
    ).catch(() => undefined);
    return effectiveCode;
  });
}

/** Das eigene Land und der eigene Zwischenstand, oder `null` wenn noch nicht mitgemacht. */
export async function loadMyParticipation(
  eventId: string,
  uid: string
): Promise<{ countryCode: string; reps: number } | null> {
  const snapshot = await getDoc(participantDoc(eventId, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as ParticipantDoc;
  return { countryCode: data.countryCode, reps: data.reps ?? 0 };
}

/**
 * Schreibt Liegestütze gut. Legt den Eintrag an, falls er fehlt (z. B. weil die Wahl
 * offline getroffen wurde und erst jetzt hochgeht), respektiert aber ein bereits
 * eingetragenes Land.
 *
 * Bewusst `runTransaction` und nicht `increment()`: Nur so lässt sich im selben Zug
 * prüfen, ob das Land schon feststeht, ohne es zu überschreiben.
 */
export async function creditReps(params: {
  window: NationsEventWindow;
  uid: string;
  displayName: string;
  countryCode: string;
  reps: number;
}): Promise<void> {
  const { window, uid, displayName, countryCode, reps } = params;
  if (reps <= 0) return;
  await runTransaction(getFirestore(), async (tx) => {
    const ref = participantDoc(window.id, uid);
    const snapshot = await tx.get(ref);
    const existing = snapshot.exists() ? (snapshot.data() as ParticipantDoc) : null;
    tx.set(ref, {
      countryCode: existing?.countryCode ?? countryCode,
      reps: (existing?.reps ?? 0) + reps,
      displayName,
      updatedAtMs: Date.now(),
    } satisfies ParticipantDoc);
  });
}

export async function loadParticipants(eventId: string): Promise<NationsParticipant[]> {
  const snapshot = await getDocs(participantsCollection(eventId));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as ParticipantDoc;
    return {
      uid: entry.id,
      countryCode: data.countryCode,
      reps: data.reps ?? 0,
      displayName: data.displayName,
    };
  });
}

/**
 * Das veröffentlichte Ergebnis eines beendeten Events - berechnet es beim ersten Aufruf
 * nach Eventende einmalig und schreibt es fest.
 *
 * Ohne Server gibt es niemanden, der zum Eventende einen Cron-Job ausführt. Stattdessen
 * finalisiert der erste Client, der nach Eventende hinschaut - dasselbe "faule" Muster,
 * das `syncTrainingProgress` schon für den Wochenwechsel der Rangliste benutzt. Sobald
 * das Ergebnis einmal festgeschrieben ist, ändert es sich nicht mehr, auch wenn später
 * noch ein verspäteter Offline-Sync eintrudelt.
 */
export async function loadOrFinalizeResult(
  window: NationsEventWindow,
  nowMs: number = Date.now()
): Promise<NationsEventResult | null> {
  const snapshot = await getDoc(eventDoc(window.id));
  const existing = snapshot.exists() ? (snapshot.data() as EventDoc) : null;
  if (existing?.result) return existing.result;
  if (nowMs < window.endsAtMs) return null; // Läuft noch - es gibt noch kein Endergebnis.

  const result = buildEventResult(window, await loadParticipants(window.id));
  await setDoc(
    eventDoc(window.id),
    {
      startsAtMs: window.startsAtMs,
      endsAtMs: window.endsAtMs,
      result,
      finalizedAtMs: nowMs,
    } satisfies EventDoc,
    { merge: true }
  );
  return result;
}

/**
 * Die zuletzt veröffentlichten Ergebnisse, neueste zuerst.
 *
 * Bewusst nur nach `startsAtMs` sortiert und clientseitig auf finalisierte Events
 * gefiltert: Ein zusätzliches `where('finalized', '==', true)` bräuchte einen
 * zusammengesetzten Index in Firestore, den chris von Hand anlegen müsste.
 */
export async function loadRecentResults(count = 10): Promise<NationsEventResult[]> {
  const q = query(
    collection(getFirestore(), 'nationsEvents'),
    orderBy('startsAtMs', 'desc'),
    fsLimit(count * 2)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((entry) => (entry.data() as EventDoc).result)
    .filter((result): result is NationsEventResult => Boolean(result))
    .slice(0, count);
}
