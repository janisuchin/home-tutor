import React from 'react';
import { Card, Screen, Section, Txt } from '../ui/kit';
import { useT } from '../i18n';

const SECTIONS = ['short', 'collect', 'notCollect', 'device', 'cloud', 'children', 'key', 'rights', 'security', 'laws', 'contact'];

export default function Privacy() {
  const t = useT();
  return (
    <Screen title={t('privacy.title')} testID="privacy">
      <Txt variant="small">{t('privacy.updated')}</Txt>
      {SECTIONS.map((s) => (
        <Section key={s} title={t(`privacy.${s}.title`)}>
          <Card>
            <Txt>{t(`privacy.${s}.body`)}</Txt>
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
