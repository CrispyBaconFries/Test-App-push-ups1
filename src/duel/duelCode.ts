/**
 * Kurzer, mündlich/per Chat teilbarer Code für ein Freundschaftsspiel-Duell (kein
 * Matchmaking - ein Spieler erstellt ein Duell und schickt den Code an eine bestimmte
 * Person). Ohne die häufig verwechselbaren Zeichen 0/O, 1/I/L.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateDuelCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidDuelCodeFormat(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code.toUpperCase()].every((ch) => CODE_ALPHABET.includes(ch));
}

export function normalizeDuelCode(code: string): string {
  return code.trim().toUpperCase();
}
