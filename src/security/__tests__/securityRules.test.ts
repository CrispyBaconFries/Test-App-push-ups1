
/**
 * Wächter-Tests für `firestore.rules` und `database.rules.json`.
 *
 * Was diese Tests NICHT können: die Regeln wirklich auswerten. Dafür bräuchte es die
 * Firebase-Emulator-Suite (`@firebase/rules-unit-testing`), also einen laufenden
 * Emulator - der steht in dieser Umgebung nicht zur Verfügung. Die tatsächliche
 * Wirkung muss deshalb einmalig in der Firebase-Konsole geprüft werden
 * (Rules Playground, siehe README-Abschnitt "Sicherheit").
 *
 * Was sie sehr wohl können: verhindern, dass eine der bewusst gesetzten Einschränkungen
 * beim nächsten Umbau still wieder herausfällt. Genau das ist hier schon einmal
 * passiert - die RTDB-Regel prüfte `playerIds`, während das Feld längst `players` hieß.
 */

// `fs`/`path` bewusst per `require` statt per `import`: Das Projekt bindet die
// Node-Typen nicht ein (tsconfig `types: ["jest"]`), weil sie sich mit den
// React-Native-Typen in die Quere kommen - z. B. beim Rückgabewert von `setTimeout`.
// Ein Test, der Dateien liest, ist der einzige Ort, der Node braucht.
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: string) => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

const REPO_ROOT = join(__dirname, '..', '..', '..');
const firestoreRules = readFileSync(join(REPO_ROOT, 'firestore.rules'), 'utf8');
const databaseRulesRaw = readFileSync(join(REPO_ROOT, 'database.rules.json'), 'utf8');

/** Zeilen ohne Kommentare - sonst würde ein erklärender Kommentar einen Test bestehen lassen. */
function rulesWithoutComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const firestoreCode = rulesWithoutComments(firestoreRules);

describe('firestore.rules', () => {
  it('erlaubt nirgends unbeschränktes Schreiben für beliebige eingeloggte Nutzer', () => {
    // Genau diese Zeile stand bis zur Sicherheitsdurchsicht bei `rankedQueue` und
    // erlaubte jedem, jeden fremden Warteschlangen-Eintrag beliebig zu überschreiben.
    const openWrite = /allow\s+(write|update)\s*:\s*if\s+request\.auth\s*!=\s*null\s*;/;
    expect(firestoreCode).not.toMatch(openWrite);
    expect(firestoreCode).not.toMatch(/allow\s+[a-z, ]*write[a-z, ]*:\s*if\s+true\s*;/);
  });

  it('lässt jeden nur sein eigenes Spielerprofil schreiben', () => {
    expect(firestoreCode).toMatch(/match \/players\/\{uid\}/);
    expect(firestoreCode).toMatch(/request\.auth\.uid == uid/);
  });

  it('hält Zähler und Rekorde im Spielerprofil monoton', () => {
    for (const field of [
      'totalReps',
      'totalPoints',
      'wins',
      'losses',
      'bestDayReps',
      'bestSessionReps',
      'longestStreakDays',
    ]) {
      expect(firestoreCode).toContain(`neverShrinks('${field}')`);
    }
  });

  it('deckelt den Zuwachs je Schreibzugriff', () => {
    expect(firestoreCode).toContain("grewAtMost('totalReps', maxRepsPerWrite())");
    expect(firestoreCode).toContain("grewAtMost('wins', 1)");
    expect(firestoreCode).toContain("grewAtMost('losses', 1)");
    expect(firestoreCode).toContain('maxLpDelta()');
  });

  it('macht Identitätsfelder unveränderlich und verbietet das Löschen des Profils', () => {
    expect(firestoreCode).toContain("unchanged('uid')");
    expect(firestoreCode).toContain("unchanged('friendCode')");
    // Ohne Löschsperre ließe sich jede "wächst nur"-Regel über löschen + neu anlegen umgehen.
    expect(firestoreCode).toMatch(/match \/players\/\{uid\}[\s\S]*?allow delete: if false;/);
  });

  it('lässt Fremde in der Matchmaking-Warteschlange nur den Übergang waiting -> matched machen', () => {
    const queueBlock = firestoreCode.slice(firestoreCode.indexOf('match /rankedQueue/{uid}'));
    expect(queueBlock).toContain("hasOnly(['status', 'matchedDuelCode'])");
    expect(queueBlock).toContain("resource.data.status == 'waiting'");
    expect(queueBlock).toContain("request.resource.data.status == 'matched'");
    // Der Besitzer selbst darf seinen Eintrag neu setzen - `joinQueue` (setDoc ohne
    // Merge) ist auf einem übrig gebliebenen Eintrag ein Update, kein Create.
    expect(queueBlock).toContain('request.auth.uid == uid || claimTransition()');
  });

  it('lässt ein Länderspiel-Ergebnis erst nach dem Eventende entstehen und dann nie wieder ändern', () => {
    expect(firestoreCode).toContain('request.time.toMillis() >= request.resource.data.endsAtMs');
    expect(firestoreCode).toContain("!('result' in resource.data)");
    // Zeitraum liegt nach dem Anlegen fest - sonst könnte man das Ende vorziehen.
    expect(firestoreCode).toContain('request.resource.data.endsAtMs == resource.data.endsAtMs');
  });

  it('hält die Länderwahl bindend und die Liegestütze monoton', () => {
    const participants = firestoreCode.slice(firestoreCode.indexOf('match /participants/{uid}'));
    expect(participants).toContain('request.resource.data.countryCode == resource.data.countryCode');
    expect(participants).toContain('request.resource.data.reps >= resource.data.reps');
  });
});

