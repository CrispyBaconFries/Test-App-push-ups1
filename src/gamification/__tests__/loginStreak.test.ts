import { coinsForLoginStreak } from '../loginStreak';

describe('coinsForLoginStreak', () => {
  it('ramps up by 5 coins per day for the first 5 days', () => {
    expect(coinsForLoginStreak(1)).toBe(10);
    expect(coinsForLoginStreak(2)).toBe(15);
    expect(coinsForLoginStreak(3)).toBe(20);
    expect(coinsForLoginStreak(4)).toBe(25);
    expect(coinsForLoginStreak(5)).toBe(30);
  });

  it('caps at 30 coins beyond day 5', () => {
    expect(coinsForLoginStreak(6)).toBe(30);
    expect(coinsForLoginStreak(100)).toBe(30);
  });

  it('treats day 0 or negative like day 1', () => {
    expect(coinsForLoginStreak(0)).toBe(10);
    expect(coinsForLoginStreak(-5)).toBe(10);
  });
});
