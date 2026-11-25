/**
 * Parent / tutor account. Email + password (hashed slowly in the Worker) and a one-time recovery
 * key shown at sign-up. No email is ever sent, so sign-in never depends on an email service.
 * Children never have accounts: the parent account owns the child profiles.
 */
import { confirmAsync } from '../ui/confirm';
import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Choice, Field, Notice, Row, Screen, Txt, Chip } from '../ui/kit';
import { ParentGate } from '../ui/ParentGate';
import { useT } from '../i18n';
import { getState, saveFamily, setAccount, unlockParent, useAppState, wipeDevice } from '../data/store';
import { api, ApiError } from '../data/api';
import { syncNow } from '../data/sync';
import { clearTutoring, syncTutoring } from '../data/tutoring';
import { addPasskey, passkeysSupported, signInWithPasskey } from '../data/passkeys';
import { formatCode, hashPin, randomBytes, toHex } from '../core/crypto';
import { downloadJson } from '../ui/download';

type Mode = 'signup' | 'login' | 'recover';

export default function AccountScreen() {
  const t = useT();
  // A family that already exists on this device must unlock with the PIN first. The gate is
  // optional when there is no family yet (signing in on a new device).
  return (
    <ParentGate title={t('account.title')} optional>
      <Account />
    </ParentGate>
  );
}

function errorText(t: (k: string, v?: any) => string, e: unknown) {
  if (e instanceof ApiError) return t(`account.err.${e.code}`) === `account.err.${e.code}` ? t('account.err.generic', { code: e.code }) : t(`account.err.${e.code}`);
  return t('account.err.generic', { code: String(e) });
}

