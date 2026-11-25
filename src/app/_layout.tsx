import React, { useEffect, useState } from 'react';
import { I18nManager, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import { loadState, useAppState } from '../data/store';
import { startAutoSync } from '../data/sync';
import { availableLanguages, isRtl, setLanguage } from '../i18n';
import { defaultsFromLocale, deviceLocaleTag } from '../core/locale';
import { colors } from '../ui/theme';
import { Mascot } from '../ui/Mascot';
import { isUnlocked } from '../core/edition';
import { ReviewBanner } from '../ui/ReviewBanner';
import { ensureReviewFamily } from '../data/review';

let started = false;

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const settings = useAppState((s) => s.family?.settings);

  useEffect(() => {
    loadState().then(() => {
      if (isUnlocked()) ensureReviewFamily();
      setReady(true);
      if (!started) {
        started = true;
        startAutoSync();
      }
    });
  }, []);

  useEffect(() => {
    // Before a family exists (welcome screen), follow the device locale; English otherwise.
    const lang = settings?.uiLanguage ?? defaultsFromLocale(deviceLocaleTag(), availableLanguages()).uiLanguage;
    setLanguage(lang);
    const rtl = isRtl(lang);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    } else if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
  }, [settings?.uiLanguage]);

  useEffect(() => {
    // The dyslexia-friendly font is only downloaded when a family switches it on (small bundles).
    if (settings?.dyslexiaFont) {
      Font.loadAsync({
        AtkinsonHyperlegible_400Regular: require('@expo-google-fonts/atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf'),
        AtkinsonHyperlegible_700Bold: require('@expo-google-fonts/atkinson-hyperlegible/700Bold/AtkinsonHyperlegible_700Bold.ttf'),
      }).catch(() => {});
    }
  }, [settings?.dyslexiaFont]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isUnlocked() ? <ReviewBanner /> : null}
      {ready ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <Mascot size={120} mood="sleep" />
        </View>
      )}
    </SafeAreaProvider>
  );
}
