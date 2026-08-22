import crypto from "node:crypto";

/**
 * Join-code alphabet. 0/O/1/I/L are all excluded rather than folded together:
 * if a confusable character can never appear in a code, a misread never has to
 * be guessed at. U is dropped so a random code cannot spell anything awkward.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 6;

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("base64url")}`;
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function newJoinCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Uppercase and strip the spaces and dashes people add when reading a code aloud. */
export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isValidJoinCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((ch) => CODE_ALPHABET.includes(ch));
}

/**
 * Case-, accent- and punctuation-folded label. Two write-ins that fold to the
 * same string become one option, so "Ada L.", "ada l" and "ADA  L" all merge.
 */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function nowIso(): string {
  return new Date().toISOString();
}
