import React, { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Field, Screen, Txt } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { useT } from '../../i18n';
import { normaliseCode } from '../../core/crypto';

export default function OpenKey() {
  const t = useT();
  const [code, setCode] = useState('');
  const clean = normaliseCode(code);
  return (
    <Screen title={t('openKey.title')} testID="open-key">
      <Mascot mood="happy" />
      <Txt>{t('openKey.intro')}</Txt>
      <Card>
        <Field testID="key-input" label={t('keys.code')} value={code} onChangeText={setCode} placeholder="ABCD-EFGH-JKMN" />
        <Button testID="open-key-submit" label={t('openKey.open')} disabled={clean.length < 8} onPress={() => router.push(`/passport/${clean}`)} />
      </Card>
    </Screen>
  );
}
