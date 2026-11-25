/**
 * Printable Learning Passport. On the web "Print / Save as PDF" uses the browser's print dialog,
 * which saves a PDF on every desktop and phone browser at no cost. Works offline, no account needed.
 */
import React, { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Screen, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { PassportView } from '../../ui/PassportView';
import { useT } from '../../i18n';
import { useCatalog, useChild, useChildEvents } from '../../data/hooks';
import { buildPassport } from '../../core/engine/passport';
import { colors } from '../../ui/theme';

export default function PrintScreen() {
  const t = useT();
  return (
    <ParentGate title={t('print.title')}>
      <Print />
    </ParentGate>
  );
}

function Print() {
  const t = useT();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId);
  const catalog = useCatalog();
  const events = useChildEvents(childId);
  const snap = useMemo(() => (child && catalog ? buildPassport(child, events, catalog) : undefined), [child, catalog, events]);
  return (
    <Screen title={t('print.title')} bg={colors.white} testID="print">
      {Platform.OS === 'web' ? (
        <View style={{ gap: 8 }} dataSet={{ noprint: '1' }}>
          <Txt variant="small">{t('print.hint')}</Txt>
          <Button icon="🖨️" label={t('print.button')} onPress={() => window.print()} testID="print-button" />
        </View>
      ) : (
        <Txt variant="small">{t('print.nativeLater')}</Txt>
      )}
      {snap ? <PassportView snap={snap} print /> : <Txt>{t('common.loading')}</Txt>}
      <Txt variant="small">{t('print.footer')}</Txt>
    </Screen>
  );
}
