import React from 'react';
import { Linking } from 'react-native';
import { Button, Card, Screen, Section, Txt } from '../ui/kit';
import { useT } from '../i18n';

const SECTIONS = ['short', 'collect', 'notCollect', 'device', 'cloud', 'children', 'key', 'live', 'rights', 'security', 'laws', 'contact'];
/** Public contact point (owner decision, round 2). Never a personal email. */
export const CONTACT_URL = 'https://github.com/janisuchin/home-tutor/issues';

export default function Privacy() {
  const t = useT();
  return (
    <Screen title={t('privacy.title')} testID="privacy">
      <Txt variant="small">{t('privacy.updated')}</Txt>
      {SECTIONS.map((s) => (
        <Section key={s} title={t(`privacy.${s}.title`)}>
          <Card>
            <Txt>{t(`privacy.${s}.body`)}</Txt>
            {s === 'contact' ? (
              <>
                <Txt variant="small">
                  {CONTACT_URL}
                </Txt>
                <Button small variant="ghost" icon="💬" testID="privacy-contact" label={t('privacy.contact.link')} onPress={() => Linking.openURL(CONTACT_URL)} />
              </>
            ) : null}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
