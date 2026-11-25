/**
 * Progress Key: a code, link and QR that opens a read-only view of the child's Learning Passport.
 * The parent can set an expiry and revoke it at any time. Needs a signed-in account (the passport
 * snapshot is served from the cloud); the printable passport works without one.
 */
import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, Choice, Notice, Row, Screen, Section, Txt } from '../../../ui/kit';
import { ParentGate } from '../../../ui/ParentGate';
import { colors, space } from '../../../ui/theme';
import { useT } from '../../../i18n';
import { saveKey, useAppState } from '../../../data/store';
import { useChild } from '../../../data/hooks';
import { api, publicBase } from '../../../data/api';
import { syncNow } from '../../../data/sync';
import { formatCode, randomCode, randomId } from '../../../core/crypto';

export default function KeysScreen() {
  const t = useT();
  return (
    <ParentGate title={t('keys.title')}>
      <Keys />
    </ParentGate>
  );
}

const EXPIRY = { never: 0, week: 7, month: 30, year: 365 } as const;

function Keys() {
  const t = useT();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useChild(childId);
  const account = useAppState((s) => s.account);
  const allKeys = useAppState((s) => s.keys);
  const [expiry, setExpiry] = useState<keyof typeof EXPIRY>('month');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!child) return <Screen title={t('common.loading')}>{null}</Screen>;
  const keys = Object.values(allKeys).filter((k) => k.childId === child.id).sort((a, b) => b.createdAt - a.createdAt);

  const create = async () => {
    if (!account) return;
    setBusy(true);
    setError('');
    try {
      await syncNow(); // the child must exist in the cloud first
      const code = randomCode(12);
      const days = EXPIRY[expiry];
      const expiresAt = days ? Date.now() + days * 86400_000 : undefined;
      const res = await api.createKey(account.token, child.id, code, expiresAt);
      saveKey({ id: res.id ?? randomId(), childId: child.id, code, createdAt: Date.now(), expiresAt });
      await syncNow(); // publishes the passport snapshot
    } catch (e) {
      setError(t('keys.error', { reason: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('keys.titleFor', { name: child.name })} testID="keys">
      <Txt>{t('keys.intro')}</Txt>
      {!account ? (
        <Card>
          <Notice text={t('keys.needAccount')} icon="☁️" />
          <Button label={t('parent.signIn')} onPress={() => router.push('/account')} />
          <Button variant="ghost" icon="🖨️" label={t('parent.print')} onPress={() => router.push(`/print/${child.id}`)} />
        </Card>
      ) : (
        <Card>
          <Txt variant="label">{t('keys.expiry')}</Txt>
          <Choice value={expiry} onChange={setExpiry} options={(Object.keys(EXPIRY) as (keyof typeof EXPIRY)[]).map((k) => ({ value: k, label: t(`keys.expiry.${k}`) }))} />
          <Button testID="create-key" icon="🔑" label={busy ? t('common.loading') : t('keys.create')} disabled={busy} onPress={create} />
          {error ? <Notice tone="danger" text={error} /> : null}
        </Card>
      )}

      {keys.map((k) => {
        const expired = k.expiresAt && k.expiresAt < Date.now();
        const active = !k.revoked && !expired;
        const link = `${publicBase()}/passport/${k.code}`;
        return (
          <Section key={k.id} title={formatCode(k.code)}>
            <Card tint={active ? colors.tealSoft : colors.surfaceAlt} testID="key-card">
              <Txt bold>{active ? t('keys.active') : k.revoked ? t('keys.revoked') : t('keys.expired')}</Txt>
              <Txt variant="small">
                {t('keys.created', { date: new Date(k.createdAt).toLocaleDateString() })}
                {k.expiresAt ? ` · ${t('keys.expires', { date: new Date(k.expiresAt).toLocaleDateString() })}` : ` · ${t('keys.expiry.never')}`}
              </Txt>
              {active ? (
                <Row wrap style={{ alignItems: 'flex-start', gap: space.lg }}>
                  <View style={{ backgroundColor: colors.white, padding: space.sm, borderRadius: 12 }} accessible accessibilityLabel={t('keys.qr')}>
                    <QRCode value={link} size={160} />
                  </View>
                  <View style={{ flex: 1, minWidth: 200, gap: space.sm }}>
                    <Txt variant="label">{t('keys.code')}</Txt>
                    <Txt variant="h2" testID="key-code">
                      {formatCode(k.code)}
                    </Txt>
                    <Txt variant="label">{t('keys.link')}</Txt>
                    <Txt variant="small" style={{ flexWrap: 'wrap' }}>
                      {link}
                    </Txt>
                    {Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard ? (
                      <Button small variant="ghost" label={t('keys.copy')} onPress={() => (navigator as any).clipboard.writeText(link)} />
                    ) : null}
                    <Button
                      small
                      variant="danger"
                      testID="revoke-key"
                      label={t('keys.revoke')}
                      onPress={async () => {
                        if (!account) return;
                        try {
                          await api.revokeKey(account.token, k.id);
                          saveKey({ ...k, revoked: true });
                        } catch (e) {
                          setError(t('keys.error', { reason: (e as Error).message }));
                        }
                      }}
                    />
                  </View>
                </Row>
              ) : null}
            </Card>
          </Section>
        );
      })}
    </Screen>
  );
}
