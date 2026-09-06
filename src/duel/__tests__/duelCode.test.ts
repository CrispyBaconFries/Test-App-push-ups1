import { generateDuelCode, isValidDuelCodeFormat, normalizeDuelCode } from '../duelCode';

describe('generateDuelCode', () => {
  it('generates a 6-character code', () => {
    expect(generateDuelCode()).toHaveLength(6);
  });

  it('never contains ambiguous characters (0/O, 1/I/L)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateDuelCode();
      expect(code).not.toMatch(/[01ILO]/);
    }
  });

  it('is deterministic for a fixed random source', () => {
    const fixedRandom = () => 0;
    expect(generateDuelCode(fixedRandom)).toBe(generateDuelCode(fixedRandom));
  });
});

describe('isValidDuelCodeFormat', () => {
  it('accepts a well-formed code', () => {
    expect(isValidDuelCodeFormat(generateDuelCode())).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidDuelCodeFormat('ABC')).toBe(false);
  });

  it('rejects ambiguous/invalid characters', () => {
    expect(isValidDuelCodeFormat('ABC01I')).toBe(false);
  });
});

describe('normalizeDuelCode', () => {
  it('trims whitespace and upper-cases', () => {
    expect(normalizeDuelCode('  abc234 ')).toBe('ABC234');
  });
});
