/**
 * Device-locale defaults (owner decision, round 2): the country and UI language at set-up follow the
 * device locale, falling back to English. The family can change both at set-up and in settings.
 * Pure functions, shared by the app and the unit tests.
 */
import { COUNTRIES } from './countries';

const KNOWN_COUNTRIES = new Set(COUNTRIES.map((c) => c.code).filter((c) => c !== 'OTHER'));

/** When the locale has no region (for example plain "hi" or "ja"), the most likely country. */
const LANGUAGE_COUNTRY: Record<string, string> = {
  hi: 'IN', gu: 'IN', mr: 'IN', ta: 'IN', te: 'IN', kn: 'IN', ml: 'IN', pa: 'IN',
  bn: 'BD', ur: 'PK', ne: 'NP', si: 'LK', ja: 'JP', zh: 'CN', ko: 'KR', de: 'DE', fr: 'FR',
  es: 'ES', it: 'IT', nl: 'NL', ru: 'RU', tr: 'TR', pt: 'BR', id: 'ID', fil: 'PH', ar: 'AE', sw: 'KE',
};

export interface LocaleDefaults {
  country: string;
  uiLanguage: string;
}

/**
 * Turns a BCP-47 tag such as "hi-IN", "en_GB" or "pt-BR" into a country from the picker list and a
 * UI language the app has. Unknown regions become "OTHER"; unknown languages become English.
 */
export function defaultsFromLocale(tag: string | undefined | null, uiLanguages: string[]): LocaleDefaults {
  const parts = (tag ?? '').replace(/_/g, '-').split('-').filter(Boolean);
  const lang = (parts[0] ?? 'en').toLowerCase();
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
  const uiLanguage = uiLanguages.includes(lang) ? lang : 'en';
  let country = region && KNOWN_COUNTRIES.has(region) ? region : '';
  if (!country && !region) country = LANGUAGE_COUNTRY[lang] ?? '';
  return { country: country || 'OTHER', uiLanguage };
}

/** The device's preferred locale tag (browser language on the web, Intl elsewhere). */
export function deviceLocaleTag(): string {
  try {
    const nav = (globalThis as any).navigator;
    const fromNav = nav?.languages?.[0] ?? nav?.language;
    if (typeof fromNav === 'string' && fromNav) return fromNav;
  } catch {
    // ignore
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    return 'en';
  }
}