describe('database.rules.json', () => {
  const parsed = JSON.parse(databaseRulesRaw) as {
    rules: Record<string, any>;
  };

  it('ist gültiges JSON mit einem rules-Block', () => {
    expect(parsed.rules).toBeDefined();
  });

  const duel = () => parsed.rules.duels.$duelId;

  it('prüft die Teilnehmer am Feld `players` - nicht am längst umbenannten `playerIds`', () => {
    // Der ursprüngliche Fehler: Die Regel prüfte `playerIds`, duelSession.ts schreibt
    // aber `players`. Damit war JEDER Zugriff verboten, das Duell also funktionsunfähig.
    expect(databaseRulesRaw).not.toContain('playerIds');
    expect(duel()['.read']).toContain("data.child('players').child(auth.uid).exists()");
  });

  it('erlaubt das Beitreten zu einem Duell mit noch freiem Platz', () => {
    expect(duel()['.write']).toContain("data.child('players').numChildren() < 2");
  });

  it('schützt den Zählerstand des Gegners über .validate statt .write', () => {
    // .write vererbt sich nach unten und lässt sich tiefer nicht entziehen - der Schutz
    // MUSS deshalb in .validate stehen, sonst ist er wirkungslos.
    const players = duel().players.$playerUid;
    for (const field of ['reps', 'finished', 'finishedReps', 'ready']) {
      expect(players[field]['.validate']).toContain('auth.uid === $playerUid');
      expect(players[field]['.validate']).toContain('newData.val() === data.val()');
    }
  });

  it('macht LP und Anzeigename im Duell nach dem Eintragen unveränderlich', () => {
    const players = duel().players.$playerUid;
    for (const field of ['lp', 'displayName']) {
      expect(players[field]['.validate']).toContain('newData.val() === data.val()');
      expect(players[field]['.validate']).not.toContain('auth.uid === $playerUid');
    }
  });

  it('sperrt unbekannte Felder und alles außerhalb von duels', () => {
    expect(duel().$other['.validate']).toBe(false);
    expect(duel().players.$playerUid.$other['.validate']).toBe(false);
    expect(parsed.rules.$other['.read']).toBe(false);
    expect(parsed.rules.$other['.write']).toBe(false);
  });
});
