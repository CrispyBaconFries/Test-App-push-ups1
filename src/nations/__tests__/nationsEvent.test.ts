import {
  DEFAULT_NATIONS_SCHEDULE,
  buildEventResult,
  computeStandings,
  currentEventWindow,
  eventWindowForTimestamp,
  formatDurationDe,
  formatEventRangeDe,
  mostRecentFinishedEventWindow,
  nextEventWindow,
  type NationsEventSchedule,
  type NationsParticipant,
} from '../nationsEvent';

/**
 * Die Standard-Einstellung ist Freitag 00:00 bis Montag 00:00 in der Ereigniszone
 * (UTC+2). In UTC ausgedrückt beginnt das Fenster also Donnerstag um 22:00.
 */
const zoneTime = (isoWithoutZone: string) => new Date(`${isoWithoutZone}+02:00`).getTime();

describe('currentEventWindow (wöchentlich, Freitag bis Sonntag)', () => {
  it('läuft von Freitag 00:00 bis Montag 00:00 in der Ereigniszone', () => {
    const window = currentEventWindow(zoneTime('2026-09-11T12:00:00'));

    expect(window).not.toBeNull();
    expect(window!.id).toBe('2026-09-11');
    expect(window!.startsAtMs).toBe(zoneTime('2026-09-11T00:00:00'));
    expect(window!.endsAtMs).toBe(zoneTime('2026-09-14T00:00:00'));
  });

  it('umfasst den ganzen Sonntag, aber nicht mehr den Montag', () => {
    expect(currentEventWindow(zoneTime('2026-09-13T23:59:59'))).not.toBeNull();
    expect(currentEventWindow(zoneTime('2026-09-14T00:00:00'))).toBeNull();
  });

  it('beginnt exakt zur Startstunde - eine Sekunde davor läuft noch nichts', () => {
    expect(currentEventWindow(zoneTime('2026-09-10T23:59:59'))).toBeNull();
    expect(currentEventWindow(zoneTime('2026-09-11T00:00:00'))).not.toBeNull();
  });

  it('gilt für alle Spieler gleichzeitig, unabhängig von deren Zeitzone', () => {
    // Derselbe Augenblick, nur anders geschrieben: In Neuseeland (UTC+12) ist es bereits
    // Freitagmorgen, in der Ereigniszone gerade erst Mitternacht. Beide sind drin.
    const sameInstant = new Date('2026-09-11T10:00:00+12:00').getTime();
    expect(sameInstant).toBe(zoneTime('2026-09-11T00:00:00'));
    expect(currentEventWindow(sameInstant)).not.toBeNull();
  });

  it('ist zwischen zwei Events geschlossen', () => {
    expect(currentEventWindow(zoneTime('2026-09-15T12:00:00'))).toBeNull();
    expect(currentEventWindow(zoneTime('2026-09-17T23:00:00'))).toBeNull();
  });
});

describe('nextEventWindow', () => {
  it('nennt den kommenden Freitag, wenn gerade kein Event läuft', () => {
    expect(nextEventWindow(zoneTime('2026-09-15T12:00:00')).id).toBe('2026-09-18');
  });

  it('nennt während eines laufenden Events bereits das darauffolgende', () => {
    expect(nextEventWindow(zoneTime('2026-09-12T12:00:00')).id).toBe('2026-09-18');
  });

  it('liefert nie ein Fenster, das schon begonnen hat', () => {
    const exactlyAtStart = zoneTime('2026-09-11T00:00:00');
    expect(nextEventWindow(exactlyAtStart).startsAtMs).toBeGreaterThan(exactlyAtStart);
  });
});

describe('eventWindowForTimestamp', () => {
  it('ordnet eine offline nachgetragene Session dem Event zu, in dem sie stattfand', () => {
    // Sonntagabend trainiert, ohne Internet - erst am Dienstag hochgeladen. Die
    // Liegestütze gehören zum Event von Freitag, nicht zu gar keinem und nicht zum nächsten.
    const trainedAt = zoneTime('2026-09-13T20:30:00');
    expect(eventWindowForTimestamp(trainedAt)!.id).toBe('2026-09-11');
  });

  it('gibt null zurück für eine Session außerhalb jedes Events', () => {
    expect(eventWindowForTimestamp(zoneTime('2026-09-16T18:00:00'))).toBeNull();
  });
});

