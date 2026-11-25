/** Teacher's live room on the projector (D-059): join code, live poll counts and class questions. */
import React, { useEffect, useState } from 'react';
import { Button, Card, Field, Notice, ProgressBar, Row, Section, Txt } from './kit';
import { useT } from '../i18n';
import { every, live, LiveError, type HostView } from '../data/live-class';
import { publicBase } from '../data/api';

export function LivePanel() {
  const t = useT();
  const [room, setRoom] = useState<{ code: string; hostKey: string }>();
  const [view, setView] = useState<HostView>();
  const [error, setError] = useState('');
  const [pq, setPq] = useState('');
  const [po, setPo] = useState('');
  useEffect(() => {
    if (!room) return;
    return every(2000, () => {
      live
        .host(room.code, room.hostKey)
        .then(setView)
        .catch((e) => {
          if (e instanceof LiveError && e.status === 404) {
            setRoom(undefined);
            setView(undefined);
          }
        });
    });
  }, [room]);
  const fail = (e: unknown) => setError(t('live.error', { code: e instanceof LiveError ? e.code : String(e) }));
  if (!room) {
    return (
      <Section title={t('live.title')}>
        <Txt>{t('live.intro')}</Txt>
        <Button testID="live-start" icon="📡" label={t('live.start')} onPress={() => live.create().then(setRoom).catch(fail)} />
        {error ? <Notice tone="warn" text={error} /> : null}
      </Section>
    );
  }
  const p = view?.poll;
  const total = p ? p.counts.reduce((a, b) => a + b, 0) : 0;
  return (
    <Section title={t('live.title')}>
      <Card testID="live-room">
        <Txt>{t('live.joinAt', { url: `${publicBase()}/join` })}</Txt>
        <Txt variant="display" testID="live-code">
          {room.code}
        </Txt>
        <Txt variant="small" testID="live-participants">
          {t('live.participants', { n: view?.participants ?? 0 })}
        </Txt>
      </Card>
      {error ? <Notice tone="warn" text={error} /> : null}
      {p ? (
        <Card testID="live-host-poll">
          <Txt variant="title">{p.question}</Txt>
          {p.options.map((o, i) => (
            <ProgressBar key={i} value={total ? p.counts[i] / total : 0} label={`${o}: ${p.counts[i]}`} />
          ))}
          <Txt testID="live-voted-count">{t('live.voted', { n: p.voted })}</Txt>
          {p.open ? <Button variant="ghost" testID="live-close-poll" label={t('present.closePoll')} onPress={() => live.closePoll(room.code, room.hostKey).catch(fail)} /> : null}
        </Card>
      ) : null}
      {!p || !p.open ? (
        <Card>
          <Field testID="live-poll-question" label={t('present.pollQuestion')} value={pq} onChangeText={setPq} />
          <Field testID="live-poll-options" label={t('present.pollOptions')} value={po} onChangeText={setPo} hint={t('present.pollOptionsHint')} />
          <Button
            testID="live-start-poll"
            label={t('present.startPoll')}
            disabled={!pq.trim() || po.split(',').filter((x) => x.trim()).length < 2}
            onPress={() =>
              live
                .poll(room.code, room.hostKey, pq.trim(), po.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6))
                .then(() => {
                  setPq('');
                  setPo('');
                })
                .catch(fail)
            }
          />
        </Card>
      ) : null}
      <Txt variant="h3">{t('live.questions', { n: view?.questions.length ?? 0 })}</Txt>
      {(view?.questions ?? []).map((q) => (
        <Card key={q.id} testID="live-host-question">
          <Row style={{ justifyContent: 'space-between' }} wrap>
            <Txt variant="h3" style={{ flex: 1 }}>
              {q.answered ? '✅ ' : ''}
              {q.text}
            </Txt>
            <Button small variant="ghost" label={q.answered ? t('present.reopen') : t('present.answered')} onPress={() => live.answered(room.code, room.hostKey, q.id, !q.answered).catch(fail)} />
          </Row>
        </Card>
      ))}
      <Button
        variant="danger"
        testID="live-end"
        icon="⏹️"
        label={t('live.end')}
        onPress={() =>
          live
            .end(room.code, room.hostKey)
            .then(() => {
              setRoom(undefined);
              setView(undefined);
            })
            .catch(fail)
        }
      />
    </Section>
  );
}
