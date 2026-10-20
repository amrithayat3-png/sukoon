import { randomBytes, randomUUID } from 'node:crypto';

// 32 symbols, no I, O, 0 or 1, so a code read aloud or typed from a screen is not ambiguous.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newId(): string {
  return randomUUID();
}

export function newCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const byte of bytes) {
    out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return out;
}
