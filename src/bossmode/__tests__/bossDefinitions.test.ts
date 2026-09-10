import { bossMaxHp, bossName, REP_DAMAGE_HP, BOSS_LOOKS, bossLook } from '../bossDefinitions';

describe('bossMaxHp', () => {
  it('matches the exact specified HP for bosses 1-4', () => {
    expect(bossMaxHp(1)).toBe(100);
    expect(bossMaxHp(2)).toBe(120);
    expect(bossMaxHp(3)).toBe(150);
    expect(bossMaxHp(4)).toBe(180);
  });

  it('grows boss 5 onward by alternating 2/3 reps-to-kill (30/45 HP)', () => {
    expect(bossMaxHp(5)).toBe(210); // 12 + 2 = 14 reps
    expect(bossMaxHp(6)).toBe(255); // 14 + 3 = 17 reps
    expect(bossMaxHp(7)).toBe(285); // 17 + 2 = 19 reps
    expect(bossMaxHp(8)).toBe(330); // 19 + 3 = 22 reps
  });

  it('is always a whole number of reps worth of HP from boss 5 onward', () => {
    for (let n = 5; n <= 30; n++) {
      expect(bossMaxHp(n) % REP_DAMAGE_HP).toBe(0);
    }
  });

  it('strictly increases from one boss to the next', () => {
    let previous = 0;
    for (let n = 1; n <= 50; n++) {
      const hp = bossMaxHp(n);
      expect(hp).toBeGreaterThan(previous);
      previous = hp;
    }
  });

  it('rejects invalid boss numbers', () => {
    expect(() => bossMaxHp(0)).toThrow();
    expect(() => bossMaxHp(-1)).toThrow();
    expect(() => bossMaxHp(1.5)).toThrow();
  });
});

describe('bossName / bossLook', () => {
  it('gibt jedem Boss einen eigenen Namen, mit Nummer davor', () => {
    // Die Nummer bleibt, weil sie den Fortschritt auch jenseits von Boss 10 zeigt.
    expect(bossName(1)).toBe('1. Der Sandsack');
    expect(bossName(10)).toBe('10. Sternenfresser');
  });

  it('läuft über Boss 10 hinaus von vorn durch, statt abzubrechen', () => {
    // Die HP steigen weiter, der Kampf wird also trotzdem härter - nur das Gesicht
    // wiederholt sich, bis es mehr Motive gibt.
    expect(bossLook(11)).toEqual(bossLook(1));
    expect(bossName(12)).toBe('12. Die Ratte');
  });

  it('hat zehn unterschiedliche Platzhalter', () => {
    // Ein Totenkopf für alle war das Problem: Man besiegt Boss 3 und steht vor demselben
    // Bild wie bei Boss 1 - der Fortschritt war nicht zu sehen.
    expect(BOSS_LOOKS).toHaveLength(10);
    expect(new Set(BOSS_LOOKS.map((b) => b.icon)).size).toBe(10);
    expect(new Set(BOSS_LOOKS.map((b) => b.name)).size).toBe(10);
    expect(new Set(BOSS_LOOKS.map((b) => b.tint)).size).toBe(10);
  });

  it('benutzt nur Symbole, die es im Icon-Paket wirklich gibt', () => {
    // Ein Tippfehler ergäbe ein leeres Kästchen - und zwar erst auf dem Gerät, wo es
    // niemand mehr einem Namen zuordnen kann.
    const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
    for (const boss of BOSS_LOOKS) {
      expect(Object.prototype.hasOwnProperty.call(glyphs, boss.icon)).toBe(true);
    }
  });

  it('weist ungültige Boss-Nummern zurück', () => {
    expect(() => bossLook(0)).toThrow();
    expect(() => bossLook(1.5)).toThrow();
  });
});