describe('Zeitplan "alle drei Tage für drei Tage"', () => {
  // Der zweite Modus, den chris sich für später offenhalten wollte - ohne Änderung an
  // Bildschirmen oder Sync, nur eine andere Einstellung.
  const everyThreeDays: NationsEventSchedule = {
    ...DEFAULT_NATIONS_SCHEDULE,
    repeat: { mode: 'everyNDays', anchorDate: '2026-09-11', periodDays: 3 },
  };

  it('läuft lückenlos weiter, wenn Dauer und Abstand gleich sind', () => {
    expect(currentEventWindow(zoneTime('2026-09-11T12:00:00'), everyThreeDays)!.id).toBe('2026-09-11');
    expect(currentEventWindow(zoneTime('2026-09-14T12:00:00'), everyThreeDays)!.id).toBe('2026-09-14');
    expect(currentEventWindow(zoneTime('2026-09-17T12:00:00'), everyThreeDays)!.id).toBe('2026-09-17');
  });

  it('läuft vor dem Ankertag noch gar nicht', () => {
    expect(currentEventWindow(zoneTime('2026-09-10T12:00:00'), everyThreeDays)).toBeNull();
    expect(nextEventWindow(zoneTime('2026-09-10T12:00:00'), everyThreeDays).id).toBe('2026-09-11');
  });

  it('lässt eine Pause, wenn der Abstand größer ist als die Dauer', () => {
    const everySevenDays: NationsEventSchedule = {
      ...DEFAULT_NATIONS_SCHEDULE,
      repeat: { mode: 'everyNDays', anchorDate: '2026-09-11', periodDays: 7 },
    };
    expect(currentEventWindow(zoneTime('2026-09-13T12:00:00'), everySevenDays)).not.toBeNull();
    expect(currentEventWindow(zoneTime('2026-09-15T12:00:00'), everySevenDays)).toBeNull();
    expect(currentEventWindow(zoneTime('2026-09-18T12:00:00'), everySevenDays)!.id).toBe('2026-09-18');
  });
});

describe('computeStandings', () => {
  const participants: NationsParticipant[] = [
    { uid: 'a', countryCode: 'DE', reps: 100 },
    { uid: 'b', countryCode: 'DE', reps: 50 },
    { uid: 'c', countryCode: 'AT', reps: 120 },
    { uid: 'd', countryCode: 'CH', reps: 0 },
  ];

  it('sortiert absteigend nach Liegestützen und rechnet den Schnitt je Spieler', () => {
    const standings = computeStandings(participants);

    expect(standings.map((s) => s.countryCode)).toEqual(['DE', 'AT', 'CH']);
    expect(standings[0]).toMatchObject({ countryCode: 'DE', reps: 150, players: 2, averageReps: 75 });
    expect(standings[1]).toMatchObject({ countryCode: 'AT', reps: 120, players: 1, averageReps: 120 });
  });

  it('zählt angemeldete Spieler ohne Wiederholung nicht in den Schnitt', () => {
    // Sonst würde jede Anmeldung ohne Training den Schnitt eines Landes drücken, und ein
    // Land mit vielen Karteileichen stünde schlechter da als eines mit wenigen Aktiven.
    const withIdlePlayers = computeStandings([
      ...participants,
      { uid: 'e', countryCode: 'DE', reps: 0 },
      { uid: 'f', countryCode: 'DE', reps: 0 },
    ]);
    const germany = withIdlePlayers.find((s) => s.countryCode === 'DE')!;

    expect(germany.players).toBe(2);
    expect(germany.averageReps).toBe(75);
    expect(germany.registeredPlayers).toBe(4);
  });

  it('gibt einem Land ohne Wiederholungen den Schnitt 0 statt NaN', () => {
    const switzerland = computeStandings(participants).find((s) => s.countryCode === 'CH')!;
    expect(switzerland.averageReps).toBe(0);
    expect(switzerland.players).toBe(0);
  });

  it('entscheidet Gleichstand über den höheren Schnitt je Spieler', () => {
    const standings = computeStandings([
      { uid: 'a', countryCode: 'DE', reps: 60 },
      { uid: 'b', countryCode: 'DE', reps: 60 },
      { uid: 'c', countryCode: 'AT', reps: 120 },
    ]);
    expect(standings.map((s) => s.countryCode)).toEqual(['AT', 'DE']);
  });

  it('ignoriert kaputte Zahlen aus der Datenbank, statt die Tabelle zu vergiften', () => {
    const standings = computeStandings([
      { uid: 'a', countryCode: 'DE', reps: Number.NaN },
      { uid: 'b', countryCode: 'DE', reps: -5 },
      { uid: 'c', countryCode: 'DE', reps: 10.7 },
    ]);
    expect(standings[0]).toMatchObject({ countryCode: 'DE', reps: 10, players: 1 });
  });
});

