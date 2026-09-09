/**
 * Länderliste für das Länderspiel.
 *
 * Gespeichert wird ausschließlich der ISO-3166-1-alpha-2-Code (`DE`, `AT`, ...). Der
 * deutsche Name steht hier, die Flagge wird aus dem Code *gerechnet* - siehe
 * `flagEmoji`. Deshalb liegen im Projekt keine 200 Flaggenbilder, die Liste bleibt
 * offline nutzbar und die App wird davon kein Byte größer.
 */

export interface Country {
  /** ISO 3166-1 alpha-2, immer zwei Großbuchstaben. */
  code: string;
  name: string;
}

/**
 * Wandelt einen Ländercode in die Flaggen-Emoji um.
 *
 * Unicode kodiert Flaggen als Paar von "Regional Indicator Symbols": `D` + `E` wird zu
 * U+1F1E9 U+1F1EA, was Systeme als 🇩🇪 darstellen. `A` liegt bei U+1F1E6, deshalb der
 * Versatz auf den Buchstabencode.
 *
 * Stellt ein Gerät Flaggen nicht dar (sehr alte Android-Versionen ohne die passende
 * Emoji-Schrift), erscheinen stattdessen die beiden Buchstaben - unschön, aber lesbar,
 * und die Auswahl funktioniert weiter. Deshalb steht der Ländername im UI immer daneben
 * und nie nur die Flagge.
 */
