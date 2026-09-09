import { nthSmallest, percentile } from '../stats';

describe('percentile', () => {
  it('returns NaN for an empty series (= "never measured")', () => {
    expect(Number.isNaN(percentile([], 10))).toBe(true);
  });

  it('returns the single value for a one-element series, whatever the percentile', () => {
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  it('returns min, median and max at p0 / p50 / p100', () => {
    const values = [30, 10, 50, 40, 20];
    expect(percentile(values, 0)).toBe(10);
    expect(percentile(values, 50)).toBe(30);
    expect(percentile(values, 100)).toBe(50);
  });

  it('interpolates linearly between neighbouring samples', () => {
    // p25 of [0,10,20,30] sits at rank 0.75 -> 7.5
    expect(percentile([0, 10, 20, 30], 25)).toBeCloseTo(7.5);
  });

  it('does not need sorted input and leaves the caller\'s array untouched', () => {
    const values = [5, 1, 4, 2, 3];
    percentile(values, 50);
    expect(values).toEqual([5, 1, 4, 2, 3]);
  });

  it('clamps out-of-range percentiles instead of returning undefined', () => {
    expect(percentile([1, 2, 3], -10)).toBe(1);
    expect(percentile([1, 2, 3], 150)).toBe(3);
  });

  it('ignores a single outlier at p10, unlike the raw minimum', () => {
    // 20 sane readings around 150 deg, one glitch frame at 7 deg.
    const values = [7, ...Array.from({ length: 20 }, () => 150)];
    expect(Math.min(...values)).toBe(7);
    expect(percentile(values, 10)).toBe(150);
  });
});

describe('nthSmallest', () => {
  it('returns NaN for an empty series', () => {
    expect(Number.isNaN(nthSmallest([], 2))).toBe(true);
  });

  it('returns the plain minimum at n = 0', () => {
    expect(nthSmallest([30, 10, 20], 0)).toBe(10);
  });

  it('skips outliers but stays at the real turning point', () => {
    // A realistic elbow sweep 170 -> 90 -> 170 with two glitch frames near zero.
    const sweep = [170, 150, 130, 110, 95, 90, 92, 110, 140, 170];
    const withGlitches = [2, 5, ...sweep];
    expect(Math.min(...withGlitches)).toBe(2);
    expect(nthSmallest(withGlitches, 2)).toBe(90);
  });

  it('never crosses the median, however large n is', () => {
    // Without the clamp, n = 5 on four samples would return the maximum.
    expect(nthSmallest([10, 20, 30, 40], 5)).toBe(20);
    expect(nthSmallest([10], 5)).toBe(10);
  });

  it('does not modify the caller\'s array', () => {
    const values = [5, 1, 4];
    nthSmallest(values, 1);
    expect(values).toEqual([5, 1, 4]);
  });
});