describe('buildEventResult', () => {
  const window = currentEventWindow(zoneTime('2026-09-12T12:00:00'))!;

  it('veröffentlicht Sieger, Liegestütze, Spielerzahl und Schnitt', () => {
    const result = buildEventResult(window, [
      { uid: 'a', countryCode: 'DE', reps: 100 },
      { uid: 'b', countryCode: 'DE', reps: 50 },
      { uid: 'c', countryCode: 'AT', reps: 120 },
    ]);

    expect(result).toMatchObject({
      eventId: '2026-09-11',
      winnerCountryCode: 'DE',
      winnerReps: 150,
      winnerPlayers: 2,
      winnerAverageReps: 75,
      totalReps: 270,
      totalPlayers: 3,
    });
  });

  it('kürt keinen Sieger, wenn niemand eine einzige Wiederholung gemacht hat', () => {
    const result = buildEventResult(window, [
      { uid: 'a', countryCode: 'DE', reps: 0 },
      { uid: 'b', countryCode: 'AT', reps: 0 },
    ]);

    expect(result.winnerCountryCode).toBeNull();
    expect(result.totalReps).toBe(0);
    expect(result.standings).toHaveLength(2);
  });

  it('kommt mit einem Event ohne Teilnehmer klar', () => {
    const result = buildEventResult(window, []);
    expect(result.winnerCountryCode).toBeNull();
    expect(result.standings).toEqual([]);
  });
});

describe('formatEventRangeDe', () => {
  it('nennt Anfang und Ende in der Ereigniszone, nicht in der des Handys', () => {
    const window = currentEventWindow(zoneTime('2026-09-12T12:00:00'))!;
    expect(formatEventRangeDe(window)).toBe('Fr 11.09., 00:00 Uhr bis So 13.09., 24:00 Uhr');
  });

  it('zeigt den letzten Tag als "24:00 Uhr" statt den Folgetag als "00:00 Uhr"', () => {
    // "bis Mo 00:00 Uhr" würde sich lesen, als wäre der Sonntag nicht mehr dabei.
    const window = currentEventWindow(zoneTime('2026-09-12T12:00:00'))!;
    expect(formatEventRangeDe(window)).toContain('So 13.09., 24:00 Uhr');
    expect(formatEventRangeDe(window)).not.toContain('Mo');
  });

  it('zeigt eine echte Uhrzeit, wenn das Ende nicht auf Mitternacht fällt', () => {
    const halfDay: NationsEventSchedule = { ...DEFAULT_NATIONS_SCHEDULE, startHour: 18, durationDays: 1 };
    const window = currentEventWindow(zoneTime('2026-09-11T20:00:00'), halfDay)!;
    expect(formatEventRangeDe(window, halfDay)).toBe('Fr 11.09., 18:00 Uhr bis Sa 12.09., 18:00 Uhr');
  });
});

describe('formatDurationDe', () => {
  it('nennt Tage und Stunden, sobald mindestens ein Tag übrig ist', () => {
    expect(formatDurationDe((2 * 24 + 5) * 3600_000)).toBe('2 Tage 5 Std.');
    expect(formatDurationDe((24 + 1) * 3600_000)).toBe('1 Tag 1 Std.');
  });

  it('nennt Stunden und Minuten unterhalb eines Tages', () => {
    expect(formatDurationDe(3 * 3600_000 + 7 * 60_000)).toBe('3 Std. 7 Min.');
  });

  it('nennt nur Minuten in der letzten Stunde', () => {
    expect(formatDurationDe(45 * 60_000)).toBe('45 Min.');
  });

  it('wird nie negativ, wenn die Uhr des Geräts vorgeht', () => {
    expect(formatDurationDe(-5000)).toBe('0 Min.');
  });
});

describe('mostRecentFinishedEventWindow', () => {
  it('nennt das gerade zu Ende gegangene Event, wenn keines läuft', () => {
    // Der Fall, für den es die Funktion gibt: Am Dienstag schaut jemand in die App, und
    // das Ergebnis vom Wochenende ist noch nicht veröffentlicht.
    expect(mostRecentFinishedEventWindow(zoneTime('2026-09-15T12:00:00'))!.id).toBe('2026-09-11');
  });

  it('überspringt das laufende Event und nennt das davor', () => {
    expect(mostRecentFinishedEventWindow(zoneTime('2026-09-12T12:00:00'))!.id).toBe('2026-09-04');
  });

  it('nennt das eben beendete auch in der Sekunde nach Schluss', () => {
    expect(mostRecentFinishedEventWindow(zoneTime('2026-09-14T00:00:00'))!.id).toBe('2026-09-11');
  });

  it('gibt null zurück, solange noch gar kein Event zu Ende ist', () => {
    const everyThreeDays: NationsEventSchedule = {
      ...DEFAULT_NATIONS_SCHEDULE,
      repeat: { mode: 'everyNDays', anchorDate: '2026-09-11', periodDays: 3 },
    };
    expect(mostRecentFinishedEventWindow(zoneTime('2026-09-12T12:00:00'), everyThreeDays)).toBeNull();
    expect(mostRecentFinishedEventWindow(zoneTime('2026-09-10T12:00:00'), everyThreeDays)).toBeNull();
  });
});
