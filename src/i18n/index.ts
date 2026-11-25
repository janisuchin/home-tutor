/**
 * Tiny i18n layer: every UI string lives in src/i18n/locales/<lang>.json.
 * English first; Hindi and Gujarati come in later rounds. RTL-ready: isRtl() drives layout direction.
 */
import { useSyncExternalStore } from 'react';
import en from './locales/en.json';

type Dict = Record<string, string>;
const locales: Record<string, Dict> = { en: en as Dict };
const RTL = ['ar', 'he', 'fa', 'ur'];

let current = 'en';
const listeners = new Set<() => void>();

export function setLanguage(lang: string) {
  current = locales[lang] ? lang : 'en';
  for (const l of listeners) l();
}
export function getLanguage() {
  return current;
}
export function isRtl(lang = current) {
  return RTL.includes(lang.split('-')[0]);
}
export function availableLanguages() {
  return Object.keys(locales);
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
