/**
 * Child area: sets the age-adaptive look, tracks time on screen and shows a gentle
 * "time for off-screen" page when the parent's daily limit is reached.
 */
import React, { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';
import { Slot, router, useLocalSearchParams } from 'expo-router';
import { AgeLookContext } from '../../../ui/theme';
import { useChild } from '../../../data/hooks';
import { useAppState, trackUsage } from '../../../data/store';
import { ageFromBirth, ageLookFor } from '../../../core/model';
import { minutesLeft } from '../../../core/screen-time';
import { Button, Card, Screen, Txt } from '../../../ui/kit';
import { Mascot } from '../../../ui/Mascot';
import { useT } from '../../../i18n';
import { setSpeechLanguage } from '../../../ui/kit';

const TICK = 30;

export default function ChildLayout() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId);
  const usage = useAppState((s) => (childId ? s.usage[childId] : undefined));
  const t = useT();

  useEffect(() => {
    if (!childId) return;
    const id = setInterval(() => {
      if (RNAppState.currentState === 'active' && (typeof document === 'undefined' || document.visibilityState === 'visible'))
        trackUsage(childId, TICK);
    }, TICK * 1000);
    return () => clearInterval(id);
  }, [childId]);

  useEffect(() => {
    if (child) setSpeechLanguage(child.primaryLanguage);
  }, [child?.primaryLanguage]);

  if (!child) {
    return (
      <Screen title={t('child.notFound')}>
        <Button label={t('common.home')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  const look = ageLookFor(ageFromBirth(child.birth));
  const left = minutesLeft(child.dailyMinutes, usage);
  if (left <= 0) {
    return (
      <AgeLookContext.Provider value={look}>
        <Screen title={t('rest.title')} testID="rest">
          <Mascot size={140} mood="sleep" color={child.color} />
          <Txt variant="h2">{t('rest.body', { name: child.name })}</Txt>
          <Card>
            <Txt>🌳 {t('rest.idea1')}</Txt>
            <Txt>📚 {t('rest.idea2')}</Txt>
            <Txt>🧹 {t('rest.idea3')}</Txt>
            <Txt>🎨 {t('rest.idea4')}</Txt>
          </Card>
          <Button variant="ghost" label={t('rest.parent')} onPress={() => router.push(`/parent/child/${child.id}`)} />
          <Button variant="ghost" label={t('common.home')} onPress={() => router.replace('/')} />
        </Screen>
      </AgeLookContext.Provider>
    );
  }
  return (
    <AgeLookContext.Provider value={look}>
      <Slot />
    </AgeLookContext.Provider>
  );
}