function Account() {
  const t = useT();
  const account = useAppState((s) => s.account);
  const sync = useAppState((s) => s.sync);
  const family = useAppState((s) => s.family);
  const [mode, setMode] = useState<Mode>(family ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [consent, setConsent] = useState(false);
  const [shownKey, setShownKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newPin, setNewPin] = useState('');

  const afterAuth = async (token: string, accountId: string) => {
    setAccount({ token, accountId, signedInAt: Date.now() });
    unlockParent();
    const r = await syncNow();
    void syncTutoring();
    setMsg(r === 'ok' ? t('account.syncedNow') : t('account.syncLater'));
  };

  const submit = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('account.err.email'));
    if (password.length < 10) return setError(t('account.err.password'));
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (!consent) {
          setBusy(false);
          return setError(t('setup.consent.required'));
        }
        const r = await api.signup(email, password, true);
        setShownKey(r.recoveryKey ?? '');
        await afterAuth(r.token, r.accountId);
      } else if (mode === 'login') {
        const r = await api.login(email, password);
        await afterAuth(r.token, r.accountId);
      } else {
        const r = await api.recover(email, recoveryKey.trim(), password);
        setShownKey(r.recoveryKey ?? '');
        await afterAuth(r.token, r.accountId);
      }
      setPassword('');
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  if (account) {
    return (
      <Screen title={t('account.title')} testID="account-signed-in">
        {shownKey ? (
          <Card>
            <Notice tone="warn" text={t('account.recoveryShow')} />
            <Txt variant="h2" testID="recovery-key">
              {formatCode(shownKey)}
            </Txt>
            <Button small variant="ghost" label={t('account.recoverySaved')} onPress={() => setShownKey('')} />
          </Card>
        ) : null}
        <Card>
          <Txt variant="h3">☁️ {t('account.signedIn')}</Txt>
          <Txt variant="small">
            {t('account.lastSync', { when: sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString() : t('common.never') })} · {t('account.pending', { n: sync.dirty.length })}
          </Txt>
          {sync.lastError ? <Notice tone="warn" text={sync.lastError === 'offline' ? t('account.offline') : sync.lastError} /> : null}
          {msg ? <Notice tone="ok" text={msg} /> : null}
          <Row wrap>
            <Button small icon="🔄" label={t('account.syncNow')} testID="sync-now" onPress={async () => setMsg((await syncNow()) === 'ok' ? t('account.syncedNow') : t('account.syncLater'))} />
            <Button
              small
              variant="ghost"
              icon="📦"
              label={t('account.exportCloud')}
              onPress={async () => {
                try {
                  downloadJson('home-tutor-cloud-export.json', await api.exportAll(account.token));
                } catch (e) {
                  setError(errorText(t, e));
                }
              }}
            />
            <Button
              small
              variant="ghost"
              label={t('account.signOut')}
              onPress={async () => {
                await api.logout(account.token).catch(() => {});
                setAccount(undefined);
                await clearTutoring();
              }}
            />
          </Row>
        </Card>
        {passkeysSupported() ? <PasskeysCard token={account.token} /> : null}
        <Button variant="ghost" icon="🧑‍🏫" testID="account-tutoring" label={t('tutoring.title')} onPress={() => router.push('/tutoring')} />
        {family ? (
          <Card>
            <Txt variant="label">{t('account.resetPin')}</Txt>
            <Field label={t('settings.newPin')} value={newPin} onChangeText={(x) => setNewPin(x.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secure />
            <Button
              small
              disabled={!/^\d{4,6}$/.test(newPin)}
              label={t('settings.changePin')}
              onPress={() => {
                const salt = toHex(randomBytes(12));
                saveFamily({ ...family, pinSalt: salt, pinHash: hashPin(newPin, salt) });
                setNewPin('');
                setMsg(t('settings.pinChanged'));
              }}
            />
          </Card>
        ) : (
          <Button label={t('common.home')} onPress={() => router.replace('/')} />
        )}
        <Card>
          <Txt variant="h3">🗑️ {t('account.delete')}</Txt>
          <Txt variant="small">{t('account.deleteBody')}</Txt>
          {error ? <Notice tone="danger" text={error} /> : null}
          <Button
            small
            variant="danger"
            label={t('account.deleteButton')}
            testID="delete-account"
            onPress={async () => {
              const ok = await confirmAsync(t('account.deleteConfirm'));
              if (!ok) return;
              try {
                await api.deleteAccount(account.token);
                await clearTutoring();
                await wipeDevice();
                router.replace('/');
              } catch (e) {
                setError(errorText(t, e));
              }
            }}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('account.title')} testID="account">
      <Txt>{t('account.intro')}</Txt>
      <Choice<Mode>
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError('');
        }}
        testID="account-mode"
        options={[
          { value: 'signup', label: t('account.signup') },
          { value: 'login', label: t('account.login') },
          { value: 'recover', label: t('account.recover') },
        ]}
      />
      <Card>
        <Field testID="email" label={t('account.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
        {mode === 'recover' ? <Field testID="recovery" label={t('account.recoveryKey')} value={recoveryKey} onChangeText={setRecoveryKey} /> : null}
        <Field
          testID="password"
          label={mode === 'recover' ? t('account.newPassword') : t('account.password')}
          value={password}
          onChangeText={setPassword}
          secure
          hint={t('account.passwordHint')}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {mode === 'signup' ? (
          <>
            <Chip testID="account-consent" label={t('account.consent')} selected={consent} onPress={() => setConsent(!consent)} />
            {!family ? <Notice text={t('account.noFamilyYet')} /> : null}
          </>
        ) : null}
        {error ? <Notice tone="danger" text={error} /> : null}
        <Button testID="account-submit" label={busy ? t('common.loading') : t(`account.${mode}`)} disabled={busy} onPress={submit} />
        {mode === 'login' && passkeysSupported() ? (
          <Button
            variant="ghost"
            icon="🔑"
            testID="passkey-login"
            label={t('passkey.signIn')}
            disabled={busy}
            onPress={async () => {
              setError('');
              setBusy(true);
              try {
                const r = await signInWithPasskey();
                await afterAuth(r.token, r.accountId);
              } catch (e) {
                setError(e instanceof ApiError ? errorText(t, e) : t('passkey.cancelled'));
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </Card>
      <Txt variant="small">{t('account.privacyNote')}</Txt>
      <Button small variant="ghost" label={t('nav.privacy')} onPress={() => router.push('/privacy')} />
    </Screen>
  );
}

function PasskeysCard({ token }: { token: string }) {
  const t = useT();
  const [list, setList] = useState<{ id: string; label: string; createdAt: number; lastUsedAt?: number }[]>([]);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState<{ tone: 'ok' | 'danger'; text: string }>();
  const reload = () =>
    api
      .listPasskeys(token)
      .then((r) => setList(r.passkeys))
      .catch(() => {});
  useEffect(() => {
    void reload();
  }, [token]);
  return (
    <Card testID="passkeys">
      <Txt variant="h3">🔑 {t('passkey.title')}</Txt>
      <Txt variant="small">{t('passkey.body')}</Txt>
      {list.map((p) => (
        <Row key={p.id} wrap>
          <Txt style={{ flex: 1 }} testID="passkey-item">
            {p.label || t('passkey.unnamed')} · {new Date(p.createdAt).toLocaleDateString()}
          </Txt>
          <Button
            small
            variant="ghost"
            label={t('passkey.remove')}
            onPress={async () => {
              if (!(await confirmAsync(t('passkey.removeConfirm')))) return;
              await api.deletePasskey(token, p.id).catch(() => {});
              void reload();
            }}
          />
        </Row>
      ))}
      <Field testID="passkey-label" label={t('passkey.label')} value={label} onChangeText={setLabel} placeholder={t('passkey.labelHint')} />
      <Button
        small
        icon="➕"
        testID="add-passkey"
        label={t('passkey.add')}
        onPress={async () => {
          setNote(undefined);
          try {
            await addPasskey(token, label.trim());
            setLabel('');
            setNote({ tone: 'ok', text: t('passkey.added') });
            void reload();
          } catch (e) {
            setNote({ tone: 'danger', text: e instanceof ApiError ? errorText(t, e) : t('passkey.cancelled') });
          }
        }}
      />
      {note ? <Notice tone={note.tone} text={note.text} /> : null}
    </Card>
  );
}
