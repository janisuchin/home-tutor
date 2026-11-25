/** Family settings: intensity, worldview approach, hours, language, accessibility, PIN, offline, data. */
import { confirmAsync } from '../../ui/confirm';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Chip, Choice, Field, Notice, Row, Screen, Section, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { downloadJson } from '../../ui/download';
import { useT, availableLanguages } from '../../i18n';
import { getState, saveFamily, useAppState, wipeDevice } from '../../data/store';
import { downloadAllForOffline } from '../../content/loader';
import { hashPin, randomBytes, toHex } from '../../core/crypto';
import { MODES, type FamilySettings, type ModeId } from '../../core/model';
import { COUNTRIES } from '../../core/countries';

export default function SettingsScreen() {
  const t = useT();
  return (
    <ParentGate title={t('settings.title')}>
      <Settings />
    </ParentGate>
  );
}

function Settings() {
  const t = useT();
  const family = useAppState((s) => s.family)!;
  const [name, setName] = useState(family.name);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [dl, setDl] = useState('');
  const s = family.settings;
  const setS = (p: Partial<FamilySettings>) => saveFamily({ ...family, settings: { ...s, ...p } });

  return (
    <Screen title={t('settings.title')} testID="settings">
      <Section title={t('settings.family')}>
        <Card>
          <Field label={t('setup.familyName')} value={name} onChangeText={setName} />
          <Button small label={t('common.save')} onPress={() => saveFamily({ ...family, name: name.trim() || family.name })} />
          <Txt variant="label">{t('settings.mode')}</Txt>
          <Choice<ModeId> value={family.mode} onChange={(mode) => saveFamily({ ...family, mode })} options={MODES.map((m) => ({ value: m, label: `${m} · ${t(`mode.${m}.title`)}` }))} />
          <Txt variant="label">{t('setup.country')}</Txt>
          <Row wrap>
            {COUNTRIES.map((c) => (
              <Chip key={c.code} testID={`country-${c.code}`} label={`${c.flag} ${c.name}`} selected={family.country === c.code} onPress={() => saveFamily({ ...family, country: c.code })} />
            ))}
          </Row>
        </Card>
      </Section>

      <Section title={t('settings.curriculum')}>
        <Card>
          <Txt variant="label">{t('settings.intensity')}</Txt>
          <Choice value={s.intensity} onChange={(intensity) => setS({ intensity })} options={(['light', 'balanced', 'full'] as const).map((v) => ({ value: v, label: t(`intensity.${v}`) }))} testID="intensity" />
          <Txt variant="label">{t('settings.hours')}</Txt>
          <Choice value={String(s.weeklyHours)} onChange={(v) => setS({ weeklyHours: Number(v) })} options={[3, 5, 10, 15, 20, 30].map((h) => ({ value: String(h), label: t('settings.hoursN', { n: h }) }))} />
          <Txt variant="label">{t('settings.worldview')}</Txt>
          <Choice value={s.worldview} onChange={(worldview) => setS({ worldview })} options={(['comparative', 'family-first', 'not-now'] as const).map((v) => ({ value: v, label: t(`worldview.${v}`) }))} testID="worldview" />
          <Txt variant="small">{t(`worldview.${s.worldview}.desc`)}</Txt>
          <Txt variant="small">{t('settings.perChild')}</Txt>
        </Card>
      </Section>

      <Section title={t('settings.access')}>
        <Card>
          <Txt variant="label">{t('settings.uiLanguage')}</Txt>
          <Choice testID="ui-language" value={s.uiLanguage} onChange={(uiLanguage) => setS({ uiLanguage })} options={availableLanguages().map((l) => ({ value: l, label: t(`lang.${l}`) }))} />
          <Txt variant="small">{t('settings.moreLanguages')}</Txt>
          <Row wrap>
            <Chip testID="dyslexia" label={t('settings.dyslexia')} selected={s.dyslexiaFont} onPress={() => setS({ dyslexiaFont: !s.dyslexiaFont })} />
            <Chip testID="large-text" label={t('settings.largeText')} selected={s.largeText} onPress={() => setS({ largeText: !s.largeText })} />
            <Chip label={t('settings.highContrast')} selected={s.highContrast} onPress={() => setS({ highContrast: !s.highContrast })} />
          </Row>
        </Card>
      </Section>

      <Section title={t('settings.pin')}>
        <Card>
          <Field label={t('settings.newPin')} value={pin} onChangeText={(x) => setPin(x.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secure />
          <Button
            small
            label={t('settings.changePin')}
            disabled={!/^\d{4,6}$/.test(pin)}
            onPress={() => {
              const salt = toHex(randomBytes(12));
              saveFamily({ ...family, pinSalt: salt, pinHash: hashPin(pin, salt) });
              setPin('');
              setMsg(t('settings.pinChanged'));
            }}
          />
          {msg ? <Notice tone="ok" text={msg} /> : null}
        </Card>
      </Section>

      <Section title={t('settings.offline')}>
        <Card>
          <Txt>{t('settings.offlineBody')}</Txt>
          <Button
            small
            icon="⬇️"
            label={t('settings.download')}
            testID="download-offline"
            onPress={async () => {
              setDl(t('settings.downloading'));
              const n = await downloadAllForOffline((a, b) => setDl(t('settings.downloadProgress', { a, b })));
              setDl(n ? t('settings.downloaded', { n }) : t('settings.alreadyOffline'));
            }}
          />
          {dl ? <Txt variant="small">{dl}</Txt> : null}
        </Card>
      </Section>

      <Section title={t('settings.data')}>
        <Card>
          <Txt>{t('settings.dataBody')}</Txt>
          <Row wrap>
            <Button small icon="📦" label={t('settings.export')} testID="export" onPress={() => downloadJson('home-tutor-export.json', { exportedAt: new Date().toISOString(), ...getState(), account: undefined })} />
            <Button small variant="ghost" icon="☁️" label={t('parent.account')} onPress={() => router.push('/account')} />
          </Row>
          <Button
            small
            variant="danger"
            icon="🗑️"
            label={t('settings.wipe')}
            testID="wipe"
            onPress={async () => {
              const ok = await confirmAsync(t('settings.wipeConfirm'));
              if (!ok) return;
              await wipeDevice();
              router.replace('/');
            }}
          />
          <Txt variant="small">{t('settings.wipeNote')}</Txt>
        </Card>
      </Section>
    </Screen>
  );
}
