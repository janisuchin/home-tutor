/** Student device: join a live class with a 6-letter code, vote in the poll and ask a question (D-059). */
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Notice, ProgressBar, Screen, Section, Txt } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { useT } from '../i18n';
import { every, live, LiveError, type StudentView } from '../data/live-class';
import { CODE_RE } from '../core/classroom-room';

export default function Join() {
  const t = useT();
  const params = useLocalSearchParams<{ code?: string }>();
  const [input, setInput] = useState((params.code ?? '').toUpperCase());
  const [code, setCode] = useState<string | undefined>();
  const [view, setView] = useState<StudentView>();
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!code) return;
    return every(2000, () => {
      live
        .view(code)
        .then((v) => {
          setView(v);
          setError('');
        })
        .catch((e) => {
          if (e instanceof LiveError && e.status === 404) {
            setCode(undefined);
            setView(undefined);
            setError(t('join.ended'));
          }
        });
    });
  }, [code]);

  const join = async () => {
    const c = input.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (!CODE_RE.test(c)) return setError(t('join.badCode'));
    try {
      setView(await live.view(c));
      setCode(c);
      setError('');
    } catch (e) {
      setError(e instanceof LiveError && e.status === 404 ? t('join.noRoom') : t('join.offline'));
    }
  };
  const err = (e: unknown) => setError(e instanceof LiveError ? t(`join.err.${['poll_closed', 'poll_changed', 'too_many_questions', 'rate_limited'].includes(e.code) ? e.code : 'other'}`) : t('join.offline'));

  if (!code || !view) {
    return (
      <Screen title={t('join.title')} testID="join-screen">
        <Mascot size={90} mood="wave" />
        <Txt>{t('join.intro')}</Txt>
        <Field testID="join-code" label={t('join.code')} value={input} onChangeText={(s) => setInput(s.toUpperCase().slice(0, 7))} autoComplete="off" />
        <Button testID="join-submit" icon="🙋" label={t('join.go')} onPress={join} />
        {error ? <Notice tone="warn" text={error} /> : null}
        <Txt variant="small">{t('join.privacy')}</Txt>
      </Screen>
    );
  }
  const p = view.poll;
  const total = p?.counts?.reduce((a, b) => a + b, 0) ?? 0;
  return (
    <Screen title={t('join.inRoom', { code })} testID="join-room">
      {error ? <Notice tone="warn" text={error} /> : null}
      <Section title={t('present.poll')}>
        {p ? (
          <Card testID="live-poll">
            <Txt variant="h2">{p.question}</Txt>
            {p.options.map((o, i) =>
              p.open ? (
                <Button
                  key={i}
                  testID={`live-vote-${i}`}
                  variant={p.myVote === i ? 'primary' : 'secondary'}
                  label={`${p.myVote === i ? '✓ ' : ''}${o}`}
                  onPress={() =>
                    live
                      .vote(code, p.id, i)
                      .then(() => setView({ ...view, poll: { ...p, myVote: i } }))
                      .catch(err)
                  }
                />
              ) : (
                <React.Fragment key={i}>
                  <Txt>{`${o}: ${p.counts![i]}`}</Txt>
                  <ProgressBar value={total ? p.counts![i] / total : 0} label={`${o}: ${p.counts![i]}`} />
                </React.Fragment>
              ),
            )}
            {p.open && p.myVote !== undefined ? <Txt testID="live-voted">{t('join.voted')}</Txt> : null}
            {!p.open ? <Txt>{t('join.pollClosed')}</Txt> : null}
          </Card>
        ) : (
          <Txt testID="live-no-poll">{t('join.waiting')}</Txt>
        )}
      </Section>
      <Section title={t('join.askTitle')}>
        <Field testID="live-question" label={t('join.ask')} hint={t('join.askHint')} value={q} onChangeText={(s) => setQ(s.slice(0, 200))} />
        <Button
          testID="live-send-question"
          icon="💬"
          label={t('join.send')}
          disabled={!q.trim()}
          onPress={() =>
            live
              .ask(code, q.trim())
              .then(() => {
                setQ('');
                setSent(true);
              })
              .catch(err)
          }
        />
        {sent ? <Txt testID="live-question-sent">{t('join.sent')}</Txt> : null}
        {view.myQuestions.map((m) => (
          <Txt key={m.id} variant="small">
            {m.answered ? '✅' : '💬'} {m.text}
          </Txt>
        ))}
      </Section>
    </Screen>
  );
}