export function flagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🏳️';
  return String.fromCodePoint(...[...upper].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

/** Alphabetisch nach deutschem Namen sortiert - genau die Reihenfolge, in der die Liste angezeigt wird. */
export const COUNTRIES: readonly Country[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'EG', name: 'Ägypten' },
  { code: 'AX', name: 'Åland' },
  { code: 'AL', name: 'Albanien' },
  { code: 'DZ', name: 'Algerien' },
  { code: 'AS', name: 'Amerikanisch-Samoa' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarktis' },
  { code: 'AG', name: 'Antigua und Barbuda' },
  { code: 'GQ', name: 'Äquatorialguinea' },
  { code: 'AR', name: 'Argentinien' },
  { code: 'AM', name: 'Armenien' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AZ', name: 'Aserbaidschan' },
  { code: 'ET', name: 'Äthiopien' },
  { code: 'AU', name: 'Australien' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesch' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BE', name: 'Belgien' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivien' },
  { code: 'BA', name: 'Bosnien und Herzegowina' },
  { code: 'BW', name: 'Botsuana' },
  { code: 'BR', name: 'Brasilien' },
  { code: 'VG', name: 'Britische Jungferninseln' },
  { code: 'IO', name: 'Britisches Territorium im Indischen Ozean' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgarien' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CK', name: 'Cookinseln' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: 'Côte d’Ivoire' },
  { code: 'CW', name: 'Curaçao' },
  { code: 'DK', name: 'Dänemark' },
  { code: 'DE', name: 'Deutschland' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominikanische Republik' },
  { code: 'DJ', name: 'Dschibuti' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estland' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'FK', name: 'Falklandinseln' },
  { code: 'FO', name: 'Färöer' },
  { code: 'FJ', name: 'Fidschi' },
  { code: 'FI', name: 'Finnland' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'GF', name: 'Französisch-Guayana' },
  { code: 'PF', name: 'Französisch-Polynesien' },
  { code: 'GA', name: 'Gabun' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgien' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GR', name: 'Griechenland' },
  { code: 'GL', name: 'Grönland' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hongkong' },
  { code: 'IN', name: 'Indien' },
  { code: 'ID', name: 'Indonesien' },
  { code: 'IQ', name: 'Irak' },
  { code: 'IR', name: 'Iran' },
  { code: 'IE', name: 'Irland' },
  { code: 'IS', name: 'Island' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italien' },
  { code: 'JM', name: 'Jamaika' },
  { code: 'JP', name: 'Japan' },
  { code: 'YE', name: 'Jemen' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordanien' },
  { code: 'KY', name: 'Kaimaninseln' },
  { code: 'KH', name: 'Kambodscha' },
  { code: 'CM', name: 'Kamerun' },
  { code: 'CA', name: 'Kanada' },
  { code: 'CV', name: 'Kap Verde' },
  { code: 'KZ', name: 'Kasachstan' },
  { code: 'QA', name: 'Katar' },
  { code: 'KE', name: 'Kenia' },
  { code: 'KG', name: 'Kirgisistan' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'CO', name: 'Kolumbien' },
  { code: 'KM', name: 'Komoren' },
  { code: 'CD', name: 'Kongo (Demokratische Republik)' },
  { code: 'CG', name: 'Kongo (Republik)' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'HR', name: 'Kroatien' },
  { code: 'CU', name: 'Kuba' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'LA', name: 'Laos' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LV', name: 'Lettland' },
  { code: 'LB', name: 'Libanon' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libyen' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Litauen' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'MO', name: 'Macau' },
  { code: 'MG', name: 'Madagaskar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Malediven' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MA', name: 'Marokko' },
  { code: 'MH', name: 'Marshallinseln' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauretanien' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexiko' },
  { code: 'FM', name: 'Mikronesien' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolei' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MZ', name: 'Mosambik' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NC', name: 'Neukaledonien' },
  { code: 'NZ', name: 'Neuseeland' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NL', name: 'Niederlande' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'KP', name: 'Nordkorea' },
  { code: 'MK', name: 'Nordmazedonien' },
  { code: 'MP', name: 'Nördliche Marianen' },
  { code: 'NF', name: 'Norfolkinsel' },
  { code: 'NO', name: 'Norwegen' },
  { code: 'OM', name: 'Oman' },
  { code: 'AT', name: 'Österreich' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PS', name: 'Palästina' },
  { code: 'PW', name: 'Palau' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua-Neuguinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippinen' },
  { code: 'PN', name: 'Pitcairninseln' },
  { code: 'PL', name: 'Polen' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'MD', name: 'Republik Moldau' },
  { code: 'RE', name: 'Réunion' },
  { code: 'RW', name: 'Ruanda' },
  { code: 'RO', name: 'Rumänien' },
  { code: 'RU', name: 'Russland' },
  { code: 'SB', name: 'Salomonen' },
  { code: 'ZM', name: 'Sambia' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'São Tomé und Príncipe' },
  { code: 'SA', name: 'Saudi-Arabien' },
  { code: 'SE', name: 'Schweden' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbien' },
  { code: 'SC', name: 'Seychellen' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'ZW', name: 'Simbabwe' },
  { code: 'SG', name: 'Singapur' },
  { code: 'SX', name: 'Sint Maarten' },
  { code: 'SK', name: 'Slowakei' },
  { code: 'SI', name: 'Slowenien' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ES', name: 'Spanien' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'BL', name: 'St. Barthélemy' },
  { code: 'SH', name: 'St. Helena' },
  { code: 'KN', name: 'St. Kitts und Nevis' },
  { code: 'LC', name: 'St. Lucia' },
  { code: 'MF', name: 'St. Martin' },
  { code: 'PM', name: 'St. Pierre und Miquelon' },
  { code: 'VC', name: 'St. Vincent und die Grenadinen' },
  { code: 'ZA', name: 'Südafrika' },
  { code: 'SD', name: 'Sudan' },
  { code: 'GS', name: 'Südgeorgien und die Südlichen Sandwichinseln' },
  { code: 'KR', name: 'Südkorea' },
  { code: 'SS', name: 'Südsudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SY', name: 'Syrien' },
  { code: 'TJ', name: 'Tadschikistan' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TZ', name: 'Tansania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad und Tobago' },
  { code: 'TD', name: 'Tschad' },
  { code: 'CZ', name: 'Tschechien' },
  { code: 'TN', name: 'Tunesien' },
  { code: 'TR', name: 'Türkei' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TC', name: 'Turks- und Caicosinseln' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'HU', name: 'Ungarn' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Usbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatikanstadt' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'AE', name: 'Vereinigte Arabische Emirate' },
  { code: 'US', name: 'Vereinigte Staaten' },
  { code: 'GB', name: 'Vereinigtes Königreich' },
  { code: 'VI', name: 'Amerikanische Jungferninseln' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'WF', name: 'Wallis und Futuna' },
  { code: 'BY', name: 'Weißrussland' },
  { code: 'EH', name: 'Westsahara' },
  { code: 'CF', name: 'Zentralafrikanische Republik' },
  { code: 'CY', name: 'Zypern' },
];

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function findCountry(code: string | null | undefined): Country | null {
  return code ? BY_CODE.get(code.toUpperCase()) ?? null : null;
}

/** Für die Anzeige, wenn ein Code aus der Datenbank kommt, den die Liste nicht kennt. */
export function countryLabel(code: string): string {
  return findCountry(code)?.name ?? code;
}

/**
 * Sucht ohne Rücksicht auf Groß-/Kleinschreibung, Umlaute und Akzente: "osterreich"
 * findet Österreich, "cote" findet Côte d'Ivoire.
 *
 * Die Treffer sind nach Nähe sortiert, nicht alphabetisch. Ohne das steht bei der
 * Eingabe "de" Deutschland zwischen Bangladesch und Guadeloupe - beides enthält die
 * Buchstabenfolge, aber gemeint ist offensichtlich Deutschland. Reihenfolge:
 *   1. der Ländercode stimmt genau ("de" -> Deutschland)
 *   2. der Name beginnt so ("nor" -> Norwegen vor Kamerun)
 *   3. der Name enthält es irgendwo
 * Innerhalb einer Gruppe bleibt die alphabetische Reihenfolge der Liste erhalten.
 */
export function searchCountries(term: string): Country[] {
  const needle = normalizeForSearch(term);
  if (!needle) return [...COUNTRIES];

  const ranked: { country: Country; rank: number }[] = [];
  for (const country of COUNTRIES) {
    const name = normalizeForSearch(country.name);
    if (country.code.toLowerCase() === needle) ranked.push({ country, rank: 0 });
    else if (name.startsWith(needle)) ranked.push({ country, rank: 1 });
    else if (name.includes(needle)) ranked.push({ country, rank: 2 });
  }
  // Stabile Sortierung: Array.prototype.sort ist seit ES2019 garantiert stabil, die
  // alphabetische Ausgangsreihenfolge bleibt innerhalb jeder Gruppe also erhalten.
  return ranked.sort((a, b) => a.rank - b.rank).map((entry) => entry.country);
}

function normalizeForSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    // Zerlegt akzentuierte Zeichen (é -> e + Akzent) und wirft die Akzente weg. Hermes
    // unterstützt String.prototype.normalize, der Aufruf ist hier also sicher.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
