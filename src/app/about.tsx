import React from 'react';
import { View } from 'react-native';
import { Card, Screen, Section, Txt } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { useT } from '../i18n';
import { space } from '../ui/theme';

export default function About() {
  const t = useT();
  return (
    <Screen title={t('about.title')} testID="about">
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Mascot size={120} mood="cheer" />
        <Txt center>{t('about.mascot')}</Txt>
      </View>
      <Card>
        <Txt>{t('about.body1')}</Txt>
        <Txt>{t('about.body2')}</Txt>
      </Card>
      <Section title={t('about.safety.title')}>
        <Card>
          <Txt>🟢 {t('safety.green.long')}</Txt>
          <Txt>🟠 {t('safety.amber.long')}</Txt>
          <Txt>🔴 {t('safety.red.long')}</Txt>
          <Txt variant="small">{t('about.safety.body')}</Txt>
        </Card>
      </Section>
      <Section title={t('about.medical.title')}>
        <Card>
          <Txt>{t('about.medical.body')}</Txt>
        </Card>
      </Section>
      <Section title={t('about.credits.title')}>
        <Card>
          <Txt>{t('about.credits.body')}</Txt>
        </Card>
      </Section>
      <Txt variant="small">{t('about.rights')}</Txt>
    </Screen>
  );
}
