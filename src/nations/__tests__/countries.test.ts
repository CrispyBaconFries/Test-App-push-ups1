import { COUNTRIES, countryLabel, findCountry, flagEmoji, searchCountries } from '../countries';

describe('flagEmoji', () => {
  it('rechnet die Flagge aus dem Ländercode statt sie als Bild mitzuliefern', () => {
    expect(flagEmoji('DE')).toBe('🇩🇪');
    expect(flagEmoji('at')).toBe('🇦🇹');
  });

  it('liefert eine neutrale Flagge statt Unsinn, wenn der Code kaputt ist', () => {
    expect(flagEmoji('')).toBe('🏳️');
    expect(flagEmoji('D')).toBe('🏳️');
    expect(flagEmoji('D1')).toBe('🏳️');
  });
});

describe('COUNTRIES', () => {
  it('enthält jeden Ländercode genau einmal', () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('benutzt durchgehend zwei Großbuchstaben als Code', () => {
    expect(COUNTRIES.filter((country) => !/^[A-Z]{2}$/.test(country.code))).toEqual([]);
  });

  it('hat keine leeren Namen', () => {
    expect(COUNTRIES.filter((country) => country.name.trim() === '')).toEqual([]);
  });
});

describe('searchCountries', () => {
  it('gibt ohne Suchbegriff die vollständige Liste zurück', () => {
    expect(searchCountries('')).toHaveLength(COUNTRIES.length);
    expect(searchCountries('   ')).toHaveLength(COUNTRIES.length);
  });

  it('findet unabhängig von Groß- und Kleinschreibung', () => {
    expect(searchCountries('deutsch').map((c) => c.code)).toContain('DE');
    expect(searchCountries('DEUTSCHLAND').map((c) => c.code)).toContain('DE');
  });

  it('findet Umlaute auch ohne Umlaut getippt', () => {
    // Auf einer Handytastatur tippt kaum jemand "Ö" - "osterreich" muss reichen.
    expect(searchCountries('osterreich').map((c) => c.code)).toEqual(['AT']);
    expect(searchCountries('turkei').map((c) => c.code)).toEqual(['TR']);
  });

  it('findet auch Namen mit Akzenten ohne Akzent getippt', () => {
    expect(searchCountries('cote').map((c) => c.code)).toContain('CI');
    expect(searchCountries('reunion').map((c) => c.code)).toContain('RE');
  });

  it('stellt den passendsten Treffer nach oben, nicht den alphabetisch ersten', () => {
    // "de" steckt auch in Bangladesch, Guadeloupe, Kap Verde, Kongo (Demokratische
    // Republik), Niederlande und Schweden. Gemeint ist offensichtlich Deutschland.
    const byCode = searchCountries('de');
    expect(byCode[0]!.code).toBe('DE');
    expect(byCode.length).toBeGreaterThan(1);

    // Treffer am Wortanfang schlagen Treffer irgendwo in der Mitte: "sch" findet
    // Schweden und Schweiz, steckt aber auch in Bangladesch und Tschechien.
    const byPrefix = searchCountries('sch');
    expect(byPrefix.slice(0, 2).map((c) => c.code)).toEqual(['SE', 'CH']);
    expect(byPrefix.map((c) => c.code)).toContain('BD');
    expect(byPrefix.indexOf(byPrefix.find((c) => c.code === 'BD')!)).toBeGreaterThan(1);
  });

  it('gibt eine leere Liste zurück, wenn nichts passt', () => {
    expect(searchCountries('gibtesnicht')).toEqual([]);
  });
});

describe('findCountry / countryLabel', () => {
  it('findet unabhängig von der Schreibweise des Codes', () => {
    expect(findCountry('de')?.name).toBe('Deutschland');
    expect(findCountry('DE')?.name).toBe('Deutschland');
  });

  it('kommt mit fehlenden Werten klar', () => {
    expect(findCountry(null)).toBeNull();
    expect(findCountry(undefined)).toBeNull();
    expect(findCountry('ZZ')).toBeNull();
  });

  it('zeigt einen unbekannten Code an, statt eine leere Zeile zu rendern', () => {
    // Kann passieren, wenn eine neuere App-Version ein Land kennt, diese hier noch nicht.
    expect(countryLabel('ZZ')).toBe('ZZ');
  });
});
