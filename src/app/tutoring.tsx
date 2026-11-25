/**
 * Tutor side of tutor accounts: a tutor signed in with their own account enters a parent's invite
 * code and then sees only the children that parent shared. They can log a session and mark lessons
 * done together; they cannot delete anything. The parent can remove them at any time.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Field, Grid, Notice, Pill, Row, Screen, Section, Txt } from '../ui/kit';
import { ParentGate } from '../ui/ParentGate';
import { colors, useTheme } from '../ui/theme';
import { useT } from '../i18n';
import { useAppState } from '../data/store';
import { useCatalog } from '../data/hooks';
import { ApiError } from '../data/api';
import { acceptTutorInvite, addTutorEvent, loadTutoring, syncTutoring, useTutoring, type TutoredFamily } from '../data/tutoring';
import { deriveProgress } from '../core/engine/progress';
import { recommend } from '../core/engine/recommend';
import { tutorInsights } from '../core/engine/insights';
import { ageFromBirth, type Child } from '../core/model';
import { reasonText } from '../ui/reasons';

export default function TutoringScreen() {
  const t = useT();
  return (
    <ParentGate title={t('tutoring.title')} optional>
      <Tutoring />
    </ParentGate>
  );
}

function Tutoring() {
  const t = useT();
  const account = useAppState((s) => s.account);
  const families = useTutoring((s) => s.families);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadTutoring().then(() => (account ? syncTutoring() : undefined));
  }, [account]);

  if (!account) {
    return (
      <Screen title={t('tutoring.title')} testID="tutoring">
        <Txt>{t('tutoring.intro')}</Txt>
        <Notice text={t('tutoring.needAccount')} icon="☁️" />
        <Button testID="tutoring-sign-in" label={t('parent.signIn')} onPress={() => router.push('/account')} />
      </Screen>
    );
  }

  const accept = async () => {
    setError('');
    setBusy(true);
    try {
      const link = await acceptTutorInvite(code);
      setCode('');
      setMsg(t('tutoring.joined', { family: link.familyLabel || t('tutoring.aFamily') }));
    } catch (e) {
      const c = e instanceof ApiError ? e.code : String(e);
      setError(c === 'invalid_invite' ? t('tutoring.badCode') : c === 'own_invite' ? t('tutoring.ownCode') : t('account.err.generic', { code: c }));
    } finally {
      setBusy(false);
    }
  };

  const list = Object.values(families);
  return (
    <Screen title={t('tutoring.title')} testID="tutoring">
      <Txt>{t('tutoring.intro')}</Txt>
      <Card>
        <Field testID="invite-input" label={t('tutoring.code')} value={code} onChangeText={setCode} placeholder="ABCD-EFGH-JKLM" />
        {error ? <Notice tone="danger" text={error} /> : null}
        {msg ? <Notice tone="ok" text={msg} /> : null}
        <Row wrap>
          <Button testID="accept-invite" icon="🤝" label={busy ? t('common.loading') : t('tutoring.join')} disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 12} onPress={accept} />
          <Button small variant="ghost" icon="🔄" testID="tutoring-sync" label={t('account.syncNow')} onPress={() => void syncTutoring()} />
        </Row>
      </Card>
      {list.length === 0 ? <Txt variant="small">{t('tutoring.none')}</Txt> : null}
      {list.map((f) => (
        <FamilyBlock key={f.id} f={f} />
      ))}
      <Txt variant="small">{t('tutoring.rules')}</Txt>
    </Screen>
  );
}

function FamilyBlock({ f }: { f: TutoredFamily }) {
  const t = useT();
  const kids = Object.values(f.children).filter((c) => !c.deleted && f.childIds.includes(c.id));
  return (
    <Section title={`👪 ${f.familyLabel || t('tutoring.aFamily')}`} testID={`tutored-family-${f.familyLabel}`}>
      {kids.length === 0 ? <Txt variant="small">{t('common.loading')}</Txt> : null}
      {kids.map((c) => (
        <ChildBlock key={c.id} linkId={f.id} c={c} events={f.events} />
      ))}
    </Section>
  );
}

function ChildBlock({ linkId, c, events }: { linkId: string; c: Child; events: TutoredFamily['events'] }) {
  const t = useT();
  const th = useTheme();
  const catalog = useCatalog();
  const mine = useMemo(() => events.filter((e) => e.childId === c.id), [events, c.id]);
  const data = useMemo(() => {
    if (!catalog) return undefined;
    const p = deriveProgress(c, mine, catalog);
    return { p, recs: recommend(c, undefined, catalog, mine, { progress: p }).slice(0, 3), insights: tutorInsights(c, undefined, catalog, mine) };
  }, [c, mine, catalog]);
  if (!data) return <Txt variant="small">{t('common.loading')}</Txt>;
  const sessions = mine.filter((e) => e.by === 'tutor' && e.type === 'minutes').length;
  const [note, setNote] = useState('');
  return (
    <Card testID={`tutored-${c.name}`}>
      <Row>
        <Txt variant="title">{c.avatar}</Txt>
        <View style={{ flex: 1 }}>
          <Txt variant="h3">{c.name}</Txt>
          <Txt variant="small">{t('picker.age', { age: ageFromBirth(c.birth) })}</Txt>
        </View>
      </Row>
      <Row wrap>
        <Pill text={t('parent.completed', { n: data.p.completed.size })} />
        <Pill text={t('tutoring.sessions', { n: sessions })} bg={colors.tealSoft} fg={colors.teal} />
        {c.interests.map((i) => (
          <Pill key={i} text={t(`interest.${i}`)} />
        ))}
      </Row>
      {data.insights.slice(0, 2).map((i, k) => (
        <Notice key={k} text={t(i.reason.key, i.reason.vars)} icon={i.kind === 'safety' ? '⚠️' : '💡'} />
      ))}
      <Txt variant="label">📌 {t('tutor.suggested')}</Txt>
      <Grid columns={th.layout === 'phone' ? 1 : 3}>
        {data.recs.map((r) => (
          <Card key={r.item.id} tint={colors.surfaceAlt}>
            <Txt bold>
              {r.item.emoji} {r.item.title}
            </Txt>
            <Txt variant="small">{reasonText(t, r)}</Txt>
            <Button
              small
              variant="ghost"
              icon="✅"
              testID={`tutor-done-${r.item.id}`}
              label={t('tutoring.doneTogether')}
              onPress={() => addTutorEvent(linkId, { childId: c.id, type: 'completed', itemId: r.item.id })}
            />
          </Card>
        ))}
      </Grid>
      <Field
        testID={`note-${c.name}`}
        label={t('tutoring.note')}
        hint={t('tutoring.noteHint')}
        value={note}
        onChangeText={(v) => setNote(v.slice(0, 500))}
        multiline
      />
      <Row wrap>
        {[30, 45, 60].map((m) => (
          <Button
            key={m}
            small
            variant="secondary"
            icon="⏱️"
            testID={`log-${c.name}-${m}`}
            label={t('tutoring.logSession', { n: m })}
            onPress={() => {
              addTutorEvent(linkId, { childId: c.id, type: 'minutes', minutes: m, ...(note.trim() ? { text: note.trim() } : {}) });
              setNote('');
            }}
          />
        ))}
      </Row>
      {mine
        .filter((e) => e.by === 'tutor' && e.type === 'minutes' && e.text)
        .slice(-3)
        .reverse()
        .map((e) => (
          <Txt key={e.id} variant="small">
            📝 {new Date(e.at).toLocaleDateString()}: {e.text}
          </Txt>
        ))}
    </Card>
  );
}
