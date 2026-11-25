/**
 * Build edition. The normal edition keeps every gate. The unlocked review edition
 * (EXPO_PUBLIC_EDITION=unlocked, deployed as its own Worker with its own D1 database) opens
 * everything so the owner can check all content; see DECISIONS D-051.
 */
export type Edition = 'standard' | 'unlocked';

let edition: Edition = process.env.EXPO_PUBLIC_EDITION === 'unlocked' ? 'unlocked' : 'standard';

export function isUnlocked(): boolean {
  return edition === 'unlocked';
}
export function currentEdition(): Edition {
  return edition;
}
/** Unit tests only. */
export function setEditionForTests(e: Edition) {
  edition = e;
}
