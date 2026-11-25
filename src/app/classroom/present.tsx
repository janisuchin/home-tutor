/**
 * Projector / TV presentation mode (mode H): large text, teacher controls, polls and
 * collaborative questions. Works with touch, a mouse, a keyboard or a TV remote (arrow keys).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Grid, Notice, ProgressBar, Row, SafetyBadge, Screen, Section, Txt, say } from '../../ui/kit';
import { ParentGate } from '../../ui/ParentGate';
import { ProjectorContext, colors, space } from '../../ui/theme';
import { useT } from '../../i18n';
import { addEvent, setPolls, setQuestions, useAppState, type Poll } from '../../data/store';
import { useCatalog, useChildren, usePack } from '../../data/hooks';
import { groupCompatibility } from '../../core/engine/insights';
import { randomId } from '../../core/crypto';
import { dayKey } from '../../core/screen-time';
import { LivePanel } from '../../ui/LivePanel';

export default function PresentScreen() {
  const t = useT();
  return (
    <ParentGate title={t('present.title')}>
      <ProjectorContext.Provider value={true}>
        <Present />
      </ProjectorContext.Provider>
    </ParentGate>
  );
}

type Panel = 'lesson' | 'poll' | 'questions' | 'live';

function Present() {
  const t = useT();
  const { group: groupId } = useLocalSearchParams<{ group: string }>();
  const group = useAppState((s) => (groupId ? s.groups[groupId] : undefined));
  const attendance = useAppState((s) => s.attendance);
  const assignmentsMap = useAppState((s) => s.assignments);
  const polls = useAppState((s) => s.polls);
  const questions = useAppState((s) => s.questions);
  const family = useAppState((s) => s.family);
  const children = useChildren();
  const catalog = useCatalog();
  const members = children.filter((c) => group?.childIds.includes(c.id));
  const compat = useMemo(() => (catalog && members.length ? groupCompatibility(members, family, catalog) : undefined), [catalog, members, family]);
  const assigned = Object.values(assignmentsMap).filter((a) => a.groupId === groupId && !a.deleted).map((a) => a.itemId);
  const choices = useMemo(() => {
    const ids = [...assigned, ...(compat?.sharedItems.map((i) => i.id) ?? [])];
    return [...new Set(ids)].map((id) => catalog?.items.find((i) => i.id === id)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 8);
  }, [assigned, compat, catalog]);
  const [itemId, setItemId] = useState<string | undefined>();
  const meta = catalog?.items.find((i) => i.id === (itemId ?? choices[0]?.id));
  const pack = usePack(meta?.area);
  const item = pack?.items.find((i) => i.id === meta?.id);
  const [step, setStep] = useState(0);
  const [panel, setPanel] = useState<Panel>('lesson');
  const [pq, setPq] = useState('');
  const [po, setPo] = useState('');
  const [newQ, setNewQ] = useState('');
  const [marked, setMarked] = useState(false);
  const present = groupId ? attendance[groupId]?.[dayKey()] ?? group?.childIds ?? [] : [];

  // Arrow keys / TV remote move through steps.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (!item || panel !== 'lesson') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setStep((s) => Math.min(item.steps.length - 1, s + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, panel]);

  if (!group) return <Screen title={t('present.title')}><Notice text={t('present.noGroup')} /></Screen>;
  const poll = polls.find((p) => p.open);
  const total = poll ? poll.votes.reduce((a, b) => a + b, 0) : 0;

  return (
    <Screen title={`📽️ ${group.name}`} back="/classroom" testID="present-screen">
      <Row wrap>
        <Button small variant={panel === 'lesson' ? 'primary' : 'ghost'} label={t('present.lesson')} onPress={() => setPanel('lesson')} testID="panel-lesson" />
        <Button small variant={panel === 'poll' ? 'primary' : 'ghost'} label={t('present.poll')} onPress={() => setPanel('poll')} testID="panel-poll" />
        <Button small variant={panel === 'questions' ? 'primary' : 'ghost'} label={t('present.questions')} onPress={() => setPanel('questions')} testID="panel-questions" />
        <Button small variant={panel === 'live' ? 'primary' : 'ghost'} label={`📡 ${t('live.title')}`} onPress={() => setPanel('live')} testID="panel-live" />
      </Row>

      {panel === 'lesson' ? (
        <>
          <Row wrap>
            {choices.map((c) => (
              <Button key={c.id} small variant={c.id === meta?.id ? 'secondary' : 'ghost'} label={`${c.emoji} ${c.title}`} onPress={() => { setItemId(c.id); setStep(0); setMarked(false); }} />
            ))}
          </Row>
          {item ? (
            <Card testID="present-lesson">
              <Row>
                <Txt variant="display">{item.emoji}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt variant="title">{item.title}</Txt>
                  <Txt>{item.summary}</Txt>
                </View>
                {item.safety ? <SafetyBadge rating={item.safety.rating} long /> : null}
              </Row>
              <ProgressBar value={(step + 1) / item.steps.length} label={t('item.stepOf', { n: step + 1, total: item.steps.length })} />
              <Txt variant="small">{t('item.stepOf', { n: step + 1, total: item.steps.length })}</Txt>
              <Txt variant="display" testID="present-step">
                {item.steps[step]}
              </Txt>
              <Row>
                <Button variant="ghost" label={`◀ ${t('common.back')}`} disabled={step === 0} onPress={() => setStep(step - 1)} />
                <Button variant="ghost" label="🔊" accessibilityLabel={t('common.readAloud')} onPress={() => say(item.steps[step])} />
                <Button testID="present-next" style={{ flex: 1 }} label={`${t('common.next')} ▶`} disabled={step >= item.steps.length - 1} onPress={() => setStep(step + 1)} />
              </Row>
              {item.safety?.notes ? <Notice tone={item.safety.rating === 'green' ? 'info' : 'warn'} text={item.safety.notes} /> : null}
              <Button
                testID="mark-done"
                variant="secondary"
                disabled={marked}
                label={marked ? t('present.marked') : t('present.markDone', { n: present.length })}
                onPress={() => {
                  for (const cid of present) addEvent({ childId: cid, type: 'completed', itemId: item.id, by: 'tutor', groupId: group.id });
                  setMarked(true);
                }}
              />
              <Txt variant="small">{t('present.individual')}</Txt>
            </Card>
          ) : (
            <Notice text={t('present.pick')} />
          )}
        </>
      ) : null}

      {/* Kept mounted while switching panels, so the live room keeps running. */}
      <View style={{ display: panel === 'live' ? 'flex' : 'none' }}>
        <LivePanel />
      </View>
      {panel === 'poll' ? (
        <Section title={t('present.poll')}>
          {poll ? (
            <Card testID="poll">
              <Txt variant="title">{poll.question}</Txt>
              <Grid columns={2}>
                {poll.options.map((o, i) => (
                  <Card key={i} onPress={() => setPolls(polls.map((p) => (p.id === poll.id ? { ...p, votes: p.votes.map((v, j) => (j === i ? v + 1 : v)) } : p)))} accessibilityLabel={t('present.voteFor', { option: o })} testID={`vote-${i}`}>
                    <Txt variant="h2">{o}</Txt>
                    <ProgressBar value={total ? poll.votes[i] / total : 0} label={o} />
                    <Txt>{t('present.votes', { n: poll.votes[i] })}</Txt>
                  </Card>
                ))}
              </Grid>
              <Button variant="ghost" label={t('present.closePoll')} onPress={() => setPolls(polls.map((p) => (p.id === poll.id ? { ...p, open: false } : p)))} />
            </Card>
          ) : (
            <Card>
              <Field testID="poll-question" label={t('present.pollQuestion')} value={pq} onChangeText={setPq} />
              <Field testID="poll-options" label={t('present.pollOptions')} value={po} onChangeText={setPo} hint={t('present.pollOptionsHint')} />
              <Button
                testID="start-poll"
                label={t('present.startPoll')}
                disabled={!pq.trim() || po.split(',').filter((x) => x.trim()).length < 2}
                onPress={() => {
                  const options = po.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6);
                  const p: Poll = { id: randomId(), question: pq.trim(), options, votes: options.map(() => 0), open: true };
                  setPolls([...polls.map((x) => ({ ...x, open: false })), p]);
                  setPq('');
                  setPo('');
                }}
              />
            </Card>
          )}
        </Section>
      ) : null}

      {panel === 'questions' ? (
        <Section title={t('present.questions')}>
          <Card>
            <Field testID="class-question" label={t('present.addQuestion')} value={newQ} onChangeText={setNewQ} />
            <Button
              small
              testID="add-question"
              label={t('present.add')}
              disabled={!newQ.trim()}
              onPress={() => {
                setQuestions([...questions, { id: randomId(), text: newQ.trim(), by: group.name, votes: 0, answered: false }]);
                setNewQ('');
              }}
            />
          </Card>
          {[...questions]
            .sort((a, b) => Number(a.answered) - Number(b.answered) || b.votes - a.votes)
            .map((q) => (
              <Card key={q.id} tint={q.answered ? colors.greenSoft : undefined}>
                <Txt variant="h2">
                  {q.answered ? '✅ ' : '❓ '}
                  {q.text}
                </Txt>
                <Row wrap>
                  <Button small variant="ghost" label={`👍 ${q.votes}`} accessibilityLabel={t('present.upvote')} onPress={() => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, votes: x.votes + 1 } : x)))} />
                  <Button small variant="ghost" label={q.answered ? t('present.reopen') : t('present.answered')} onPress={() => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, answered: !x.answered } : x)))} />
                </Row>
              </Card>
            ))}
        </Section>
      ) : null}
      <View style={{ height: space.xl }} />
      <Button variant="ghost" label={t('present.exit')} onPress={() => router.replace('/classroom')} />
    </Screen>
  );
}
