import { bossMaxHp, bossName, REP_DAMAGE_HP } from '../bossDefinitions';

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

describe('bossName', () => {
  it('labels bosses by number', () => {
    expect(bossName(1)).toBe('Boss 1');
    expect(bossName(12)).toBe('Boss 12');
  });
});
