import React, { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Txt } from '../../../ui/kit';
import { PassportView } from '../../../ui/PassportView';
import { useT } from '../../../i18n';
import { useCatalog, useChild, useChildEvents } from '../../../data/hooks';
import { buildPassport } from '../../../core/engine/passport';

export default function ChildPassport() {
  const t = useT();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId)!;
  const catalog = useCatalog();
  const events = useChildEvents(childId);
  const snap = useMemo(() => (catalog ? buildPassport(child, events, catalog) : undefined), [catalog, child, events]);
  return (
    <Screen title={t('passport.title')} back={`/learn/${childId}`}>
      {snap ? <PassportView snap={snap} /> : <Txt>{t('common.loading')}</Txt>}
    </Screen>
  );
}
