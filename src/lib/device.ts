const TOKEN_KEY = "votearena.voter";
const PRINT_KEY = "votearena.print";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode, or storage full - the httpOnly cookie still identifies us */
  }
}

/**
 * A mirror of the httpOnly voter cookie. Some in-app browsers (Instagram,
 * LinkedIn) and iOS Lockdown mode drop the cookie between page loads, and this
 * copy is what stops those people voting twice by accident.
 */
export function getVoterToken(): string | null {
  return safeGet(TOKEN_KEY);
}

export function setVoterToken(token: string): void {
  safeSet(TOKEN_KEY, token);
}

/**
 * A coarse device signature. Deliberately built from properties that do not
 * identify a person: no canvas, no fonts, no audio. It is a tie-breaker for the
 * host's optional strict mode, not a tracking key, and two similar phones are
 * expected to collide - which is why strict mode is off by default.
 */
export function getDevicePrint(): string {
  const cached = safeGet(PRINT_KEY);
  if (cached) return cached;

  const nav = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(",") ?? "",
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(window.devicePixelRatio ?? 1),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    String(navigator.hardwareConcurrency ?? 0),
    String(nav.deviceMemory ?? 0),
    // A random component means the print is stable for this browser profile but
    // is not a cross-site identifier.
    Math.random().toString(36).slice(2, 10),
  ];

  const print = hash(parts.join("|"));
  safeSet(PRINT_KEY, print);
  return print;
}

/** FNV-1a. Not cryptographic - the server re-hashes this with its own key. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + input.length.toString(36);
}
