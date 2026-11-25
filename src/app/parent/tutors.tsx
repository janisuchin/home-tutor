/**
 * Parent: invite a tutor with a one-time code, choose which children they see, remove them any time.
 * The tutor signs in with their own account on their own device (see /tutoring).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Notice, Row, Screen, Section, Txt } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { confirmAsync } from '../../ui/confirm';
import { useT } from '../../i18n';
import { useAppState } from '../../data/store';
import { useCatalog, useChildren } from '../../data/hooks';
import { tutorActivity } from '../../core/engine/tutor-activity';
import { api, ApiError, type TutorInfo } from '../../data/api';
import { syncNow } from '../../data/sync';
import { formatCode } from '../../core/crypto';
import { colors } from '../../ui/theme';

export default function TutorsScreen() {
  const t = useT();
  return (
    <ParentGate title={t('tutors.title')}>
      <Tutors />
    </ParentGate>
  );
}

function Tutors() {
  const t = useT();
  const account = useAppState((s) => s.account);
  const family = useAppState((s) => s.family);
  const children = useChildren();
  const allEvents = useAppState((s) => s.events);
  const catalog = useCatalog();
  const [tutors, setTutors] = useState<TutorInfo[]>();
  const [pick, setPick] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState<{ code: string; expiresAt: number }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const name = (id: string) => children.find((c) => c.id === id)?.name ?? '?';

  const reload = useCallback(async () => {
    if (!account) return;
    try {
      setTutors((await api.listTutors(account.token)).tutors);
    } catch (e) {
      setError(t('account.err.generic', { code: e instanceof ApiError ? e.code : String(e) }));
    }
  }, [account, t]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!account) {
    return (
      <Screen title={t('tutors.title')} testID="tutors">
        <Notice text={t('tutors.needAccount')} icon="☁️" />
        <Button label={t('parent.signIn')} onPress={() => router.push('/account')} />
      </Screen>
    );
  }

  const invite = async () => {
    setError('');
    if (!pick.length) return setError(t('tutors.pickOne'));
    setBusy(true);
    try {
      await syncNow(); // the children must be in the cloud before they can be shared
      const r = await api.inviteTutor(account.token, pick, label.trim() || t('tutors.defaultLabel'), family?.name ?? '');
      setCode(r);
      setPick([]);
      setLabel('');
      await reload();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'child_not_synced' ? t('tutors.notSynced') : t('account.err.generic', { code: e instanceof ApiError ? e.code : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('tutors.title')} testID="tutors">
      <Txt>{t('tutors.intro')}</Txt>
      <Section title={t('tutors.invite')}>
        <Card>
          <Field testID="tutor-label" label={t('tutors.label')} value={label} onChangeText={setLabel} placeholder={t('tutors.defaultLabel')} />
          <Txt variant="label">{t('tutors.share')}</Txt>
          <Row wrap>
            {children.map((c) => (
              <Chip
                key={c.id}
                testID={`share-${c.name}`}
                label={`${c.avatar} ${c.name}`}
                selected={pick.includes(c.id)}
                onPress={() => setPick(pick.includes(c.id) ? pick.filter((x) => x !== c.id) : [...pick, c.id])}
              />
            ))}
          </Row>
          {error ? <Notice tone="danger" text={error} /> : null}
          <Button testID="create-invite" icon="✉️" label={busy ? t('common.loading') : t('tutors.create')} disabled={busy} onPress={invite} />
          {code ? (
            <Card tint={colors.amberSoft}>
              <Txt variant="label">{t('tutors.codeTitle')}</Txt>
              <Txt variant="h2" testID="invite-code">
                {formatCode(code.code)}
              </Txt>
              <Txt variant="small">{t('tutors.codeBody', { date: new Date(code.expiresAt).toLocaleDateString() })}</Txt>
            </Card>
          ) : null}
        </Card>
      </Section>

      <Section title={t('tutors.list')}>
        {tutors === undefined ? <Txt variant="small">{t('common.loading')}</Txt> : null}
        {tutors?.length === 0 ? <Txt variant="small">{t('tutors.none')}</Txt> : null}
        {tutors?.map((tu) => (
          <Card key={tu.id} testID={`tutor-link-${tu.label}`}>
            <Txt variant="h3">🧑‍🏫 {tu.label}</Txt>
            <Txt variant="small" testID={`tutor-status-${tu.label}`}>
              {tu.acceptedAt ? t('tutors.accepted', { date: new Date(tu.acceptedAt).toLocaleDateString() }) : t('tutors.waiting', { date: new Date(tu.expiresAt).toLocaleDateString() })}
            </Txt>
            {(() => {
              const a = tutorActivity(allEvents, tu.id);
              return (
                <View testID={`tutor-activity-${tu.label}`} style={{ gap: 2 }}>
                  <Txt variant="label">{t('tutors.activity')}</Txt>
                  <Txt variant="small">{t('tutors.activitySummary', { sessions: a.sessions, minutes: a.minutes, items: a.itemsDone })}</Txt>
                  {a.recent.map((e) => (
                    <Txt key={e.id} variant="small">
                      {new Date(e.at).toLocaleDateString()} · {name(e.childId)} ·{' '}
                      {e.type === 'minutes'
                        ? t('tutors.activitySession', { n: e.minutes ?? 0 })
                        : e.type === 'completed'
                          ? t('tutors.activityDone', { title: catalog?.items.find((i) => i.id === e.itemId)?.title ?? e.itemId ?? '' })
                          : e.type}
                      {e.note ? ` · 📝 ${e.note}` : ''}
                    </Txt>
                  ))}
                </View>
              );
            })()}
            <Txt variant="label">{t('tutors.sees')}</Txt>
            <Row wrap>
              {children.map((c) => {
                const on = tu.childIds.includes(c.id);
                return (
                  <Chip
                    key={c.id}
                    label={`${c.avatar} ${c.name}`}
                    selected={on}
                    onPress={async () => {
                      const next = on ? tu.childIds.filter((x) => x !== c.id) : [...tu.childIds, c.id];
                      if (!next.length) return setError(t('tutors.pickOne'));
                      try {
                        await api.updateTutor(account.token, tu.id, next);
                        await reload();
                      } catch (e) {
                        setError(t('account.err.generic', { code: e instanceof ApiError ? e.code : String(e) }));
                      }
                    }}
                  />
                );
              })}
            </Row>
            {tu.childIds.filter((id) => !children.some((c) => c.id === id)).length ? <Txt variant="small">{tu.childIds.map(name).join(', ')}</Txt> : null}
            <Button
              small
              variant="danger"
              icon="🚫"
              testID={`remove-tutor-${tu.label}`}
              label={t('tutors.remove')}
              onPress={async () => {
                if (!(await confirmAsync(t('tutors.removeConfirm', { name: tu.label })))) return;
                try {
                  await api.removeTutor(account.token, tu.id);
                  await reload();
                } catch (e) {
                  setError(t('account.err.generic', { code: e instanceof ApiError ? e.code : String(e) }));
                }
              }}
            />
          </Card>
        ))}
      </Section>
      <Txt variant="small">{t('tutors.rules')}</Txt>
    </Screen>
  );
}
