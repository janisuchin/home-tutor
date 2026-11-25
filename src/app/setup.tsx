/**
 * Family set-up: name, country, mode (A-H), parent PIN and consent. No account needed:
 * everything stays on this device until the family chooses to sign in.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Choice, Field, Notice, Row, Screen, Txt, Chip } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { colors, space } from '../ui/theme';
import { useT } from '../i18n';
import { saveFamily, unlockParent, useAppState } from '../data/store';
import { DEFAULT_FAMILY_SETTINGS, MODES, type Family, type ModeId } from '../core/model';
import { hashPin, randomId, toHex, randomBytes } from '../core/crypto';
import { COUNTRIES } from '../core/countries';

const MODE_ICONS: Record<ModeId, string> = { A: '🧒', B: '👧', C: '👦', D: '👫', E: '👨‍👩‍👧‍👦', F: '🧑‍🏫', G: '🏫', H: '📽️' };

export default function Setup() {
  const t = useT();
  const existing = useAppState((s) => s.family);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? '');
  const [country, setCountry] = useState(existing?.country ?? 'IN');
  const [mode, setMode] = useState<ModeId>(existing?.mode ?? 'A');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  const finish = () => {
    if (!/^\d{4,6}$/.test(pin)) return setError(t('setup.pin.invalid'));
    if (pin !== pin2) return setError(t('setup.pin.mismatch'));
    if (!consent) return setError(t('setup.consent.required'));
    const salt = toHex(randomBytes(12));
    const fam: Family = {
      id: existing?.id ?? randomId(),
      name: name.trim() || t('setup.defaultName'),
      country,
      mode,
      pinSalt: salt,
      pinHash: hashPin(pin, salt),
      consentAt: Date.now(),
      settings: existing?.settings ?? { ...DEFAULT_FAMILY_SETTINGS },
      updatedAt: Date.now(),
    };
    saveFamily(fam);
    unlockParent();
    router.replace('/parent/child-edit?first=1');
  };

  return (
    <Screen title={t('setup.title')} testID="setup">
      <Row>
        <Mascot size={72} mood={step === 3 ? 'cheer' : 'think'} />
        <Txt style={{ flex: 1 }}>{t(`setup.step${step}.intro`)}</Txt>
      </Row>
      <Txt variant="small">{t('setup.stepOf', { n: step + 1, total: 4 })}</Txt>

      {step === 0 && (
        <Card>
          <Field testID="family-name" label={t('setup.familyName')} value={name} onChangeText={setName} placeholder={t('setup.familyName.placeholder')} />
          <Txt variant="label">{t('setup.country')}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {COUNTRIES.map((c) => (
              <Chip key={c.code} label={`${c.flag} ${c.name}`} selected={country === c.code} onPress={() => setCountry(c.code)} />
            ))}
          </View>
          <Button testID="next" label={t('common.next')} onPress={() => setStep(1)} />
        </Card>
      )}

      {step === 1 && (
        <View style={{ gap: space.md }}>
          {MODES.map((m) => (
            <Card
              key={m}
              testID={`mode-${m}`}
              onPress={() => setMode(m)}
              tint={mode === m ? colors.primarySoft : undefined}
              accessibilityLabel={`${t(`mode.${m}.title`)}. ${t(`mode.${m}.body`)}`}
            >
              <Row>
                <Txt variant="h2">{MODE_ICONS[m]}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt variant="h3">
                    {mode === m ? '✓ ' : ''}
                    {t('mode.label', { m })} · {t(`mode.${m}.title`)}
                  </Txt>
                  <Txt variant="small">{t(`mode.${m}.body`)}</Txt>
                </View>
              </Row>
            </Card>
          ))}
          {(mode === 'B' || mode === 'C') && <Notice text={t('setup.mode.healthNote')} />}
          <Row>
            <Button variant="ghost" label={t('common.back')} onPress={() => setStep(0)} />
            <Button testID="next" label={t('common.next')} onPress={() => setStep(2)} style={{ flex: 1 }} />
          </Row>
        </View>
      )}

      {step === 2 && (
        <Card>
          <Txt>{t('setup.pin.why')}</Txt>
          <Field testID="pin" label={t('setup.pin')} value={pin} onChangeText={(s) => setPin(s.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secure />
          <Field testID="pin2" label={t('setup.pin.again')} value={pin2} onChangeText={(s) => setPin2(s.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secure />
          {error ? <Notice tone="danger" text={error} /> : null}
          <Row>
            <Button variant="ghost" label={t('common.back')} onPress={() => setStep(1)} />
            <Button
              testID="next"
              label={t('common.next')}
              style={{ flex: 1 }}
              onPress={() => {
                if (!/^\d{4,6}$/.test(pin)) return setError(t('setup.pin.invalid'));
                if (pin !== pin2) return setError(t('setup.pin.mismatch'));
                setError('');
                setStep(3);
              }}
            />
          </Row>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Txt variant="h3">{t('setup.consent.title')}</Txt>
          <Txt>• {t('setup.consent.p1')}</Txt>
          <Txt>• {t('setup.consent.p2')}</Txt>
          <Txt>• {t('setup.consent.p3')}</Txt>
          <Txt>• {t('setup.consent.p4')}</Txt>
          <Button small variant="ghost" label={t('nav.privacy')} onPress={() => router.push('/privacy')} />
          <Chip testID="consent" label={t('setup.consent.check')} selected={consent} onPress={() => setConsent(!consent)} />
          {error ? <Notice tone="danger" text={error} /> : null}
          <Row>
            <Button variant="ghost" label={t('common.back')} onPress={() => setStep(2)} />
            <Button testID="finish-setup" label={t('setup.finish')} icon="🌱" style={{ flex: 1 }} onPress={finish} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
