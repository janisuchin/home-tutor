import type { Page, Locator } from '@playwright/test';
import { hashPin } from '../src/core/crypto';
import { DEFAULT_FAMILY_SETTINGS, newChild, type Child, type ModeId } from '../src/core/model';

export const PIN = '2468';

/** Visible element by test id (Expo Router keeps earlier screens mounted but hidden). */
export function tid(page: Page, id: string): Locator {
  return page.getByTestId(id).locator('visible=true').first();
}

export interface Seed {
  mode?: ModeId;
  children?: Partial<Child>[];
}

/** Seed a family straight into device storage (what the set-up wizard would save). */
export async function seed(page: Page, s: Seed = {}) {
  const salt = 'e2esalt';
  const family = {
    id: 'fam-e2e',
    name: 'E2E family',
    mode: s.mode ?? 'E',
    country: 'IN',
    pinSalt: salt,
    pinHash: hashPin(PIN, salt),
    consentAt: Date.now(),
    settings: { ...DEFAULT_FAMILY_SETTINGS },
    updatedAt: Date.now(),
  };
  const children: Record<string, Child> = {};
  for (const [i, c] of (s.children ?? [{ name: 'Asha', birth: '2018-03', interests: ['horses'] }]).entries()) {
    const id = c.id ?? `child-${i}`;
    children[id] = newChild({ id, familyId: family.id, name: c.name ?? `Kid${i}`, birth: c.birth ?? '2018-03', ...c });
  }
  const state = {
    version: 1,
    family,
    children,
    events: [],
    groups: {},
    assignments: {},
    keys: {},
    sync: { cursor: 0, dirty: [] },
    usage: {},
    attendance: {},
    polls: [],
    questions: [],
    plans: {},
  };
  await page.addInitScript((json) => {
    if (!localStorage.getItem('home-tutor:v1')) localStorage.setItem('home-tutor:v1', json);
  }, JSON.stringify(state));
}

export async function enterPin(page: Page, pin = PIN) {
  await tid(page, 'pin-gate').waitFor();
  for (const d of pin) await tid(page, `pin-${d}`).click();
  await tid(page, 'pin-✓').click();
}

export async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
