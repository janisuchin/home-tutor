/**
 * Tiny i18n layer: every UI string lives in src/i18n/locales/<lang>.json.
 * English is bundled; other languages are separate chunks loaded on first use, so families who
 * use English never download them. RTL-ready: isRtl() drives layout direction.
 * Hindi (round 2) and Gujarati (round 3) are lazy chunks.
 */
import { useSyncExternalStore } from 'react';
import en from './locales/en.json';

type Dict = Record<string, string>;
const locales: Record<string, Dict> = { en: en as Dict };
/** Lazy loaders for every non-English locale (each becomes its own web chunk). */
const loaders: Record<string, () => Promise<Dict>> = {
  hi: () => import('./locales/hi.json').then((m: any) => (m.default ?? m) as Dict),
  gu: () => import('./locales/gu.json').then((m: any) => (m.default ?? m) as Dict),
};
const RTL = ['ar', 'he', 'fa', 'ur'];

let current = 'en';
let wanted = 'en';
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

/** Switches the UI language; a language that is not loaded yet is fetched first (English meanwhile). */
export function setLanguage(lang: string): Promise<void> {
  wanted = lang;
  if (locales[lang]) {
    current = lang;
    emit();
    return Promise.resolve();
  }
  const load = loaders[lang];
  if (!load) {
    current = 'en';
    emit();
    return Promise.resolve();
  }
  return load()
    .then((dict) => {
      locales[lang] = dict;
      if (wanted === lang) {
        current = lang;
        emit();
      }
    })
    .catch(() => {
      // Offline before the chunk was cached: stay in English until it can load.
    });
}
export function getLanguage() {
  return current;
}
export function isRtl(lang = current) {
  return RTL.includes(lang.split('-')[0]);
}
export function availableLanguages() {
  return ['en', ...Object.keys(loaders)];
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const s = locales[current]?.[key] ?? locales.en[key] ?? key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/** Re-renders when the language changes. */
export function useT() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  return t;
}
