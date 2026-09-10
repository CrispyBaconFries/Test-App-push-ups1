import { font, PILL_RADIUS, radius, space } from '../layout';

// `fs` per `require` statt per `import`: Das Projekt bindet die Node-Typen nicht ein
// (tsconfig `types: ["jest"]`), weil sie sich mit den React-Native-Typen beißen - siehe
// auch src/types/react-test-renderer.d.ts.
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: string) => string };

/**
 * Der Sinn dieser Tests ist nicht, Multiplikation zu prüfen.
 *
 * Er ist, die zwei Zusagen festzunageln, auf denen der ganze Umbau steht: dass die
 * Übernahme **wirkungsneutral** war (Faktor 1 = exakt die Zahlen von vorher), und dass die
 * Faktoren nicht versehentlich auf einem Demo-Wert eingecheckt bleiben. Genau das ist beim
 * Vorführen des Hebels schon einmal fast passiert.
 */

describe('layout: Faktoren', () => {
  it('steht auf neutral - die eingecheckten Faktoren dürfen nichts verändern', () => {
    // Der ganze Umbau war auf Wirkungsneutralität ausgelegt und pixelgenau dagegen
    // geprüft (siehe README, „Ein Ort für Abstände"). Ein versehentlich eingecheckter
    // Demo-Wert würde diese Prüfung im Nachhinein entwerten - und niemandem fiele es auf,
    // weil "sieht anders aus" nach einem Design-Umbau ja erwartet wird.
    for (const px of [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 48]) {
      expect(space(px)).toBe(px);
      expect(radius(px)).toBe(px);
      expect(font(px)).toBe(px);
    }
  });

  it('liefert immer ganze Zahlen', () => {
    // Krumme Werte lassen Kanten auf manchen Bildschirmdichten um ein Pixel verspringen.
    for (const px of [3, 7, 13, 17, 23]) {
      expect(Number.isInteger(space(px))).toBe(true);
      expect(Number.isInteger(radius(px))).toBe(true);
      expect(Number.isInteger(font(px))).toBe(true);
    }
  });

  it('lässt die Pillen-Rundung unangetastet', () => {
    // "So rund wie möglich" ist kein Maß. Mit einem Faktor multipliziert würde aus einer
    // Pille bei RADIUS_SCALE 0,5 eine halbe Pille - das war nie gemeint.
    expect(PILL_RADIUS).toBe(999);
  });
});

describe('layout: Übernahme', () => {
  const styleFiles = ['src/screens/HomeScreen.tsx', 'src/screens/ProfileScreen.tsx', 'src/components/RepHud.tsx'];

  it.each(styleFiles)('%s hat keine nackten Abstands- und Schriftzahlen mehr', (file) => {
    // Wächter gegen das Zurückfallen: Eine einzelne Zahl, die wieder direkt im StyleSheet
    // steht, ist genau die Stelle, die beim nächsten "alles luftiger" übersehen wird - und
    // sie fällt niemandem auf, weil 19 von 20 Werten ja mitziehen.
    const source = readFileSync(file, 'utf8');
    const naked = source.match(
      /\b(padding|paddingTop|paddingBottom|paddingHorizontal|paddingVertical|margin|marginTop|marginBottom|marginHorizontal|marginVertical|gap|rowGap|columnGap|borderRadius|fontSize|lineHeight): [1-9]\d*\b/g
    );

    expect(naked ?? []).toEqual([]);
  });
});
