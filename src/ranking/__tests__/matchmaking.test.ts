import { isWithinRadius, searchRadiusForWaitTime } from '../matchmaking';

describe('searchRadiusForWaitTime', () => {
  it('starts at the initial radius', () => {
    expect(searchRadiusForWaitTime(0)).toBe(100);
    expect(searchRadiusForWaitTime(4999)).toBe(100);
  });

  it('grows by steps every 5 seconds', () => {
    expect(searchRadiusForWaitTime(5_000)).toBe(150);
    expect(searchRadiusForWaitTime(9_999)).toBe(150);
    expect(searchRadiusForWaitTime(10_000)).toBe(200);
  });

  it('caps at the maximum radius', () => {
    expect(searchRadiusForWaitTime(10_000_000)).toBe(600);
  });

  it('never returns a negative radius for a negative wait time', () => {
    expect(searchRadiusForWaitTime(-500)).toBe(100);
  });
});

describe('isWithinRadius', () => {
  it('accepts an exact match', () => {
    expect(isWithinRadius(1000, 1000, 0)).toBe(true);
  });

  it('accepts the boundary (inclusive)', () => {
    expect(isWithinRadius(1000, 1100, 100)).toBe(true);
  });

  it('rejects outside the radius on either side', () => {
    expect(isWithinRadius(1000, 1200, 100)).toBe(false);
    expect(isWithinRadius(1000, 800, 100)).toBe(false);
  });
});
