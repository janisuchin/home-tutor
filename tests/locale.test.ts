import { describe, expect, it } from 'vitest';
import { defaultsFromLocale } from '../src/core/locale';

describe('device-locale defaults', () => {
  const ui = ['en', 'hi'];
  it('uses the region and a UI language the app has', () => {
    expect(defaultsFromLocale('hi-IN', ui)).toEqual({ country: 'IN', uiLanguage: 'hi' });
    expect(defaultsFromLocale('en-GB', ui)).toEqual({ country: 'GB', uiLanguage: 'en' });
    expect(defaultsFromLocale('en_US', ui)).toEqual({ country: 'US', uiLanguage: 'en' });
  });
  it('falls back to English for languages without a UI translation', () => {
    expect(defaultsFromLocale('de-DE', ui)).toEqual({ country: 'DE', uiLanguage: 'en' });
    expect(defaultsFromLocale('gu-IN', ui)).toEqual({ country: 'IN', uiLanguage: 'en' });
  });
  it('guesses a country from a region-less language tag', () => {
    expect(defaultsFromLocale('ja', ui).country).toBe('JP');
    expect(defaultsFromLocale('zh-Hans-CN', ui).country).toBe('CN');
  });
  it('uses Other for unknown regions and handles empty input', () => {
    expect(defaultsFromLocale('fr-CI', ui)).toEqual({ country: 'OTHER', uiLanguage: 'en' });
    expect(defaultsFromLocale('', ui)).toEqual({ country: 'OTHER', uiLanguage: 'en' });
    expect(defaultsFromLocale(undefined, ui)).toEqual({ country: 'OTHER', uiLanguage: 'en' });
  });
});
