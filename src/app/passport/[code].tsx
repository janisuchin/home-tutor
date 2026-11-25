/** Read-only Learning Passport opened with a Progress Key (for a new tutor, school or the family). */
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Notice, Screen, Txt } from '../../ui/kit';
import { Mascot } from '../../ui/Mascot';
import { PassportView } from '../../ui/PassportView';
import { useT } from '../../i18n';
import { api, ApiError } from '../../data/api';
import type { PassportSnapshot } from '../../core/engine/passport';
import { normaliseCode } from '../../core/crypto';

export default function PublicPassport() {
  const t = useT();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [snap, setSnap] = useState<PassportSnapshot>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!code) return;
    api
      .readPassport(normaliseCode(code))
      .then((r) => setSnap(r.snapshot))
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? t('publicPassport.notFound') : e instanceof ApiError && e.code === 'offline' ? t('account.offline') : t('publicPassport.error')));
  }, [code]);
  return (
    <Screen title={t('publicPassport.title')} back="/" testID="public-passport">
      <Notice text={t('publicPassport.readOnly')} icon="👀" />
      {error ? (
        <>
          <Mascot mood="think" />
          <Notice tone="danger" text={error} />
          <Button label={t('publicPassport.tryOther')} onPress={() => router.replace('/passport/open')} />
        </>
      ) : snap ? (
        <PassportView snap={snap} />
      ) : (
        <Txt>{t('common.loading')}</Txt>
      )}
    </Screen>
  );
}
